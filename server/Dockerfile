FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --production
COPY server/src/ ./src/
COPY docs/architecture-guard-report.json ./docs/architecture-guard-report.json
COPY server/firebase-service-account.json ./firebase-service-account.json
COPY server-shared/ /server-shared/
RUN ln -s /app/node_modules /node_modules
EXPOSE 3000
CMD ["node", "src/server.js"]
