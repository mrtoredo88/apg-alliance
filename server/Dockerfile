FROM node:20-alpine
WORKDIR /app

ARG APP_VERSION=unknown
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ARG IMAGE_DIGEST=unknown

ENV APP_VERSION=$APP_VERSION \
    GIT_SHA=$GIT_SHA \
    BUILD_TIME=$BUILD_TIME \
    IMAGE_DIGEST=$IMAGE_DIGEST

COPY server/package.json server/package-lock.json ./
RUN npm ci --production
COPY server/src/ ./src/
COPY docs/architecture-guard-report.json ./docs/architecture-guard-report.json
COPY server-shared/ /server-shared/
RUN ln -s /app/node_modules /node_modules
EXPOSE 3000
CMD ["node", "src/server.js"]
