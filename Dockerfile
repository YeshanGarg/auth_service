FROM node:24-bookworm-slim AS base

WORKDIR /app

# 🔑 Install required system deps for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN --mount=type=secret,id=corporate_ca \
    if [ -f /run/secrets/corporate_ca ]; then \
        export NODE_EXTRA_CA_CERTS=/run/secrets/corporate_ca; \
    fi; \
    # npm install
    DATABASE_URL="postgresql://unused:unused@localhost:5432/build_only" npm ci

COPY . .

RUN --mount=type=secret,id=corporate_ca \
    if [ -f /run/secrets/corporate_ca ]; then \
        export NODE_EXTRA_CA_CERTS=/run/secrets/corporate_ca; \
    fi; \
    # npm run build
    DATABASE_URL="postgresql://unused:unused@localhost:5432/build_only" npm run build

FROM build AS migrations

USER node

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM build AS production-dependencies

RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM base AS runtime

ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]