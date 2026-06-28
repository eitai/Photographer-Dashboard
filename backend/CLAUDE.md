# backend — Express API Claude Instructions

> Parent monorepo context: see `../CLAUDE.md`

## Stack

Express 4 + **PostgreSQL** via the raw `pg` driver — **no ORM**. Models are
plain modules that run hand-written SQL against a shared connection pool.
JWT auth, Multer + Sharp for uploads, S3 for object storage, a job queue +
worker process for background work.

## Commands

```bash
npm run dev     # nodemon → auto-reload on port 5000 (entry: server.js)
npm start       # production (node server.js)
npm run workers # background worker process (node src/workers/index.js)
npm test        # jest --forceExit --detectOpenHandles
```

## Structure

```
server.js          ← Entry point (loaded by start/dev)
src/
├── app.js         ← Express app assembly: middleware, route mounting, CORS, static
├── config/
│   ├── db.js          ← PostgreSQL Pool (pg) + connectDB(); SSL handling for CNPG
│   ├── s3.js          ← S3 client config
│   └── validateEnv.js ← Startup env-var validation
├── db/
│   ├── index.js       ← query() / pool helpers used by models
│   ├── schema.sql     ← Full schema (source of truth for tables)
│   ├── migrations/    ← Ordered SQL migrations
│   └── utils.js
├── middleware/
│   ├── auth.js         ← protect (JWT verify) + superprotect (superadmin)
│   ├── supplierAuth.js ← Supplier-portal JWT guard
│   ├── checkQuota.js   ← Storage-quota enforcement on uploads
│   ├── upload.js       ← Multer + Sharp (resize/optimize)
│   └── asyncHandler.js ← Async route error wrapper
├── models/        ← Raw-SQL modules (NOT Mongoose schemas) — see below
├── routes/        ← Express routers, one file per resource
├── services/      ← billing, invoice, email, sms, face, storage
├── queue/         ← index.js — job enqueue/dequeue
├── workers/       ← index.js — background worker entry (npm run workers)
└── utils/         ← payplus, logger, transaction, validators, uuid, etc.
```

## Models (`src/models/`)

Each model is a **raw-SQL module**, not an ORM schema. Methods build and run
parameterized SQL ($1, $2 …) through the `pg` pool and map rows to plain
objects. There are no Mongoose schemas, no `.save()`, no documents.

Current models: `Admin`, `Client`, `Gallery`, `GalleryFolder`,
`GalleryImage`, `GallerySubmission`, `BlogPost`, `ContactSubmission`,
`SiteSettings`, `ProductOrder`, `AdminProduct`, `StoreOrder`, `Supplier`,
`SupplierProduct`, `SupplierSettlement`, `ClientFaceReference`,
`IssuedDocument`, `PhotographerInvoice`, `Plan`, `Subscription`.

## Key Rules

- All content models carry an `adminId` — never create content without linking it to an admin.
- Gallery tokens are generated server-side (crypto random) — never let the client supply a token.
- Protected routes use middleware from `auth.js`: `router.get('/...', protect, handler)`; superadmin-only routes use `superprotect`; upload routes add `checkQuota`.
- Use **parameterized queries** ($1, $2 …) for every SQL statement — never string-concatenate user input.
- Multi-statement writes go through `utils/transaction.js` (BEGIN/COMMIT/ROLLBACK), not loose queries.
- Images: Multer receives multipart → Sharp resizes/optimizes → stored on disk (`uploads/`) or S3.
- Passwords: always hash with bcrypt before saving; never store plaintext.
- DECIMAL/NUMERIC columns are money (2 decimals); `config/db.js` parses them to JS numbers — keep that assumption.

## Adding a New Route

1. Create `src/routes/resource.js` (Express router).
2. Add a model in `src/models/Resource.js` with raw-SQL methods and an `adminId` column.
3. Add the table to `src/db/schema.sql` and a migration under `src/db/migrations/`.
4. Mount the router in `src/app.js`: `app.use('/api/resource', require('./routes/resource'))`.
5. Guard write endpoints with `protect` (and `superprotect` / `checkQuota` as needed).

## Environment Variables (`.env`)

```
DATABASE_URL=postgres://user:pass@host:5432/dbname   # NOT MongoDB
JWT_SECRET=<strong random secret>
FRONTEND_URL=<web origin for CORS>
SMTP_USER=<gmail address>
SMTP_PASS=<app password>
PORT=5000
S3_BUCKET=
S3_REGION=
S3_PUBLIC_URL=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

## Push Notifications

The admin app registers an Expo push token on login → stored on
`Admin.pushToken`. When a client submits a gallery selection, the backend
sends a push notification via the Expo Push API.
