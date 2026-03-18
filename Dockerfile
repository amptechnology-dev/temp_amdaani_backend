# Use official Bun image
FROM oven/bun:1

# Set working directory
WORKDIR /usr/src/app

# Copy dependency files first (better caching)
COPY package.json bun.lock ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy application source
COPY . .

# Set production environment
ENV NODE_ENV=production

# Expose app port
EXPOSE 8000

# Start application
CMD ["bun", "run", "start"]