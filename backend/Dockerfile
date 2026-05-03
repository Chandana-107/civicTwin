# ── Backend — Node.js 20 ──────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Install deps first (cache-friendly layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
