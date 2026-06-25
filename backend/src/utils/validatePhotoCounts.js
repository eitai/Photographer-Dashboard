/**
 * Enforces a product's photo-selection requirements.
 * min_photos / max_photos semantics: 0 = no bound on that side.
 *
 * @param {{ name?: string, minPhotos?: number, maxPhotos?: number,
 *           min_photos?: number, max_photos?: number }} product
 * @param {number} selectedCount
 * @throws {Error & { status: 422 }} when the count violates the requirement
 */
function checkPhotoCount(product, selectedCount) {
  const min = product.minPhotos ?? product.min_photos ?? 0;
  const max = product.maxPhotos ?? product.max_photos ?? 0;
  const name = product.name || 'product';

  if (min > 0 && selectedCount < min) {
    const err = new Error(`"${name}" requires at least ${min} photo(s) — ${selectedCount} selected`);
    err.status = 422;
    throw err;
  }
  if (max > 0 && selectedCount > max) {
    const err = new Error(`"${name}" allows at most ${max} photo(s) — ${selectedCount} selected`);
    err.status = 422;
    throw err;
  }
}

module.exports = { checkPhotoCount };
