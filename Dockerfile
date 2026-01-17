FROM node:20-slim

WORKDIR /app

# 🔑 Install required system deps for Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates

COPY zscaler-root-ca.pem /tmp/zscaler-root-ca.pem

# Add Zscaler root CA
RUN if [ -f /tmp/zscaler-root-ca.pem ]; then \
      cp /tmp/zscaler-root-ca.pem /usr/local/share/ca-certificates/zscaler-root-ca.crt && \
      update-ca-certificates; \
    fi

ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler-root-ca.crt

ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]