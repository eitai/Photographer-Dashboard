# backend — Express API Claude Instructions

> Parent monorepo context: see `../CLAUDE.md`

## Commands
```bash
npm run dev    # nodemon → auto-reload on port 5000
npm start      # production (node server.js)
```

## Structure
```
src/
├── config/      ← db.js (Mongoose connection)
├── middleware/  ← auth.js (JWT verify), upload.js (multer + sharp)
├── models/      ← Mongoose schemas
│   ├── Admin.js, Client.js, Gallery.js, GalleryImage.js
│   ├── GallerySubmission.js, BlogPost.js, ContactSubmission.js
│   ├── ProductOrder.js, SiteSettings.js
├── routes/      ← Express routers (one file per resource)
│   ├── auth.js, admins.js, clients.js, galleries.js
│   ├── blog.js, contact.js, settings.js, productOrders.js
│   └── publicProfile.js
└── scripts/     ← DB utilities (seed, migrate)
uploads/         ← Static image files (served as /uploads)
server.js        ← Entry point: Express setup, routes, CORS, static
```

## Key Rules
- All models include `adminId` reference — never create content without linking it to an admin
- Gallery tokens are generated server-side (crypto random) — never let the client supply a token
- All protected routes use `auth` middleware: `router.get('/...', auth, handler)`
- Images: Multer receives multipart → Sharp resizes/optimizes → saved to `uploads/`
- Passwords: always hash with bcryptjs before saving; never store plaintext

## Adding a New Route
1. Create `src/routes/resource.js`
2. Define schema in `src/models/Resource.js` with `adminId` field
3. Import and mount in `server.js`: `app.use('/api/resource', require('./src/routes/resource'))`
4. Protect write endpoints with `auth` middleware

## Environment Variables (`.env`)
```
MONGODB_URI=mongodb://localhost:27017/koral
JWT_SECRET=<strong random secret>
SMTP_USER=<gmail address>
SMTP_PASS=<app password>
PORT=5000
```

## Push Notifications
Admin app registers an Expo push token on login → stored on `Admin.pushNotificationToken`.
When a client submits a gallery selection, backend sends push notification via Expo Push API.
