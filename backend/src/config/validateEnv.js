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

  const isProd = env.NODE_ENV === 'production';
  if (isProd) {
    // Payments: webhooks now fail-closed without the secret, and links can't be
    // generated without the API/page UIDs — surface misconfiguration at boot.
    for (const k of ['PAYPLUS_API_KEY', 'PAYPLUS_SECRET_KEY', 'PAYPLUS_PAYMENT_PAGE_UID']) {
      if (!env[k]) warnings.push(`${k} is not set — PayPlus payments will not work in production`);
    }
    // PayPlus callbacks are sent to BACKEND_URL; a localhost default is never valid in prod.
    if (!env.BACKEND_URL || /localhost|127\.0\.0\.1/.test(env.BACKEND_URL)) {
      warnings.push('BACKEND_URL is missing or points at localhost — PayPlus callbacks will fail in production');
    }
    // Object storage: when a bucket is configured, the credentials must be too.
    if (env.S3_BUCKET && (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY)) {
      warnings.push('S3_BUCKET is set but AWS credentials are missing — uploads will fall back to local disk');
    }
    if (!env.S3_BUCKET) {
      warnings.push('S3_BUCKET is not set — uploads use local disk, which does not work across multiple instances');
    }
    // Email: gallery links / receipts silently no-op without SMTP.
    if (!env.SMTP_USER || !env.SMTP_PASS) {
      warnings.push('SMTP_USER/SMTP_PASS not set — email notifications will be disabled');
    }
    // JWT secret strength (placeholder from .env.example would pass the presence check).
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET is shorter than 32 characters — use a stronger secret in production');
    }
  }

  return { ok: missing.length === 0, missing, warnings };
}

module.exports = { validateEnv, REQUIRED };
