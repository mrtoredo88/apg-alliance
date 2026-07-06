FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY src/ ./src/
COPY firebase-service-account.json ./firebase-service-account.json
EXPOSE 3000
CMD ["node", "src/server.js"]
