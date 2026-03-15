/**
 * Wraps an async route handler and forwards any thrown error to Express's
 * next(err) — so we never need try/catch boilerplate in every route.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
