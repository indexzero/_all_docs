# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy application code
COPY . .

# Set environment for Cloud Run
ENV RUNTIME=cloudrun
ENV NODE_ENV=production

# Cloud Run uses PORT environment variable (defaults to 8080)
ENV PORT=8080
EXPOSE 8080

# Create cache directory
RUN mkdir -p /tmp/cache

# Start the Node.js worker
CMD ["node", "node.js"]