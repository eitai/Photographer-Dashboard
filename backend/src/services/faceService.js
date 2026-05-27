/**
 * Face recognition service — CompreFace REST API backend.
 *
 * Replaces the previous @vladmandic/face-api + TensorFlow.js implementation.
 * All face detection and recognition is delegated to a CompreFace Docker service
 * via its REST API; no ML models are loaded in-process.
 *
 * Key design decisions:
 * - HTTP requests to CompreFace are built with node:https + the form-data package
 *   (already a transitive dep via axios). No new runtime dependencies added.
 * - compreface_image_id is stored in client_face_references so enrolled faces
 *   can be removed from CompreFace's subject database when deleted here.
 * - embedding column is now nullable; the 512-dim vector returned by the
 *   recognize endpoint (face_plugins=calculator) is stored per face-tag for
 *   the clustering step, which still uses cosine distance.
 * - clusterGalleryFaces() and saveFaceCrop() are unchanged — they do not depend
 *   on TF.js and work with any 512-dim Float32Array.
 */
const path = require('path');
const fs = require('fs');
const https = require('node:https');
const http = require('node:http');
const { URL } = require('url');
const sharp = require('sharp');
const pool = require('../db');
const { rowToCamel } = require('../db/utils');
const logger = require('../utils/logger');
const s3 = require('../config/s3');

// ── Constants ─────────────────────────────────────────────────────────────────

// ArcFace similarity threshold for matching faces to enrolled client references.
const MATCH_THRESHOLD = 0.35;

// Cosine distance threshold for anonymous face clustering (range [0,2]).
// InsightFace buffalo_l recommended clustering range: 0.35–0.45.
// 0.40 = standard face-clustering threshold per ArcFace paper.
const CLUSTER_THRESHOLD = 0.40;

// ── CompreFace HTTP helpers ───────────────────────────────────────────────────

/**
 * Build and send a multipart/form-data request to CompreFace.
 *
 * @param {string} method  HTTP method ('POST', 'DELETE', etc.)
 * @param {string} urlStr  Full URL including query string
 * @param {Buffer|null} fileBuffer  Image data to attach as the "file" field (or null)
 * @returns {Promise<object>}  Parsed JSON response body
 */
function compreFaceRequest(method, urlStr, fileBuffer) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    if (!fileBuffer) {
      // Plain JSON-style request with no body (e.g. DELETE)
      const options = {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {},
      };
      const req = transport.request(options, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          if (res.statusCode >= 400) {
            return reject(new Error(`CompreFace ${method} ${urlStr} → ${res.statusCode}: ${body}`));
          }
          try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
        });
        res.on('error', reject);
      });
      req.on('error', reject);
      req.end();
      return;
    }

    // Multipart form-data — build manually with a boundary to avoid adding deps.
    const boundary = `----CFBoundary${Date.now().toString(16)}`;
    const CRLF = '\r\n';
    const header = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="image.jpg"${CRLF}` +
      `Content-Type: image/jpeg${CRLF}${CRLF}`
    );
    const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
    const body = Buffer.concat([header, fileBuffer, footer]);

    const options = {
      method,
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) {
          return reject(new Error(`CompreFace ${method} ${urlStr} → ${res.statusCode}: ${raw}`));
        }
        try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function compreFaceBaseUrl() {
  return (process.env.FACE_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
}

function faceServiceJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const base = compreFaceBaseUrl();
    const parsed = new URL(base + urlPath);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const payload = JSON.stringify(body);

    const options = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) {
          return reject(new Error(`face-service POST ${urlPath} → ${res.statusCode}: ${raw}`));
        }
        try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Enrollment ────────────────────────────────────────────────────────────────

/**
 * Enroll a reference photo for a client in CompreFace, then persist the
 * returned image_id and the reference image path to Postgres.
 *
 * Throws { code: 'NO_FACE' } when CompreFace reports no face in the image.
 * Returns the stored reference record (camelCase).
 */
async function enrollClientReference(clientId, adminId, imageBuffer) {
  const base = compreFaceBaseUrl();
  const enrollUrl = `${base}/enroll?subject=${encodeURIComponent(clientId)}`;

  let cfResponse;
  try {
    cfResponse = await compreFaceRequest('POST', enrollUrl, imageBuffer);
  } catch (err) {
    // CompreFace returns a 400 with "No face is found" when detection fails.
    if (err.message && /no face/i.test(err.message)) {
      throw Object.assign(new Error('No face detected in reference photo'), { code: 'NO_FACE' });
    }
    throw err;
  }

  if (!cfResponse.image_id) {
    throw Object.assign(new Error('No face detected in reference photo'), { code: 'NO_FACE' });
  }

  const compreFaceImageId = cfResponse.image_id;

  // Persist the reference image locally / on S3 (identical to the old flow)
  const filename = `face-ref-${clientId}.jpg`;
  let imagePath;

  if (s3.isEnabled()) {
    const buffer = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer();
    imagePath = await s3.uploadBuffer(buffer, `admins/${adminId}/face-references/${filename}`, 'image/jpeg');
  } else {
    const refDir = path.join(__dirname, '../../uploads/face-references');
    if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });
    const dest = path.join(refDir, filename);
    await sharp(imageBuffer).jpeg({ quality: 85 }).toFile(dest);
    imagePath = `/uploads/face-references/${filename}`;
  }

  const { rows } = await pool.query(
    `INSERT INTO client_face_references
       (client_id, admin_id, image_path, compreface_image_id, embedding, model_version)
     VALUES ($1, $2, $3, $4, NULL, $5)
     ON CONFLICT (client_id) DO UPDATE
       SET image_path          = EXCLUDED.image_path,
           compreface_image_id = EXCLUDED.compreface_image_id,
           embedding           = NULL,
           model_version       = EXCLUDED.model_version,
           updated_at          = NOW()
     RETURNING *`,
    [clientId, adminId, imagePath, compreFaceImageId, 'insightface-arcface-v1']
  );

  return rowToCamel(rows[0]);
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteClientReference(clientId, adminId) {
  const base = compreFaceBaseUrl();
  const deleteUrl = `${base}/faces?subject=${encodeURIComponent(clientId)}`;

  try {
    await compreFaceRequest('DELETE', deleteUrl, null);
  } catch (err) {
    // Log but do not abort — if CompreFace has no record for this subject
    // (e.g. it was already removed or never enrolled) we still want to clean
    // up our local DB row.
    logger.warn(`[faceService] face-service delete subject ${clientId}: ${err.message}`);
  }

  const { rows } = await pool.query(
    'DELETE FROM client_face_references WHERE client_id = $1 AND admin_id = $2 RETURNING *',
    [clientId, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

// ── Get ───────────────────────────────────────────────────────────────────────

async function getClientReference(clientId, adminId) {
  const { rows } = await pool.query(
    'SELECT * FROM client_face_references WHERE client_id = $1 AND admin_id = $2',
    [clientId, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

// ── Face crop ─────────────────────────────────────────────────────────────────

/**
 * Cut a padded square crop around a detected face and store it.
 * normalizedBox coords are 0-1 relative to the image dimensions.
 * Returns the stored path, or null on failure.
 */
async function saveFaceCrop(imageBuffer, normalizedBox, galleryImageId, faceIndex, adminId) {
  try {
    const { info: rotInfo } = await sharp(imageBuffer).rotate().toBuffer({ resolveWithObject: true });
    const W = rotInfo.width;
    const H = rotInfo.height;

    const padFactor = 0.20;
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

// ── Cosine distance ───────────────────────────────────────────────────────────

/**
 * Cosine distance between two Float32Arrays. Range [0, 2], lower = more similar.
 * Used by clusterGalleryFaces() for anonymous face grouping.
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

// ── Face clustering ───────────────────────────────────────────────────────────

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

  const faces = rows.map(r => {
    const arr = Array.isArray(r.descriptor) ? r.descriptor : Object.values(r.descriptor);
    return { id: r.id, embedding: Array.from(arr) };
  });

  logger.info(`[faceService] clustering ${faces.length} faces via Chinese Whispers for gallery ${galleryId}`);

  let assignments;
  try {
    const result = await faceServiceJson('/cluster', { faces });
    assignments = result.assignments;
  } catch (err) {
    logger.warn(`[faceService] /cluster failed (${err.message}) — falling back to greedy clustering`);
    return _clusterGreedy(galleryId, rows, crypto);
  }

  // Map integer cluster_id → stable UUID for this gallery run
  const clusterUuids = new Map();
  const tagIds = [];
  const clusterIds = [];

  for (const { id, cluster_id } of assignments) {
    if (!clusterUuids.has(cluster_id)) clusterUuids.set(cluster_id, crypto.randomUUID());
    tagIds.push(id);
    clusterIds.push(clusterUuids.get(cluster_id));
  }

  await pool.query(
    `UPDATE gallery_image_face_tags t
     SET cluster_id = v.cluster_id
     FROM unnest($1::uuid[], $2::uuid[]) AS v(tag_id, cluster_id)
     WHERE t.id = v.tag_id`,
    [tagIds, clusterIds]
  );

  logger.info(`[faceService] CW: ${rows.length} faces → ${clusterUuids.size} clusters for gallery ${galleryId}`);
}

async function _clusterGreedy(galleryId, rows, crypto) {
  const clusters = [];
  const tagIds = [];
  const clusterIds = [];

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
      bestCluster.count++;
      for (let i = 0; i < bestCluster.centroid.length; i++) {
        bestCluster.centroid[i] += (descriptor[i] - bestCluster.centroid[i]) / bestCluster.count;
      }
      assignedId = bestCluster.id;
    } else {
      assignedId = crypto.randomUUID();
      clusters.push({ id: assignedId, centroid: new Float32Array(descriptor), count: 1 });
    }

    tagIds.push(row.id);
    clusterIds.push(assignedId);
  }

  await pool.query(
    `UPDATE gallery_image_face_tags t
     SET cluster_id = v.cluster_id
     FROM unnest($1::uuid[], $2::uuid[]) AS v(tag_id, cluster_id)
     WHERE t.id = v.tag_id`,
    [tagIds, clusterIds]
  );

  logger.info(`[faceService] greedy fallback: ${rows.length} faces → ${clusters.length} clusters for gallery ${galleryId}`);
}

// ── Per-image processing ──────────────────────────────────────────────────────

/**
 * Send one gallery image to CompreFace /recognize, write face tags to the DB.
 * Skips images that already have tags (idempotent).
 * Returns the number of client-matched faces.
 */
async function processImageForRecognition(galleryImageId, adminId) {
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
    const imgPath = img.path || img.thumbnail_path;
    if (!imgPath) {
      logger.warn(`[faceService] image ${galleryImageId}: no path or thumbnail_path in DB`);
      return 0;
    }

    logger.info(`[faceService] image ${galleryImageId}: reading from ${imgPath}`);

    const isRemote = imgPath.startsWith('http');
    const isS3Key  = s3.isEnabled() && !isRemote && !imgPath.startsWith('/');
    if (isRemote || isS3Key) {
      if (typeof s3.getReadStream === 'function') {
        const chunks = [];
        const stream = await s3.getReadStream(imgPath);
        for await (const chunk of stream) chunks.push(chunk);
        imageBuffer = Buffer.concat(chunks);
      } else {
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

  // Get image dimensions for bounding-box normalisation
  let imgWidth, imgHeight;
  try {
    const meta = await sharp(imageBuffer).rotate().metadata();
    imgWidth  = meta.width;
    imgHeight = meta.height;
  } catch (err) {
    logger.warn(`[faceService] could not read image dimensions ${galleryImageId}: ${err.message}`);
    return 0;
  }

  // Send to CompreFace recognize endpoint
  const base = compreFaceBaseUrl();
  const recognizeUrl = `${base}/recognize`;
  let cfResult;
  try {
    const cfResponse = await compreFaceRequest('POST', recognizeUrl, imageBuffer);
    cfResult = cfResponse.result || [];
  } catch (err) {
    logger.warn(`[faceService] CompreFace recognition failed for ${galleryImageId}: ${err.message}`);
    return 0;
  }

  if (cfResult.length === 0) {
    logger.info(`[faceService] image ${galleryImageId}: 0 faces detected`);
    return 0;
  }
  logger.info(`[faceService] image ${galleryImageId}: ${cfResult.length} face(s) detected`);

  let matchCount = 0;
  let faceIndex = 0;

  for (const face of cfResult) {
    const box = face.box || {};

    // Normalise absolute-pixel bounding box → 0-1 relative coords
    const normalizedBox = {
      x:      (box.x_min || 0) / imgWidth,
      y:      (box.y_min || 0) / imgHeight,
      width:  ((box.x_max || 0) - (box.x_min || 0)) / imgWidth,
      height: ((box.y_max || 0) - (box.y_min || 0)) / imgHeight,
    };

    const faceCropPath = await saveFaceCrop(imageBuffer, normalizedBox, galleryImageId, faceIndex, adminId);

    // Best subject match from CompreFace (subjects are sorted by similarity desc)
    const subjects = Array.isArray(face.subjects) ? face.subjects : [];
    const bestSubject = subjects.length > 0 ? subjects[0] : null;
    const isMatch = bestSubject && bestSubject.similarity >= MATCH_THRESHOLD;

    const matchedClientId = isMatch ? bestSubject.subject : null;
    const confidence      = isMatch ? bestSubject.similarity : (box.probability || 0);

    logger.info(
      `[faceService] image ${galleryImageId} face[${faceIndex}]: ` +
      `best_similarity=${bestSubject ? bestSubject.similarity.toFixed(4) : 'none'} ` +
      `threshold=${MATCH_THRESHOLD} → ${isMatch ? 'MATCHED ' + matchedClientId : 'no match'}`
    );

    // The 512-dim embedding from the calculator plugin — stored for clustering
    const embedding = Array.isArray(face.embedding) ? face.embedding : null;

    await pool.query(
      `INSERT INTO gallery_image_face_tags
         (gallery_image_id, client_id, admin_id, confidence, bounding_box, status, descriptor, face_crop_path)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)`,
      [
        galleryImageId,
        matchedClientId,
        adminId,
        confidence,
        JSON.stringify(normalizedBox),
        isMatch ? 'matched' : 'unmatched',
        embedding ? JSON.stringify(embedding) : null,
        faceCropPath,
      ]
    );

    if (isMatch) matchCount++;
    faceIndex++;
  }

  return matchCount;
}

// ── Batch processing ──────────────────────────────────────────────────────────

/**
 * Process a whole gallery batch — called from the worker handler.
 * Each image is sent to CompreFace serially to respect API rate limits and
 * keep memory usage flat (no in-process ML models to worry about).
 */
async function processGalleryBatch(galleryId, adminId, imageIds) {
  logger.info(`[faceService] gallery ${galleryId}: starting CompreFace batch for ${imageIds.length} image(s)`);

  await pool.query(
    `UPDATE face_recognition_jobs
     SET status = 'running', started_at = NOW()
     WHERE gallery_id = $1 AND status IN ('queued', 'cancelled')`,
    [galleryId]
  );

  let totalMatched = 0;

  for (let i = 0; i < imageIds.length; i++) {
    // Check for cancellation every 5 images
    if (i % 5 === 0) {
      const { rows: statusRows } = await pool.query(
        'SELECT status FROM face_recognition_jobs WHERE gallery_id = $1',
        [galleryId]
      );
      if (statusRows[0] && statusRows[0].status === 'cancelled') {
        logger.info(`[faceService] gallery ${galleryId}: job cancelled at image ${i}/${imageIds.length} — stopping early`);
        return 0;
      }
    }

    try {
      const matched = await processImageForRecognition(imageIds[i], adminId);
      totalMatched += matched;
    } catch (err) {
      logger.warn(`[faceService] error on image ${imageIds[i]}: ${err.message}`);
    }

    // Update progress every 10 images (and on last image)
    if (i % 10 === 0 || i === imageIds.length - 1) {
      await pool.query(
        `UPDATE face_recognition_jobs SET processed = $1, matched = $2 WHERE gallery_id = $3`,
        [i + 1, totalMatched, galleryId]
      );
    }
  }

  logger.info(`[faceService] gallery ${galleryId}: processed ${imageIds.length} images, ${totalMatched} client matches`);

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
  enrollClientReference,
  deleteClientReference,
  getClientReference,
  processGalleryBatch,
};
