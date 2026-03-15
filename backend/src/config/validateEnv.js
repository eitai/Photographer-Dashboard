/**
 * Validates required environment variables on startup.
 * Extracted so it can be unit-tested independently of server.js.
 */
const REQUIRED = ['MONGO_URI', 'JWT_SECRET', 'FRONTEND_URL'];

function validateEnv(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);
  return { ok: missing.length === 0, missing };
}

module.exports = { validateEnv, REQUIRED };
