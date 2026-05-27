# Photographer-Dashboard — Production Ops Runbook

This directory contains everything ops needs to install, run, deploy, and rotate
secrets for the Photographer-Dashboard API and compression worker on a single
Linux box (Debian/Ubuntu, no Docker, no Helm). Read it top-to-bottom on first
setup.

---

## 0. CRITICAL: Rotate leaked Wasabi credentials FIRST

The Wasabi production access key + secret were pasted into chat and must be
treated as compromised. **Before doing anything else:**

1. Log in to the Wasabi console -> IAM -> Users -> your app user -> Security
   credentials.
2. Create a new access key.
3. Disable (do NOT delete yet) the leaked key. Keep it disabled for 24h while
   verifying the new key works, then delete.
4. Use only the *new* key in `/etc/photo/secrets/aws_access_key_id` and
   `/etc/photo/secrets/aws_secret_access_key` below. Never paste either value
   into chat, tickets, or commits.
5. Run a `git log -p -S "<first 8 chars of leaked key>"` on the repo to confirm
   the leaked key was never committed. If it was, file an incident, rotate
   again, and rewrite history.

The rest of this document assumes the new key is in hand.

---

## 1. Initial host setup

Tested target: Debian 12 / Ubuntu 22.04 LTS x86_64.

### 1.1 Install OS packages

```bash
sudo apt-get update
sudo apt-get install -y \
  curl ca-certificates coreutils tar xz-utils \
  postgresql-client \
  git \
  jq
```

Node.js 20 LTS (NodeSource — pinned major version):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # expect v20.x
```

### 1.2 Create the service user

```bash
sudo useradd -r -s /bin/false -d /var/lib/photo photo
```

`-r` makes it a system account, `-s /bin/false` disables interactive login.

### 1.3 Create directory layout

```bash
sudo mkdir -p /opt/photo                  # repo checkout (read-only at runtime)
sudo mkdir -p /etc/photo                  # non-secret env file
sudo mkdir -p /etc/photo/secrets          # one file per secret, mode 0400 root
sudo mkdir -p /var/lib/photo              # writable working dir (tmp, queue spool)
sudo mkdir -p /var/log/photo              # log overflow if anything escapes journald

sudo chown -R photo:photo /var/lib/photo /var/log/photo
sudo chown -R root:root  /etc/photo /etc/photo/secrets
sudo chmod 0750 /etc/photo
sudo chmod 0700 /etc/photo/secrets
```

### 1.4 Clone the repo

```bash
sudo -u photo git clone https://github.com/<org>/Photographer-Dashboard.git /opt/photo
cd /opt/photo
sudo -u photo git checkout main
```

Repo lives in `/opt/photo`. The app reads it as `photo`. Ops (you) owns
`/etc/photo/*` as root.

---

## 2. Bootstrap pinned binaries

The compression worker shells out to `cjxl`, `djxl`, and `oxipng`. These are
NOT installed via `apt` because the Debian/Ubuntu versions are too old / move
on us. Instead we pin specific GitHub release assets by SHA-256 and install
them as `/usr/local/bin/photo-<name>`.

| Binary           | Source                                                           | Pin strategy                       | Pinned version (Q1 2026) |
|------------------|------------------------------------------------------------------|------------------------------------|--------------------------|
| `photo-cjxl`     | libjxl GitHub release (`jxl-linux-x86_64-static-vX.Y.Z.tar.gz`)  | URL + SHA-256 of tarball           | libjxl 0.11.1            |
| `photo-djxl`     | libjxl GitHub release (same tarball as `photo-cjxl`)             | Inherits SHA from libjxl tarball   | libjxl 0.11.1            |
| `photo-oxipng`   | oxipng GitHub release (musl static)                              | URL + SHA-256 of tarball           | oxipng 9.1.5             |

### Running it

```bash
sudo bash /opt/photo/ops/bootstrap.sh
```

The script:
- Refuses to run if not root.
- Refuses to run if any `EXPECTED_SHA256_*` placeholder is still present.
- Downloads each release asset, verifies SHA-256, extracts, copies the binary
  to `/usr/local/bin/photo-<name>`, runs `--version`, and asserts the version
  matches the pinned prefix.
- For libjxl: downloads the tarball ONCE and installs both `photo-cjxl` and
  `photo-djxl` from the same verified bytes, so the two binaries can never
  drift out of sync if upstream rotates a release asset between calls.
- Is idempotent — already-installed pinned versions are skipped.

**Before first run, ops must edit `bootstrap.sh` and replace every
`EXPECTED_SHA256_PLACEHOLDER_REPLACE_BEFORE_USE` with the real SHA-256 from the
release page** (and confirm the URLs still resolve). Compute the hash locally:

```bash
curl -fsSL <url> | sha256sum
```

After bootstrap, verify:

```bash
/usr/local/bin/photo-cjxl     --version
/usr/local/bin/photo-djxl     --version
/usr/local/bin/photo-oxipng   --version
```

The worker code calls these by absolute path, so any system `apt`-managed
versions (if any) will not interfere.

---

## 3. Configure secrets

### 3.1 Non-secret environment

`/etc/photo/env` (mode 0644, owner root) — referenced by both systemd units via
`EnvironmentFile=`. Contains everything that is **not** a secret:

```ini
NODE_ENV=production
PORT=5000

# Database connection (no password; that comes from /etc/photo/secrets/database_password)
DATABASE_URL=postgres://photo@localhost:5432/photo
# If your pg auth requires the password in-line, prefer building the URL in app
# code from DATABASE_PASSWORD instead of putting it here.

# Wasabi
S3_BUCKET=photo-prod
S3_REGION=eu-central-1
S3_ENDPOINT=https://s3.eu-central-1.wasabisys.com
S3_PUBLIC_URL=https://download.example.com

# Compression worker
WORKER_CONCURRENCY=2
EXPECTED_CJXL_VERSION=0.11

# Pinned binary paths (worker should prefer these over PATH lookups)
PHOTO_CJXL_BIN=/usr/local/bin/photo-cjxl
PHOTO_DJXL_BIN=/usr/local/bin/photo-djxl
PHOTO_OXIPNG_BIN=/usr/local/bin/photo-oxipng
```

```bash
sudo install -m 0644 -o root -g root /dev/stdin /etc/photo/env <<'EOF'
# (paste the block above)
EOF
```

### 3.2 Secrets — one file per value

Each secret goes into its own file under `/etc/photo/secrets/`, mode `0400`,
owned by `root`. The systemd units mount these via `LoadCredential=`, which
copies them into a per-service tmpfs at `$CREDENTIALS_DIRECTORY` readable by
the service user (`photo`). The files on disk stay root-only.

Do this once per secret. Use a here-doc with no leading whitespace and no
trailing newline noise — `printf '%s'` keeps things tight:

```bash
# ---- ROTATE THESE FIRST (see section 0) ----
sudo install -m 0400 -o root -g root /dev/stdin /etc/photo/secrets/aws_access_key_id     <<<"<NEW_WASABI_ACCESS_KEY_ID>"
sudo install -m 0400 -o root -g root /dev/stdin /etc/photo/secrets/aws_secret_access_key <<<"<NEW_WASABI_SECRET_ACCESS_KEY>"

# JWT
sudo install -m 0400 -o root -g root /dev/stdin /etc/photo/secrets/jwt_secret            <<<"<RANDOM_64_BYTE_HEX>"

# DB password
sudo install -m 0400 -o root -g root /dev/stdin /etc/photo/secrets/database_password     <<<"<POSTGRES_PASSWORD>"
```

To generate a JWT secret:

```bash
openssl rand -hex 32
```

Verify perms:

```bash
sudo ls -l /etc/photo/secrets
# -r-------- 1 root root ... aws_access_key_id
# -r-------- 1 root root ... aws_secret_access_key
# -r-------- 1 root root ... jwt_secret
# -r-------- 1 root root ... database_password
```

### 3.3 How the app reads them

systemd `LoadCredential=name:/path/to/file` mounts the file at
`$CREDENTIALS_DIRECTORY/name` inside the service. The helper at
`backend/src/utils/loadSystemdCredentials.js` reads every file in that
directory and projects it into `process.env.<UPPER_NAME>`, e.g.
`aws_secret_access_key` -> `process.env.AWS_SECRET_ACCESS_KEY`.

**Backend wiring (one-liner the app team needs to add to both entry points):**

```js
// At the very top of backend/server.js and backend/src/workers/index.js,
// before any code that reads process.env.AWS_*, JWT_SECRET, DATABASE_PASSWORD:
require('./src/utils/loadSystemdCredentials').loadSystemdCredentials();
// (path adjusts to '../utils/loadSystemdCredentials' from the workers entry)
```

Explicit `process.env.X` set by something else (test, `.env.local`) wins over
the credential file — the helper only fills missing values. This keeps local
dev with `.env` working unchanged.

---

## 4. Install the systemd services

```bash
sudo cp /opt/photo/ops/systemd/photo-api.service    /etc/systemd/system/
sudo cp /opt/photo/ops/systemd/photo-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now photo-api photo-worker
sudo systemctl status photo-api photo-worker
```

Both units run as `photo:photo`, with the hardening directives below. Logs go
to journald (`journalctl -u photo-api -f`).

The first start of `photo-api` will create / migrate the database schema (the
app handles migrations on boot — see `backend/src/db/`).

---

## 5. Wasabi bucket configuration

These steps happen once, in the Wasabi console (or via `aws --endpoint-url`
CLI). They are NOT automated because they require human review.

### 5.1 Lifecycle: abort incomplete multipart uploads after 2 days

**Console:** bucket -> Settings -> Lifecycle -> Add rule
- Name: `abort-incomplete-multipart`
- Scope: whole bucket
- Action: *Cancel incomplete multipart uploads*
- Days after upload start: **2**

**CLI equivalent:**

```bash
aws --endpoint-url=https://s3.eu-central-1.wasabisys.com \
    s3api put-bucket-lifecycle-configuration \
    --bucket photo-prod \
    --lifecycle-configuration '{
      "Rules": [{
        "ID": "abort-incomplete-multipart",
        "Status": "Enabled",
        "Filter": {},
        "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 2 }
      }]
    }'
```

### 5.2 Object Lock — governance mode, 30-day default retention

Object Lock can only be enabled at bucket creation in Wasabi. If your bucket
predates this, you must create a new bucket with Object Lock enabled and
migrate. After Object Lock is on:

**Console:** bucket -> Settings -> Object Lock -> Enable default retention
- Mode: **Governance**
- Retention: **30 days**

**CLI:**

```bash
aws --endpoint-url=https://s3.eu-central-1.wasabisys.com \
    s3api put-object-lock-configuration \
    --bucket photo-prod \
    --object-lock-configuration '{
      "ObjectLockEnabled": "Enabled",
      "Rule": {
        "DefaultRetention": {
          "Mode": "GOVERNANCE",
          "Days": 30
        }
      }
    }'
```

Governance mode lets a privileged user override retention if absolutely
needed (`s3:BypassGovernanceRetention`); compliance mode is irrevocable. We
choose governance to allow operator escape hatches.

### 5.3 CORS — must expose `ETag`

Multipart upload from the browser reads the `ETag` header on each part PUT.
S3-style services do not expose `ETag` to JS by default; we must list it in
`ExposeHeaders`.

**CLI:**

```bash
aws --endpoint-url=https://s3.eu-central-1.wasabisys.com \
    s3api put-bucket-cors --bucket photo-prod --cors-configuration '{
      "CORSRules": [{
        "AllowedOrigins": ["https://app.example.com"],
        "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag", "x-amz-version-id"],
        "MaxAgeSeconds": 3000
      }]
    }'
```

If the frontend reads parts via JS (`xhr.getResponseHeader('ETag')`) and gets
`null`, `ExposeHeaders: ETag` is missing — fix this first before debugging
anything else.

### 5.4 IAM policy

See `ops/wasabi-iam-policy.example.json`. Replace
`REPLACE_WITH_BOX_OUTBOUND_IP/32` with the actual outbound IP of the prod box
(see comments in that file).

### 5.5 DNS — bypass Cloudflare for object traffic

Cloudflare's free/pro plans cap responses at ~100 MB. Multi-GB photo
downloads must go direct to Wasabi.

In Cloudflare DNS, create:

| Type  | Name              | Target                                | Proxy   |
|-------|-------------------|---------------------------------------|---------|
| CNAME | `uploads`         | `s3.eu-central-1.wasabisys.com`       | DNS only (grey cloud) |
| CNAME | `download`        | `s3.eu-central-1.wasabisys.com`       | DNS only (grey cloud) |

Both records must be **DNS-only** (grey cloud, NOT orange). The app's
`S3_ENDPOINT` and `S3_PUBLIC_URL` should point to these names so we can change
storage providers later without touching client code.

If you orange-cloud them, multi-GB transfers will 524 / be truncated. Don't.

---

## 6. Rolling a deployment

Always test in staging first. The app's database migrations are idempotent
and run on boot, so a deploy is just: pull, install, build, restart.

```bash
sudo -u photo bash /opt/photo/ops/deploy.sh
# optional: pass a branch or tag
sudo -u photo bash /opt/photo/ops/deploy.sh release/2026-05-04
```

The script does:

1. `git fetch --all --tags` and hard-reset to the requested ref.
2. `npm ci --omit=dev` in `backend/`.
3. `npm ci && npm run build` in `frontend/`.
4. `sudo systemctl restart photo-api photo-worker` (this requires the `photo`
   user has a sudoers entry for these two units only — see below).
5. Tails the last 50 lines of each service log.
6. Hits `http://localhost:5000/api/health` and exits non-zero if not 200.

### 6.1 Sudoers for `photo`

`/etc/sudoers.d/photo-deploy` (visudo it):

```
photo ALL=(root) NOPASSWD: /bin/systemctl restart photo-api, /bin/systemctl restart photo-worker, /bin/systemctl status photo-api, /bin/systemctl status photo-worker
```

That's it. The `photo` user can restart only these two services and nothing
else.

---

## 7. Rotating Wasabi (or any) secrets without downtime

Wasabi keys, JWT, DB password — all use the same drill. Goal: zero-downtime,
no key in shell history.

1. **Create the new key** in Wasabi console. Do not delete the old one yet.
2. **Drop the new value** into `/etc/photo/secrets/aws_secret_access_key`
   (or whichever):

   ```bash
   sudo install -m 0400 -o root -g root /dev/stdin /etc/photo/secrets/aws_secret_access_key <<<"<NEW_VALUE>"
   ```

3. **Restart services** so they pick up the new credential:

   ```bash
   sudo systemctl restart photo-api photo-worker
   journalctl -u photo-api -n 50 --no-pager | grep -iE 'wasabi|s3|forbidden|denied' || echo "no errors"
   ```

4. **Smoke test**: upload a tiny test file via the API, confirm it lands in
   the bucket, confirm signed-URL download works.
5. **Disable the old key** in Wasabi (do not delete). Wait 24h.
6. **Delete the old key** in Wasabi.

For JWT secret rotation, all sessions issued under the old secret will be
invalidated on restart. If that's not acceptable, ship code that accepts both
old and new keys for a grace window first.

---

## 8. Troubleshooting

> **Common pitfalls — read this first.**
>
> - **`MemoryDenyWriteExecute` on Node services.** V8's JIT and native addons
>   (sharp, libvips, libjxl bindings) frequently fail to start with this
>   directive enabled. The shipped systemd units set
>   `MemoryDenyWriteExecute=false` deliberately. Only flip it to `true` after
>   a staging burn-in confirms no startup or runtime errors. If you flipped it
>   on and the service won't start, the logs will show V8 / `mmap` `EACCES`
>   right after process launch — flip it back.
> - **`SystemCallFilter=~@privileged @resources` on the worker.** The worker
>   shells out to `cjxl` and `djxl`, which legitimately call `setrlimit`,
>   `setpriority`, and `sched_setaffinity`. The shipped worker unit denies
>   only `@privileged` for that reason. Do not add `@resources` back without
>   testing every codec path under load.
> - **Helper not wired.** If logs show "Missing required env vars" on first
>   systemd boot but the values are clearly in `/etc/photo/secrets/`, the
>   `loadSystemdCredentials()` helper is not being called. It must be the
>   first line after `require('dotenv').config()` in both `backend/server.js`
>   and `backend/src/workers/index.js`.

### Logs

```bash
journalctl -u photo-api    -f
journalctl -u photo-worker -f
journalctl -u photo-api    --since "10 min ago" --no-pager
```

### Queue / worker health

```bash
# Replace <token> with an admin JWT.
curl -fsS http://localhost:5000/api/admin/queue/health \
  -H "Authorization: Bearer <token>" | jq
```

### Service didn't start

```bash
systemctl status photo-api -l --no-pager
systemd-analyze verify /etc/systemd/system/photo-api.service
```

If you see `audit_log_user_command` denials in `journalctl -k`, one of the
hardening directives is too tight. Most likely culprits and where to relax
(in priority order):

- `MemoryDenyWriteExecute=true` — Node's V8 JIT writes-then-executes machine
  code. Modern Node (>= 18) on x86_64 generally cooperates because V8 uses
  separate write/exec mappings, but if you hit `EACCES` from V8, set this to
  `false` and document why. Test on staging first.
- `SystemCallFilter=~@privileged @resources` — denies syscalls Node almost
  never uses. If sharp / native modules complain, check what's blocked with
  `journalctl -k | grep -i seccomp` and either remove the specific filter or
  drop `@resources`.
- `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX` — if you ever add a
  netlink-using library, you'll need `AF_NETLINK`.

### Bucket / signed URL issues

- 403 on PUT: IAM policy IP allowlist out of date. Check the current outbound
  IP of the box (`curl -4 ifconfig.me`) and update
  `ops/wasabi-iam-policy.example.json`.
- 403 on GET via signed URL: clock skew. Run `chronyc tracking` and confirm
  the box is within ~5 minutes of UTC.
- ETag missing in browser: CORS `ExposeHeaders` (5.3 above).
- 524 / truncation on download: Cloudflare proxying turned on for `download.*`.
  Switch to grey cloud.

### cjxl / djxl / oxipng missing

Worker logs say `ENOENT: photo-cjxl` (or `photo-djxl`, `photo-oxipng`). Re-run
`sudo bash ops/bootstrap.sh`. That script is idempotent. If a binary's
`--version` prefix doesn't match the pin, the script aborts and reports.

---

## 9. File map

```
ops/
  README.md                       # this file
  bootstrap.sh                    # install pinned cjxl/djxl/oxipng
  deploy.sh                       # rolling deploy as `photo`
  wasabi-iam-policy.example.json  # IAM policy template
  .gitignore                      # belt-and-braces secret protection
  systemd/
    photo-api.service             # API systemd unit
    photo-worker.service          # Worker systemd unit

backend/src/utils/
  loadSystemdCredentials.js       # tiny helper, reads $CREDENTIALS_DIRECTORY
```

---

## 10. Frontend serving

`deploy.sh` runs `npm run build` in `frontend/`, which produces a static
bundle at `frontend/dist/` (Vite default). The deploy script does **not**
expose this bundle — that's an ops decision. Pick one of the two patterns
below.

### Pattern A — nginx serves `frontend/dist/`, proxies `/api/*` to the API

This is the recommended pattern. Lets nginx handle TLS, caching, and gzip
without changing backend code. Sample `/etc/nginx/sites-available/photo`:

```nginx
server {
  listen 443 ssl http2;
  server_name app.example.com;

  # TLS config (certbot or your CA of choice) goes here.
  # ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
  # ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

  # Static frontend bundle. `photo` user owns the checkout and rebuilds it on
  # every deploy via `npm run build`. nginx (running as www-data) only needs
  # read access — `chmod o+rx` the directory chain or add www-data to the
  # `photo` group.
  root /opt/photo/frontend/dist;
  index index.html;

  # SPA routing: unknown paths fall through to index.html so client-side
  # routes don't 404.
  location / {
    try_files $uri $uri/ /index.html;
  }

  # API proxy. Keep this prefix in sync with the backend mount points
  # (`/api/v1` and the legacy `/api` aliases).
  location /api/ {
    proxy_pass         http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Real-IP         $remote_addr;
    # Long-lived uploads / multipart-complete responses can take a while.
    proxy_read_timeout 60s;
  }

  # Direct access to the readiness probe is convenient for monitoring.
  location = /healthz {
    proxy_pass http://127.0.0.1:5000/api/health/ready;
  }
}
```

After installing: `sudo ln -s /etc/nginx/sites-available/photo
/etc/nginx/sites-enabled/photo && sudo nginx -t && sudo systemctl reload
nginx`.

### Pattern B — backend serves `frontend/dist/` via Express

Simpler — fewer moving parts, no nginx — but you lose the easy edge cache
and TLS termination handoff. **This is not currently wired.** To enable,
add to `backend/src/app.js`, after the `/api` routers but before the global
error handler:

```js
const path = require('path');
app.use(express.static(path.join(__dirname, '../../frontend/dist'), {
  maxAge: '1h',
  etag: true,
}));
// SPA fallback so client routes (e.g. /galleries/123) serve index.html.
app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});
```

Then put a TLS terminator (nginx, Caddy, or your load balancer) in front of
port 5000.

### Until then

`deploy.sh` produces the build at `frontend/dist/` but does not expose it.
**Configure nginx (Pattern A) or extend the API (Pattern B) before relying
on this in production.** Forgetting this step is a common gotcha — a fresh
deploy looks healthy via `curl localhost:5000/api/health/ready` but
end-users see only "site can't be reached" because nothing is listening on
443.
