FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL is injected at build time via docker-compose build args.
# Since frontend and backend share the same public domain, set this to
# the public URL (e.g. https://your-domain.com) — nginx proxies /api and
# /uploads to the backend container internally.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Serve with nginx ──────────────────────────────────────────────────────────
FROM nginx:alpine

# Copy built React app
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config (routes /api and /uploads to backend, SPA fallback for /)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
