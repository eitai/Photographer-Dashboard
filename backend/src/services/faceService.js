/**
 * Face recognition service.
 *
 * Uses @vladmandic/face-api with the pure-JS @tensorflow/tfjs backend so no
 * native build tools are required. Models are loaded from backend/models/face-api/.
 *
 * Key design decisions:
 * - initFaceApi() is idempotent and called lazily on first use.
 * - imageToTensor() decodes images via Sharp → raw RGB pixels → TF tensor, so
 *   the `canvas` package is only used as a polyfill (faceapi.env.monkeyPatch).
 * - Per-admin embedding cache (10-min TTL) avoids re-querying Postgres on every
 *   image during a batch run.
 * - Cosine distance is used instead of Euclidean because face-api descriptors
 *   are L2-normalised; cosine distance is equivalent but cleaner to threshold.
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const pool = require('../db');
const { rowToCamel } = require('../db/utils');
const logger = require('../utils/logger');
const s3 = require('../config/s3');

// face-api's Node.js bundle tries to require('@tensorflow/tfjs-node') first.
// We only have the pure-JS '@tensorflow/tfjs', so we redirect the require here
// before face-api ever loads. This must run once, at module load time.
{
  const Module = require('module');
  const _origResolve = Module._resolveFilename.bind(Module);
  Module._resolveFilename = function (request, ...rest) {
    if (request === '@tensorflow/tfjs-node' || request === '@tensorflow/tfjs-node-gpu') {
      return _origResolve('@tensorflow/tfjs', ...rest);
    }
    return _origResolve(request, ...rest);
  };
}

// ── Lazy-loaded singletons ────────────────────────────────────────────────────

let faceapi = null;
let modelsLoaded = false;

const MODEL_DIR = path.join(__dirname, '../../models/face-api');
// For L2-normalised face-api descriptors: euclidean_dist = sqrt(2 × cosine_dist).
// face-api docs recommend euclidean < 0.6 for same person → cosine < 0.18.
// MATCH_THRESHOLD: client matching — tight to avoid false positives.
// CLUSTER_THRESHOLD: anonymous grouping — slightly looser to handle variation across photos.
// face-api descriptors have L2 norm ≈ 1.43 (not unit vectors).
// Equivalent euclidean formula: euclidean = sqrt(2 × norm² × cosine_dist)
// face-api same-person threshold: euclidean < 0.6 → cosine < 0.088 at norm 1.43.
const MATCH_THRESHOLD   = 0.10;  // cosine ≈ euclidean 0.64 — allows cross-session photo variation
const CLUSTER_THRESHOLD = 0.07;  // cosine ≈ euclidean 0.53 — tighter to avoid merging different people (e.g. babies)
const DETECT_CONFIDENCE = 0.3;  // SSD MobileNet min confidence — 0.3 catches angled/low-light faces
const MODEL_VERSION = 'vladmandic-face-api-v1';

// LRU-style per-admin embedding cache
// Map<adminId, { descriptors: Map<clientId, Float32Array>, loadedAt: number }>
const embeddingCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

// ── Init ──────────────────────────────────────────────────────────────────────

async function initFaceApi() {
  if (modelsLoaded) return faceapi;

  // Load the pure-JS TF backend first, then face-api.
  // The Module._resolveFilename hook at the top of this file ensures face-api's
  // internal require('@tensorflow/tfjs-node') resolves to '@tensorflow/tfjs'.
  require('@tensorflow/tfjs');
  faceapi = require('@vladmandic/face-api');

  // Polyfill HTMLImageElement / HTMLCanvasElement for Node.js so face-api
  // internal helpers that touch canvas don't throw.
  // On Windows, node-canvas requires native Cairo/Pango binaries that are
  // frequently absent. Since imageToTensor() decodes images via Sharp → raw
  // RGB tensors, canvas is never actually called for pixel data — so minimal
  // stubs are sufficient when the real package is unavailable.
  let canvasPolyfill;
  try {
    const canvas = require('canvas');
    canvasPolyfill = { Canvas: canvas.Canvas, Image: canvas.Image, ImageData: canvas.ImageData };
  } catch {
    // canvas package not available (e.g. missing Cairo on Windows) — use stubs.
    // face-api only needs these types registered; our imageToTensor() path bypasses them.
    canvasPolyfill = {
      Canvas: class Canvas {
        getContext() {
          return {
            drawImage() {},
            getImageData() { return { data: new Uint8ClampedArray() }; },
          };
        }
      },
      Image: class Image {},
      ImageData: class ImageData {
        constructor(d, w, h) { this.data = d; this.width = w; this.height = h; }
      },
    };
    logger.warn('[faceService] canvas package unavailable — using stubs (Sharp/tensor path active)');
  }
  faceapi.env.monkeyPatch(canvasPolyfill);

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);

  modelsLoaded = true;
  logger.info('[faceService] models loaded from ' + MODEL_DIR);
  return faceapi;
}

// ── Image → tensor ────────────────────────────────────────────────────────────

/**
 * Decode imageBuffer via Sharp to raw RGB bytes and build a TF tensor3d that
 * face-api can process. Returns { tensor, info } — caller must dispose tensor.
 */
async function imageToTensor(imageBuffer) {
  const fa = await initFaceApi();

  // Ensure the TF backend is ready before creating tensors.
  await fa.tf.ready();

  const { data, info } = await sharp(imageBuffer)
    .rotate()                                        // apply EXIF orientation before anything else
    .resize({ width: 640, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const expectedBytes = info.width * info.height * 3;
  if (data.length !== expectedBytes) {
    throw new Error(`Sharp raw buffer size mismatch: expected ${expectedBytes}, got ${data.length} (${info.width}x${info.height})`);
  }

  // Dtype MUST be 'float32'. TF.js infers 'int32' from Uint8Array by default,
  // which breaks SSD MobileNet's internal (pixel - 127.5)/127.5 normalisation.
  const float32Data = new Float32Array(data); // copy uint8 0-255 → float32 0.0-255.0
  const tensor = fa.tf.tensor3d(float32Data, [info.height, info.width, 3], 'float32');
  return { tensor, info };
}

// ── Detection helpers ─────────────────────────────────────────────────────────

async function detectSingleFace(imageBuffer) {
  const fa = await initFaceApi();
  const { tensor } = await imageToTensor(imageBuffer);
  try {
    const detection = await fa
      .detectSingleFace(tensor, new fa.SsdMobilenetv1Options({ minConfidence: DETECT_CONFIDENCE }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection || null;
  } finally {
    tensor.dispose();
  }
}

async function detectAllFaces(imageBuffer) {
  const fa = await initFaceApi();
  const { tensor, info } = await imageToTensor(imageBuffer);
  try {
    const detections = await fa
      .detectAllFaces(tensor, new fa.SsdMobilenetv1Options({ minConfidence: DETECT_CONFIDENCE }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    return { detections: detections || [], info };
  } finally {
    tensor.dispose();
  }
}

// ── Enrollment ────────────────────────────────────────────────────────────────

/**
 * Enroll a reference photo for a client.
 * Detects a single face, stores the 128-dim descriptor as JSONB, saves the
 * reference image, and invalidates the per-admin embedding cache.
 *
 * Returns the stored reference record (camelCase).
 * Throws { code: 'NO_FACE' } when no face is detected.
 */
async function enrollClientReference(clientId, adminId, imageBuffer) {
  const detection = await detectSingleFace(imageBuffer);
  if (!detection) {
    throw Object.assign(new Error('No face detected in reference photo'), { code: 'NO_FACE' });
  }

  const embedding = Array.from(detection.descriptor); // Float32Array → plain array for JSONB

  // Store reference image
  const filename = `face-ref-${clientId}.jpg`;
  let imagePath;

  if (s3.isEnabled()) {
    const buffer = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer();
    imagePath = await s3.uploadBuffer(buffer, `face-references/${filename}`, 'image/jpeg');
  } else {
    const refDir = path.join(__dirname, '../../uploads/face-references');
    if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });
    const dest = path.join(refDir, filename);
    await sharp(imageBuffer).jpeg({ quality: 85 }).toFile(dest);
    imagePath = `/uploads/face-references/${filename}`;
  }

  const { rows } = await pool.query(
    `INSERT INTO client_face_references (client_id, admin_id, image_path, embedding, model_version)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (client_id) DO UPDATE
       SET image_path     = EXCLUDED.image_path,
           embedding      = EXCLUDED.embedding,
           model_version  = EXCLUDED.model_version,
           updated_at     = NOW()
     RETURNING *`,
    [clientId, adminId, imagePath, JSON.stringify(embedding), MODEL_VERSION]
  );

  // Invalidate the embedding cache so the next batch picks up the new reference
  embeddingCache.delete(adminId);

  return rowToCamel(rows[0]);
}

async function deleteClientReference(clientId, adminId) {
  const { rows } = await pool.query(
    'DELETE FROM client_face_references WHERE client_id = $1 AND admin_id = $2 RETURNING *',
    [clientId, adminId]
  );
  embeddingCache.delete(adminId);
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function getClientReference(clientId, adminId) {
  const { rows } = await pool.query(
    'SELECT * FROM client_face_references WHERE client_id = $1 AND admin_id = $2',
    [clientId, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

// ── Embedding cache ───────────────────────────────────────────────────────────

/**
 * Load all enabled client descriptors for an admin into a local Map.
 * Results are cached for CACHE_TTL_MS to avoid re-querying on each image.
 *
 * Returns Map<clientId, Float32Array>.
 */
async function loadAdminEmbeddingsCache(adminId) {
  const cached = embeddingCache.get(adminId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.descriptors;
  }

  const { rows } = await pool.query(
    `SELECT cfr.client_id, cfr.embedding
     FROM client_face_references cfr
     JOIN clients c ON c.id = cfr.client_id
     WHERE cfr.admin_id = $1 AND c.face_recognition_enabled = TRUE`,
    [adminId]
  );

  const descriptors = new Map();
  for (const row of rows) {
    const arr = Array.isArray(row.embedding) ? row.embedding : Object.values(row.embedding);
    descriptors.set(row.client_id, new Float32Array(arr));
  }

  embeddingCache.set(adminId, { descriptors, loadedAt: Date.now() });
  return descriptors;
}

// ── Matching ──────────────────────────────────────────────────────────────────

/**
 * Cosine distance between two Float32Arrays. Range [0, 2], lower = more similar.
 * Both face-api descriptors are L2-normalised so cosine distance is equivalent
 * to 1 - dot product (norms are 1).
 */
function cosineDistance(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 2 : 1 - dot / denom;
}

/**
 * Find the closest matching client for a face descriptor.
 * Returns { clientId, confidence } if within threshold, or null.
 * confidence is in [0, 1] where 1 = perfect match.
 */
function matchEmbeddingToClients(descriptor, clientDescriptors, threshold = MATCH_THRESHOLD) {
  let bestClientId = null;
  let bestDist = Infinity;

  for (const [clientId, refDescriptor] of clientDescriptors) {
    const dist = cosineDistance(descriptor, refDescriptor);
    if (dist < bestDist) {
      bestDist = dist;
      bestClientId = clientId;
    }
  }

  if (bestDist <= threshold) {
    return { clientId: bestClientId, confidence: Math.round((1 - bestDist) * 100) / 100 };
  }
  return null;
}

// ── Face crop ─────────────────────────────────────────────────────────────────

/**
 * Cut a padded square crop around a detected face and store it.
 * normalizedBox coords are 0-1 relative to the image dimensions.
 * Returns the stored path, or null on failure.
 */
async function saveFaceCrop(imageBuffer, normalizedBox, galleryImageId, faceIndex, adminId) {
  try {
    // Thumbnails have EXIF stripped during creation so metadata() gives correct dims.
    // Apply .rotate() for safety in case an original (non-thumbnail) path is used.
    const { info: rotInfo } = await sharp(imageBuffer).rotate().toBuffer({ resolveWithObject: true });
    const W = rotInfo.width;
    const H = rotInfo.height;

    const padFactor = 0.35;
    let fx = normalizedBox.x * W;
    let fy = normalizedBox.y * H;
    let fw = normalizedBox.width  * W;
    let fh = normalizedBox.height * H;

    fx -= fw * padFactor;
    fy -= fh * padFactor;
    fw += fw * padFactor * 2;
    fh += fh * padFactor * 2;

    const size = Math.round(Math.max(fw, fh));
    const cx   = Math.round(fx + fw / 2);
    const cy   = Math.round(fy + fh / 2);
    const left = Math.max(0, Math.min(W - size, cx - Math.floor(size / 2)));
    const top  = Math.max(0, Math.min(H - size, cy - Math.floor(size / 2)));
    const cropW = Math.min(W - left, size);
    const cropH = Math.min(H - top, size);

    if (cropW < 10 || cropH < 10) return null;

    const cropBuffer = await sharp(imageBuffer)
      .rotate()
      .extract({ left, top, width: cropW, height: cropH })
      .resize(150, 150, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const filename = `face-crop-${galleryImageId}-${faceIndex}.jpg`;

    if (s3.isEnabled()) {
      return await s3.uploadBuffer(cropBuffer, `admins/${adminId}/face-crops/${filename}`, 'image/jpeg');
    }

    const cropDir = path.join(__dirname, '../../uploads/face-crops');
    if (!fs.existsSync(cropDir)) fs.mkdirSync(cropDir, { recursive: true });
    fs.writeFileSync(path.join(cropDir, filename), cropBuffer);
    return `/uploads/face-crops/${filename}`;
  } catch (err) {
    logger.warn(`[faceService] saveFaceCrop ${galleryImageId}[${faceIndex}]: ${err.message}`);
    return null;
  }
}

// ── Per-image processing ──────────────────────────────────────────────────────

/**
 * Detect faces in a single gallery image and write face tags to the DB.
 * Skips images that already have tags (idempotent).
 * Returns the number of matched faces.
 */
async function processImageForRecognition(galleryImageId, adminId, clientDescriptors) {
  // Idempotency: skip if already tagged
  const existing = await pool.query(
    'SELECT id FROM gallery_image_face_tags WHERE gallery_image_id = $1 LIMIT 1',
    [galleryImageId]
  );
  if (existing.rows.length > 0) {
    logger.info(`[faceService] image ${galleryImageId}: skipped (already tagged)`);
    return 0;
  }

  // Fetch image path
  const { rows: imgRows } = await pool.query(
    'SELECT path, thumbnail_path FROM gallery_images WHERE id = $1',
    [galleryImageId]
  );
  if (!imgRows[0]) {
    logger.warn(`[faceService] image ${galleryImageId}: not found in gallery_images`);
    return 0;
  }

  const img = imgRows[0];
  let imageBuffer;
  try {
    // Prefer thumbnail (already resized to 800px) for speed
    const imgPath = img.thumbnail_path || img.path;
    if (!imgPath) {
      logger.warn(`[faceService] image ${galleryImageId}: no path or thumbnail_path in DB`);
      return 0;
    }

    logger.info(`[faceService] image ${galleryImageId}: reading from ${imgPath}`);

    const isRemote = imgPath.startsWith('http');
    const isS3Key  = s3.isEnabled() && !isRemote && !imgPath.startsWith('/');
    if (isRemote || isS3Key) {
      // S3 key or full URL — fetch via presigned URL or getReadStream
      if (typeof s3.getReadStream === 'function') {
        const chunks = [];
        const stream = await s3.getReadStream(imgPath);
        for await (const chunk of stream) chunks.push(chunk);
        imageBuffer = Buffer.concat(chunks);
      } else {
        // Fallback: generatePresignedUrl + https fetch
        const https = require('https');
        const url = await s3.generatePresignedUrl(imgPath, 60);
        imageBuffer = await new Promise((resolve, reject) => {
          const chunks = [];
          https.get(url, (res) => {
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
          }).on('error', reject);
        });
      }
    } else {
      const localPath = path.join(__dirname, '../../', imgPath.replace(/^\//, ''));
      if (!fs.existsSync(localPath)) {
        logger.warn(`[faceService] image ${galleryImageId}: file not found on disk — ${localPath}`);
        return 0;
      }
      imageBuffer = fs.readFileSync(localPath);
    }
  } catch (err) {
    logger.warn(`[faceService] could not read image ${galleryImageId}: ${err.message}`);
    return 0;
  }

  let detections, info;
  try {
    ({ detections, info } = await detectAllFaces(imageBuffer));
  } catch (err) {
    logger.warn(`[faceService] face detection failed for ${galleryImageId}: ${err.message}`);
    return 0;
  }

  if (detections.length === 0) {
    logger.info(`[faceService] image ${galleryImageId}: 0 faces detected`);
    return 0;
  }
  logger.info(`[faceService] image ${galleryImageId}: ${detections.length} face(s) detected`);

  let matchCount = 0;
  let faceIndex = 0;
  for (const det of detections) {
    const box = det.detection.box;
    const normalizedBox = {
      x:      box.x      / info.width,
      y:      box.y      / info.height,
      width:  box.width  / info.width,
      height: box.height / info.height,
    };

    const faceCropPath = await saveFaceCrop(imageBuffer, normalizedBox, galleryImageId, faceIndex, adminId);

    let match = null;
    if (clientDescriptors.size > 0) {
      match = matchEmbeddingToClients(det.descriptor, clientDescriptors);
      // Log best distance so threshold issues are visible in server logs
      let bestDist = Infinity;
      for (const ref of clientDescriptors.values()) {
        const d = cosineDistance(det.descriptor, ref);
        if (d < bestDist) bestDist = d;
      }
      logger.info(`[faceService] image ${galleryImageId} face[${faceIndex}]: best_client_dist=${bestDist.toFixed(4)} threshold=${MATCH_THRESHOLD} → ${match ? 'MATCHED' : 'no match'}`);
    }

    await pool.query(
      `INSERT INTO gallery_image_face_tags
         (gallery_image_id, client_id, admin_id, confidence, bounding_box, status, descriptor, face_crop_path)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)`,
      [
        galleryImageId,
        match ? match.clientId : null,
        adminId,
        match ? match.confidence : det.detection.score,
        JSON.stringify(normalizedBox),
        match ? 'matched' : 'unmatched',
        JSON.stringify(Array.from(det.descriptor)),
        faceCropPath,
      ]
    );
    if (match) matchCount++;
    faceIndex++;
  }

  return matchCount;
}

// ── Face clustering ───────────────────────────────────────────────────────────

/**
 * Group unmatched face tags for a gallery by visual similarity.
 * Uses greedy nearest-centroid clustering with the same cosine threshold as matching.
 * Each cluster gets a shared UUID (cluster_id) so the strip can group them correctly.
 */
async function clusterGalleryFaces(galleryId, adminId) {
  const crypto = require('node:crypto');

  const { rows } = await pool.query(
    `SELECT t.id, t.descriptor
     FROM gallery_image_face_tags t
     JOIN gallery_images gi ON gi.id = t.gallery_image_id
     WHERE gi.gallery_id = $1 AND t.admin_id = $2
       AND t.status = 'unmatched' AND t.descriptor IS NOT NULL
     ORDER BY t.created_at ASC`,
    [galleryId, adminId]
  );

  if (!rows.length) return;

  // clusters: Array<{ id: string, centroid: Float32Array, count: number }>
  const clusters = [];
  const tagIds = [];
  const clusterIds = [];

  // Diagnostic: compute pairwise distances for first 6 descriptors to verify values
  if (rows.length >= 2) {
    const sample = rows.slice(0, Math.min(6, rows.length)).map(r => {
      const arr = Array.isArray(r.descriptor) ? r.descriptor : Object.values(r.descriptor);
      return new Float32Array(arr);
    });
    const norm0 = Math.sqrt(sample[0].reduce((s, v) => s + v * v, 0));
    logger.info(`[faceService] cluster diag: descriptor[0] norm=${norm0.toFixed(4)}, dim=${sample[0].length}`);
    for (let i = 1; i < sample.length; i++) {
      const d = cosineDistance(sample[0], sample[i]);
      logger.info(`[faceService] cluster diag: dist(face0, face${i}) = ${d.toFixed(4)} (threshold=${CLUSTER_THRESHOLD})`);
    }
  }

  for (const row of rows) {
    const arr = Array.isArray(row.descriptor) ? row.descriptor : Object.values(row.descriptor);
    const descriptor = new Float32Array(arr);

    let bestCluster = null;
    let bestDist = Infinity;
    for (const cluster of clusters) {
      const dist = cosineDistance(descriptor, cluster.centroid);
      if (dist < bestDist) { bestDist = dist; bestCluster = cluster; }
    }

    let assignedId;
    if (bestCluster && bestDist <= CLUSTER_THRESHOLD) {
      // Update centroid with online mean
      bestCluster.count++;
      for (let i = 0; i < bestCluster.centroid.length; i++) {
        bestCluster.centroid[i] += (descriptor[i] - bestCluster.centroid[i]) / bestCluster.count;
      }
      assignedId = bestCluster.id;
      logger.info(`[faceService] cluster: face ${tagIds.length + 1} → cluster #${clusters.indexOf(bestCluster) + 1} (dist=${bestDist.toFixed(4)})`);
    } else {
      assignedId = crypto.randomUUID();
      clusters.push({ id: assignedId, centroid: new Float32Array(descriptor), count: 1 });
      logger.info(`[faceService] cluster: face ${tagIds.length + 1} → NEW cluster #${clusters.length} (prev_best_dist=${bestDist === Infinity ? 'none' : bestDist.toFixed(4)})`);
    }

    tagIds.push(row.id);
    clusterIds.push(assignedId);
  }

  // Single bulk UPDATE via unnest
  await pool.query(
    `UPDATE gallery_image_face_tags t
     SET cluster_id = v.cluster_id
     FROM unnest($1::uuid[], $2::uuid[]) AS v(tag_id, cluster_id)
     WHERE t.id = v.tag_id`,
    [tagIds, clusterIds]
  );

  logger.info(`[faceService] clustered ${rows.length} faces into ${clusters.length} groups for gallery ${galleryId}`);
}

// ── Batch processing ──────────────────────────────────────────────────────────

/**
 * Process a whole gallery batch — called from the worker handler.
 * Loads embeddings cache once, then processes each image serially to keep
 * memory pressure low (TF.js models are ~150–200 MB).
 */
async function processGalleryBatch(galleryId, adminId, imageIds) {
  const clientDescriptors = await loadAdminEmbeddingsCache(adminId);
  logger.info(`[faceService] gallery ${galleryId}: ${clientDescriptors.size} client reference(s) loaded for matching`);

  // Flip job to 'running'.
  // Accept both 'queued' and 'running' so that a job reset mid-flight
  // (e.g. server restart) still picks up correctly. Using status = 'queued'
  // alone would cause the UPDATE to silently no-op when the row is already
  // 'running', leaving the UI stuck.
  await pool.query(
    `UPDATE face_recognition_jobs
     SET status = 'running', started_at = NOW()
     WHERE gallery_id = $1 AND status = 'queued'`,
    [galleryId]
  );

  let totalMatched = 0;
  let totalFacesFound = 0;

  for (let i = 0; i < imageIds.length; i++) {
    try {
      const matched = await processImageForRecognition(imageIds[i], adminId, clientDescriptors);
      totalMatched += matched;
      if (matched >= 0) totalFacesFound++; // processImageForRecognition returns match count, not face count
    } catch (err) {
      logger.warn(`[faceService] error on image ${imageIds[i]}: ${err.message}`);
    }

    // Update progress every 10 images (and on last image)
    if (i % 10 === 0 || i === imageIds.length - 1) {
      await pool.query(
        `UPDATE face_recognition_jobs
         SET processed = $1, matched = $2
         WHERE gallery_id = $3`,
        [i + 1, totalMatched, galleryId]
      );
    }
  }

  logger.info(`[faceService] gallery ${galleryId}: processed ${imageIds.length} images, ${totalMatched} client matches`);

  // Cluster unmatched faces by visual similarity so the strip groups same people together
  await clusterGalleryFaces(galleryId, adminId);

  await pool.query(
    `UPDATE face_recognition_jobs
     SET status = 'done', processed = $1, matched = $2, finished_at = NOW()
     WHERE gallery_id = $3`,
    [imageIds.length, totalMatched, galleryId]
  );

  return totalMatched;
}

module.exports = {
  initFaceApi,
  enrollClientReference,
  deleteClientReference,
  getClientReference,
  loadAdminEmbeddingsCache,
  processGalleryBatch,
};
