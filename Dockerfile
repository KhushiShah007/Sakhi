# UNTESTED in the authoring environment (no Docker was available). Verify with `docker compose up --build`.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm i --no-save tsx
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 8787
# DATABASE_URL, SAKHI_DATA_KEY and OTP_WEBHOOK_URL are required in production; DEMO_AUTH must not be true.
CMD ["npx", "tsx", "server/src/index.ts"]
