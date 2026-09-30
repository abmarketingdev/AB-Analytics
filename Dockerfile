# AB Analytics console.
#
# Next.js 16 app router. It is not a static export — it runs a Node server, and once the
# seams in lib/api/* are pointed at the real services it will also proxy/stream, so it
# must stay a server.
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .

# `prebuild` copies the maplibre worker bundles into public/ — without it the map pages
# 404 on maplibre-gl-worker.mjs at runtime. `npm run build` triggers it.
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
# package.json's `start` pins -p 3100 (the dev port); the container serves 3000 behind
# the gateway, so call next directly rather than through the script.
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
