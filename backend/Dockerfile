# RantaiRenteng backend — NestJS + Prisma.
# Single-stage: keeps the Prisma CLI + ts-node available so the entrypoint can
# run `prisma migrate deploy` and the (ts-node) seed on startup.
FROM node:20-alpine

# Prisma engines need openssl + glibc compat on alpine.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install deps (cached unless manifests change).
COPY package.json package-lock.json ./
RUN npm ci

# Generate Prisma client, then build.
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# Entrypoint: migrate -> seed (idempotent) -> start.
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
