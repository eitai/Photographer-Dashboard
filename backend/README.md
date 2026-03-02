# Koral Photography — System Overview

## The Full Process Flow

### 1. Photographer takes a session
Client comes in for a family / maternity / newborn session.

### 2. Admin creates the client
`/admin/clients` → New Client (name, phone, email, session type)

### 3. Admin creates a gallery for that client
`/admin/galleries` → New Gallery → links to the client → system auto-generates a **unique secret link** like:
```
http://yoursite.com/gallery/a3f9d2c1b8e7...
```

### 4. Admin uploads photos to the gallery
`/admin/galleries/:id` → drag & drop images → they upload to the server

### 5. Admin sends the link to the client
Copy the link → send via WhatsApp / email

### 6. Client opens their gallery
They see all photos, can:
- Browse and select favorites (blush glow highlight)
- Download any image
- Submit their final selection

### 7. Admin sees the submission
`/admin/selections` → sees which images the client chose → can download them as a ZIP

### 8. Photographer edits the selected photos
Works offline in Lightroom / Photoshop

### 9. Status updates along the way
Client moves through:
```
Gallery Sent → Viewed → Selection Submitted → In Editing → Delivered
```

### 10. Blog (separate)
Photographer writes posts at `/admin/blog` → published to the public site at `/blog`

---

## How to Run

### Requirements
- Node.js 18+
- MongoDB running locally

### Start MongoDB (first time / after restart)
```bash
"C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" --dbpath "C:/data/db"
```

### Start the API server
```bash
cd koral-api
npm run dev
```
Server runs on `http://localhost:5000`

### Start the frontend
```bash
cd koral-light-studio
npm run dev
```
Frontend runs on `http://localhost:8080` (or similar)

### Create first admin account (one time only)
```bash
curl -X POST http://localhost:5000/api/auth/seed \
  -H "Content-Type: application/json" \
  -d '{"name":"Koral","email":"your@email.com","password":"yourpassword"}'
```

### Login
Go to `http://localhost:8080/admin` and sign in.

---

## Project Structure

```
store test/
├── koral-api/          ← Express.js + MongoDB API server
│   ├── server.js
│   ├── src/
│   │   ├── config/     ← MongoDB connection
│   │   ├── middleware/ ← JWT auth, image upload (multer)
│   │   ├── models/     ← Admin, Client, Gallery, Image, Blog, Contact
│   │   └── routes/     ← All API endpoints
│   └── uploads/        ← Uploaded images stored here
│
└── koral-light-studio/ ← React + Vite frontend
    └── src/
        ├── pages/
        │   ├── admin/  ← Dashboard, Clients, Galleries, Blog, etc.
        │   └── ...     ← Public pages (Home, Portfolio, Contact, Blog)
        ├── components/
        │   └── admin/  ← AdminLayout, Sidebar, ProtectedRoute
        ├── hooks/
        │   └── useAuth.tsx
        └── lib/
            ├── api.ts  ← Axios client pointing to koral-api
            └── i18n.tsx ← Hebrew / English translations
```

---

## API Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/login` | Public | Admin login |
| GET | `/api/auth/me` | Admin | Get current admin |
| GET | `/api/clients` | Admin | List all clients |
| POST | `/api/clients` | Admin | Create client |
| PUT | `/api/clients/:id` | Admin | Update client |
| GET | `/api/galleries` | Admin | List all galleries |
| POST | `/api/galleries` | Admin | Create gallery (auto-generates token) |
| GET | `/api/galleries/token/:token` | Public | Client accesses gallery by token |
| POST | `/api/galleries/:id/images` | Admin | Upload images (bulk, up to 1000) |
| POST | `/api/galleries/:id/submit` | Public | Client submits final selection |
| GET | `/api/galleries/:id/submissions` | Admin | View client submissions |
| GET | `/api/blog` | Public | List published posts |
| POST | `/api/blog` | Admin | Create blog post |
| GET | `/api/blog/slug/:slug` | Public | Get post by slug |
| POST | `/api/contact` | Public | Submit contact form |
| GET | `/api/contact` | Admin | View contact submissions |
