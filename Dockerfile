# Base image
FROM oven/bun:1
WORKDIR /usr/src/app

# Copy dependency files
COPY package.json bun.lock ./

# Install ALL dependencies (important)
RUN bun install --frozen-lockfile

# Copy project
COPY . .

# Environment
ENV NODE_ENV=development

# Expose API port
EXPOSE 8001

# Start server
CMD ["bun", "run", "start"]