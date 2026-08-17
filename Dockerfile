# --- Stage 1: build the React bundle ---------------------------------------
FROM node:22-slim AS web-build

WORKDIR /build
COPY web/package.json web/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# --- Stage 2: runtime -------------------------------------------------------
FROM node:22-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
RUN npm --prefix server install --omit=dev --no-audit --no-fund

COPY server/src ./server/src
COPY --from=web-build /build/dist ./web/dist

# Cloud Run injects PORT; 8080 is the default it uses.
ENV PORT=8080
EXPOSE 8080

USER node

CMD ["node", "server/src/index.js"]
