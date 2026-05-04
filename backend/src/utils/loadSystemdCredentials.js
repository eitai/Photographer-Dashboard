'use strict';

/**
 * loadSystemdCredentials
 *
 * Reads files from systemd's $CREDENTIALS_DIRECTORY (one file per secret,
 * mounted via `LoadCredential=` in the unit file) and projects each file's
 * contents into process.env under its UPPERCASED filename.
 *
 * Example:
 *   /etc/photo/secrets/aws_secret_access_key   (on disk, mode 0400 root:root)
 *     -> systemd LoadCredential mounts to $CREDENTIALS_DIRECTORY/aws_secret_access_key
 *     -> this helper sets process.env.AWS_SECRET_ACCESS_KEY = <file contents>
 *
 * Wiring:
 *   - Call this once at the very top of every entry point that reads secrets,
 *     before anything else touches process.env. Today that's:
 *       backend/server.js
 *       backend/src/workers/index.js
 *
 *     // first line of file:
 *     require('./src/utils/loadSystemdCredentials').loadSystemdCredentials();
 *     //                                       ^ adjust path from workers entry
 *
 * Behavior:
 *   - If $CREDENTIALS_DIRECTORY is unset (local dev, tests), this is a no-op
 *     and existing .env / shell env handling continues to work unchanged.
 *   - If a corresponding env var is already set (explicit override), the
 *     existing value wins — the helper only fills holes.
 *   - Trailing whitespace / final newline in the credential file is trimmed.
 *
 * Errors:
 *   - Unreadable directory or file is fatal: we throw. A worker / API that
 *     can't read its own secrets must not silently boot with empty values.
 */

const fs = require('node:fs');
const path = require('node:path');

function loadSystemdCredentials() {
  const dir = process.env.CREDENTIALS_DIRECTORY;
  if (!dir) {
    // Not running under systemd with LoadCredential=. Local dev path.
    return { loaded: 0, skipped: 0, source: 'none' };
  }

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    throw new Error(
      `loadSystemdCredentials: cannot read CREDENTIALS_DIRECTORY=${dir}: ${err.message}`
    );
  }

  let loaded = 0;
  let skipped = 0;

  for (const name of entries) {
    const envName = name.toUpperCase();

    if (Object.prototype.hasOwnProperty.call(process.env, envName) &&
        process.env[envName] !== '') {
      // Explicit env (test harness, local override) wins.
      skipped += 1;
      continue;
    }

    let value;
    try {
      value = fs.readFileSync(path.join(dir, name), 'utf8');
    } catch (err) {
      throw new Error(
        `loadSystemdCredentials: cannot read credential ${name}: ${err.message}`
      );
    }

    // Strip a single trailing newline / surrounding whitespace. Don't strip
    // internal whitespace — secrets may legitimately contain spaces.
    process.env[envName] = value.replace(/\s+$/u, '');
    loaded += 1;
  }

  return { loaded, skipped, source: dir };
}

module.exports = { loadSystemdCredentials };
