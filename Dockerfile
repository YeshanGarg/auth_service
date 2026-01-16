FROM node:20-slim

WORKDIR /app

# 🔑 Install required system deps for Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates

# Add Zscaler root CA
RUN if [ -f zscaler-root-ca.pem ]; then \
      cp zscaler-root-ca.pem /usr/local/share/ca-certificates/zscaler-root-ca.crt && \
      update-ca-certificates; \
    fi

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]