# ── Frontend — Node.js 20 / Vite dev server ───────────────────
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

EXPOSE 5173
# --host 0.0.0.0 makes Vite reachable outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
