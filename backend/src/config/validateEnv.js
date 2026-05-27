/**
 * Validates required environment variables on startup.
 * Extracted so it can be unit-tested independently of server.js.
 */
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'];

/**
 * Optional variables that trigger a warning (not a fatal error) when
 * partially configured.
 */
function validateEnv(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);

  const warnings = [];
  if (!env.FACE_SERVICE_URL) {
    warnings.push('FACE_SERVICE_URL is not set — using default http://127.0.0.1:8001');
  }

  return { ok: missing.length === 0, missing, warnings };
}

module.exports = { validateEnv, REQUIRED };
