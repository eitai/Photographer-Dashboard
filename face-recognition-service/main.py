"""
Face recognition microservice — InsightFace ArcFace (buffalo_l).

Runs as a FastAPI service on port 8001 alongside the Node.js backend.
Embeddings are persisted to disk (FACE_STORAGE_PATH) and survive restarts.

Endpoints:
  POST   /enroll?subject=<uuid>  — enroll a client face
  POST   /recognize              — detect and match all faces in an image
  DELETE /faces?subject=<uuid>   — remove an enrolled subject
  GET    /health                 — liveness check
"""
import asyncio
import io
import os
import pickle
import random
import tempfile
import uuid

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from insightface.app import FaceAnalysis
from PIL import Image, ImageOps

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

STORAGE_PATH = os.environ.get(
    "FACE_STORAGE_PATH",
    os.path.join(os.path.dirname(__file__), "data", "embeddings.pkl"),
)

# ---------------------------------------------------------------------------
# App + globals
# ---------------------------------------------------------------------------

app = FastAPI(title="Face Recognition Service")

face_app: FaceAnalysis | None = None

# subject_id (str) → {"image_ids": list[str], "embeddings": list[np.ndarray (normed, 512-dim)]}
db: dict = {}
db_lock = asyncio.Lock()

# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def load_db() -> None:
    global db
    if os.path.exists(STORAGE_PATH):
        try:
            with open(STORAGE_PATH, "rb") as f:
                db = pickle.load(f)
        except Exception as exc:
            print(f"[face-service] WARNING: could not load embeddings: {exc} — starting empty")
            db = {}
    else:
        db = {}


def save_db() -> None:
    """Atomic write via temp-file + rename to prevent corruption on crash."""
    dirpath = os.path.dirname(STORAGE_PATH) or "."
    os.makedirs(dirpath, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=dirpath, prefix=".emb_tmp_")
    try:
        with os.fdopen(fd, "wb") as f:
            pickle.dump(db, f, protocol=pickle.HIGHEST_PROTOCOL)
        os.replace(tmp_path, STORAGE_PATH)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise

# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def decode_image(data: bytes) -> np.ndarray:
    """Decode image bytes to BGR numpy array for InsightFace.
    exif_transpose ensures orientation matches what Sharp sees with .rotate()."""
    pil_img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)


def normalize_lighting(img_bgr: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE on the L channel (LAB color space) to normalize
    lighting differences — harsh outdoor sun vs. soft indoor light.
    Returns a new BGR image with equalized luminance.
    """
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l)
    lab_eq = cv2.merge([l_eq, a, b])
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a)) * float(np.linalg.norm(b)) + 1e-8
    return float(np.dot(a, b) / denom)


def iou(box_a: list, box_b: list) -> float:
    """Intersection over Union for two [x1,y1,x2,y2] boxes."""
    xa = max(box_a[0], box_b[0])
    ya = max(box_a[1], box_b[1])
    xb = min(box_a[2], box_b[2])
    yb = min(box_a[3], box_b[3])
    inter = max(0, xb - xa) * max(0, yb - ya)
    area_a = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
    area_b = (box_b[2] - box_b[0]) * (box_b[3] - box_b[1])
    union = area_a + area_b - inter + 1e-8
    return inter / union


def _has_skin_tone(img_bgr: np.ndarray, face) -> bool:
    """
    Two-part check:
    1. ≥ 10% of the face bbox has skin-like HSV values.
    2. The central skin region is NOT highly textured (filters patterned fabrics).
       Patterned fabric (honeycomb, scales, lace) has sharp repeating edges →
       high Laplacian variance even where colors look skin-like.
       Real skin has smooth local texture → low Laplacian variance in the cheek area.
    """
    H_img, W_img = img_bgr.shape[:2]
    x1 = max(0, int(face.bbox[0]))
    y1 = max(0, int(face.bbox[1]))
    x2 = min(W_img, int(face.bbox[2]))
    y2 = min(H_img, int(face.bbox[3]))
    if x2 <= x1 or y2 <= y1:
        return False
    roi = img_bgr[y1:y2, x1:x2]
    if roi.size == 0:
        return False
    h, w = roi.shape[:2]

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    # Warm skin hues — S_min=15 keeps very pale skin; V_min=40 keeps dark skin.
    m1 = cv2.inRange(hsv, np.array([0,  15, 40], np.uint8),
                          np.array([25, 210, 255], np.uint8))
    m2 = cv2.inRange(hsv, np.array([160, 15, 40], np.uint8),
                          np.array([180, 210, 255], np.uint8))
    total_px = h * w
    skin_ratio = (int(cv2.countNonZero(m1)) + int(cv2.countNonZero(m2))) / total_px
    if skin_ratio < 0.10:
        return False

    # Skin-at-edge check: compute median Sobel gradient magnitude AT skin-colored pixels.
    # Real face skin: smooth region → skin pixels are far from edges → low median gradient.
    # Mesh / knit / lace fabric: skin visible THROUGH holes → each skin pixel is
    #   immediately adjacent to a high-contrast fabric thread → high median gradient.
    skin_mask_u8 = cv2.bitwise_or(m1, m2)
    skin_px_count = int(cv2.countNonZero(skin_mask_u8))
    if skin_px_count >= 30:
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        sx = cv2.Sobel(gray_roi, cv2.CV_32F, 1, 0, ksize=3)
        sy = cv2.Sobel(gray_roi, cv2.CV_32F, 0, 1, ksize=3)
        grad_mag = np.sqrt(sx ** 2 + sy ** 2)
        # Median gradient of skin-coloured pixels only
        skin_gradients = grad_mag[skin_mask_u8 > 0]
        if float(np.median(skin_gradients)) > 22.0:
            return False

    return True


def deduplicate_faces(faces: list, img_bgr: np.ndarray,
                      iou_thresh: float = 0.35,
                      emb_sim_thresh: float = 0.68,
                      relative_size_thresh: float = 0.04,
                      min_det_score: float = 0.72) -> list:
    """
    Remove duplicate and background face detections.
    - relative_size_thresh: face area must be >= this fraction of the LARGEST face in the image.
      0.04 allows up to ~25x size difference — handles crowd shots where background faces
      are much smaller than foreground faces.
    - min_det_score: InsightFace confidence floor. Lower values catch partially occluded faces.
    - Keypoint validity check: filters back-of-head and extreme profiles by verifying
      that the 5 facial landmarks are spread vertically across the bounding box.
    1. IoU-based NMS — catches overlapping boxes
    2. Embedding similarity — catches same face detected twice (hat/angle offset)
    """
    def _valid_keypoints(face) -> bool:
        """
        Validate facial geometry using InsightFace's 5 keypoints:
        [left_eye, right_eye, nose, left_mouth, right_mouth]
        Rejects tattoos, backs of heads, torsos, and extreme profiles.
        """
        kps = face.kps
        if kps is None or len(kps) < 5:
            return True  # no keypoints — don't filter
        le, re, nose, lm, rm = [kps[i] for i in range(5)]
        bbox_x1 = float(face.bbox[0])
        bbox_y1 = float(face.bbox[1])
        bbox_w  = float(face.bbox[2] - face.bbox[0])
        bbox_h  = float(face.bbox[3] - face.bbox[1])

        le_x,  le_y  = float(le[0]),  float(le[1])
        re_x,  re_y  = float(re[0]),  float(re[1])
        nose_x, nose_y = float(nose[0]), float(nose[1])
        lm_x,  lm_y  = float(lm[0]),  float(lm[1])
        rm_x,  rm_y  = float(rm[0]),  float(rm[1])

        eye_avg_y   = (le_y + re_y) / 2
        mouth_avg_y = (lm_y + rm_y) / 2

        # 1. Anatomical order: eyes above nose above mouth
        if not (eye_avg_y < nose_y < mouth_avg_y):
            return False

        # 2. Vertical span of all keypoints must cover ≥ 25% of bbox height
        ys = [le_y, re_y, nose_y, lm_y, rm_y]
        if (max(ys) - min(ys)) < bbox_h * 0.25:
            return False

        # 3. Eyes must be separated horizontally ≥ 20% of bbox width
        #    (filters extreme profiles and tattoo-text like "ON")
        if abs(re_x - le_x) < bbox_w * 0.20:
            return False

        # 4. Nose must fall horizontally between the eyes (± 30% slack)
        #    Rejects torso detections where landmarks scatter randomly
        eye_min_x = min(le_x, re_x) - bbox_w * 0.30
        eye_max_x = max(le_x, re_x) + bbox_w * 0.30
        if not (eye_min_x < nose_x < eye_max_x):
            return False

        # 5. Mouth corners must be separated ≥ 15% of bbox width
        #    Rejects compressed / garbled landmark sets (backs of head, clothing patterns)
        if abs(rm_x - lm_x) < bbox_w * 0.15:
            return False

        # 6. Eyes must sit in the upper portion of the bbox (< 55% down)
        #    Mouth must sit in the lower portion (> 45% down)
        #    Rejects upside-down and extreme off-angle detections
        eye_y_norm   = (eye_avg_y   - bbox_y1) / bbox_h
        mouth_y_norm = (mouth_avg_y - bbox_y1) / bbox_h
        if eye_y_norm > 0.55 or mouth_y_norm < 0.45:
            return False

        return True

    # Filter by confidence score, keypoint geometry, and skin-tone presence
    valid = []
    for f in faces:
        if float(f.det_score) < min_det_score:
            continue
        if not _valid_keypoints(f):
            continue
        if not _has_skin_tone(img_bgr, f):
            continue
        valid.append(f)

    if not valid:
        return []

    # Absolute minimum face size: faces smaller than 50×50 px produce unusable crops
    valid = [f for f in valid
             if (f.bbox[2] - f.bbox[0]) >= 50 and (f.bbox[3] - f.bbox[1]) >= 50]

    if not valid:
        return []

    # Relative size filter: keep faces that are ≥ 4% of the largest face's area
    areas = [(f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]) for f in valid]
    max_area = max(areas)
    valid = [f for f, a in zip(valid, areas) if a >= max_area * relative_size_thresh]

    # Sort by detection confidence descending — always keep the more confident one
    valid.sort(key=lambda f: float(f.det_score), reverse=True)

    kept = []
    for f in valid:
        b = f.bbox
        box = [b[0], b[1], b[2], b[3]]

        is_duplicate = False
        for k in kept:
            # Strategy 1: bounding-box overlap
            if iou(box, [k.bbox[0], k.bbox[1], k.bbox[2], k.bbox[3]]) > iou_thresh:
                is_duplicate = True
                break
            # Strategy 2: embedding similarity (same face, different box due to hat/angle)
            if f.normed_embedding is not None and k.normed_embedding is not None:
                if cosine_similarity(f.normed_embedding, k.normed_embedding) > emb_sim_thresh:
                    is_duplicate = True
                    break

        if not is_duplicate:
            kept.append(f)

    return kept

# ---------------------------------------------------------------------------
# Chinese Whispers clustering
# ---------------------------------------------------------------------------

def _chinese_whispers(embeddings: list, threshold: float = 0.50, iterations: int = 20) -> list:
    """
    Chinese Whispers graph clustering for face embeddings.
    Each node starts with its own label; neighbors vote on labels weighted by
    cosine similarity. Converges without a fixed cluster count.
    threshold: cosine similarity above which two faces are considered connected.
    """
    n = len(embeddings)
    if n == 0:
        return []
    if n == 1:
        return [0]

    # Build adjacency list: neighbors[i] = [(j, similarity), ...]
    neighbors: list[list] = [[] for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            sim = cosine_similarity(embeddings[i], embeddings[j])
            if sim >= threshold:
                neighbors[i].append((j, sim))
                neighbors[j].append((i, sim))

    labels = list(range(n))

    for _ in range(iterations):
        nodes = list(range(n))
        random.shuffle(nodes)
        changed = False
        for node in nodes:
            if not neighbors[node]:
                continue
            votes: dict[int, float] = {}
            for nb, sim in neighbors[node]:
                lbl = labels[nb]
                votes[lbl] = votes.get(lbl, 0.0) + sim
            best = max(votes, key=votes.get)
            if labels[node] != best:
                labels[node] = best
                changed = True
        if not changed:
            break

    # Remap arbitrary label values → sequential cluster IDs starting at 0
    label_map: dict[int, int] = {}
    cluster_id = 0
    result = []
    for lbl in labels:
        if lbl not in label_map:
            label_map[lbl] = cluster_id
            cluster_id += 1
        result.append(label_map[lbl])

    return result

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup() -> None:
    global face_app
    face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    face_app.prepare(ctx_id=0, det_size=(640, 640))
    load_db()
    print(f"[face-service] ready — {len(db)} enrolled subjects loaded")

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/enroll")
async def enroll(
    file: UploadFile = File(...),
    subject: str = Query(..., description="Client UUID"),
) -> JSONResponse:
    data = await file.read()
    try:
        img = decode_image(data)
        img = normalize_lighting(img)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot decode image: {exc}")

    faces = face_app.get(img)
    if not faces:
        raise HTTPException(status_code=422, detail="No face detected in image")

    best = max(faces, key=lambda f: float(f.det_score))
    image_id = str(uuid.uuid4())

    async with db_lock:
        entry = db.get(subject, {"image_ids": [], "embeddings": []})
        # Migrate legacy single-embedding format
        if "embedding" in entry:
            entry = {"image_ids": [entry["image_id"]], "embeddings": [entry["embedding"]]}
        entry["image_ids"].append(image_id)
        entry["embeddings"].append(best.normed_embedding.copy())
        db[subject] = entry
        save_db()

    return JSONResponse({"image_id": image_id, "subject": subject, "total_refs": len(db[subject]["embeddings"])})


@app.post("/recognize")
async def recognize(file: UploadFile = File(...)) -> JSONResponse:
    data = await file.read()
    try:
        img = decode_image(data)
        img = normalize_lighting(img)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot decode image: {exc}")

    faces = face_app.get(img)
    if not faces:
        return JSONResponse({"result": []})

    faces = deduplicate_faces(faces, img)
    if not faces:
        return JSONResponse({"result": []})

    async with db_lock:
        snapshot = {sid: entry for sid, entry in db.items()}

    result = []
    for face in faces:
        bbox = face.bbox
        box = {
            "x_min": int(bbox[0]),
            "y_min": int(bbox[1]),
            "x_max": int(bbox[2]),
            "y_max": int(bbox[3]),
            "probability": float(face.det_score),
        }

        subjects = []
        for sid, entry in snapshot.items():
            embs = entry if isinstance(entry, list) else entry.get("embeddings", [entry.get("embedding")])
            best_sim = max(cosine_similarity(face.normed_embedding, e) for e in embs if e is not None)
            subjects.append({"subject": sid, "similarity": round(best_sim, 6)})
        subjects.sort(key=lambda x: x["similarity"], reverse=True)

        result.append({
            "box": box,
            "subjects": subjects,
            "embedding": face.embedding.tolist(),
        })

    return JSONResponse({"result": result})


@app.delete("/faces")
async def delete_faces(subject: str = Query(...)) -> JSONResponse:
    async with db_lock:
        db.pop(subject, None)
        save_db()
    return JSONResponse({"deleted": True})


@app.get("/health")
async def health() -> JSONResponse:
    total_refs = sum(
        len(e.get("embeddings", [e.get("embedding")])) if isinstance(e, dict) else 1
        for e in db.values()
    )
    return JSONResponse({"status": "ok", "enrolled": len(db), "total_refs": total_refs})


@app.post("/cluster")
async def cluster_faces(request: Request) -> JSONResponse:
    """
    Chinese Whispers clustering for a batch of face embeddings.
    Body: {"faces": [{"id": "<uuid>", "embedding": [512 floats]}, ...]}
    Returns: {"assignments": [{"id": "<uuid>", "cluster_id": 0}, ...]}
    Isolated nodes (no similar neighbours) each get their own cluster_id.
    """
    body = await request.json()
    faces = body.get("faces", [])

    if not faces:
        return JSONResponse({"assignments": []})

    ids = [f["id"] for f in faces]
    embeddings = [np.array(f["embedding"], dtype=np.float32) for f in faces]

    cluster_ids = _chinese_whispers(embeddings, threshold=0.45, iterations=20)

    assignments = [{"id": ids[i], "cluster_id": cluster_ids[i]} for i in range(len(ids))]
    return JSONResponse({"assignments": assignments})
