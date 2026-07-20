FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY scripts/account-remote-preflight.mjs ./scripts/account-remote-preflight.mjs
COPY scripts/lib/ ./scripts/lib/
COPY scripts/account-snapshot.mjs ./scripts/account-snapshot.mjs
COPY scripts/account-core-import.mjs ./scripts/account-core-import.mjs
COPY scripts/account-dry-run.mjs ./scripts/account-dry-run.mjs
COPY scripts/account-verify.mjs ./scripts/account-verify.mjs
COPY scripts/account-rollback.mjs ./scripts/account-rollback.mjs
COPY scripts/account-observe.mjs ./scripts/account-observe.mjs
COPY server/src/lib/firebase.js ./server/src/lib/firebase.js
COPY server/firebase-service-account.json ./firebase-service-account.json
COPY docs/migration/rollback-readiness.md ./docs/migration/rollback-readiness.md
COPY docs/migration/monitoring-readiness.md ./docs/migration/monitoring-readiness.md
COPY server/src/routes/system-status.js ./server/src/routes/system-status.js
COPY ops/migration-operator/server.mjs ./ops/migration-operator/server.mjs

ENV NODE_ENV=production
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json
EXPOSE 8080

CMD ["node", "ops/migration-operator/server.mjs"]
