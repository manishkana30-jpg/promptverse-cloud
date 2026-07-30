# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production Stage
FROM node:18-alpine

# Security: Run as a non-root user
RUN addgroup -S nodeuser && adduser -S nodeuser -G nodeuser
WORKDIR /app

COPY package*.json ./
# Install only production dependencies
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Switch to the non-root user
USER nodeuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
