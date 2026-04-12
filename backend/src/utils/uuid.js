/**
 * Matches a standard UUID v4 string (32 hex digits + 4 hyphens, 36 chars total).
 * Use to validate :id route params before hitting the database.
 */
const UUID_RE = /^[0-9a-f-]{36}$/i;

module.exports = { UUID_RE };
