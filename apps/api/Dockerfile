# Agentiom API Dockerfile
# Build from monorepo root: docker build -f apps/api/Dockerfile .

FROM oven/bun:1 AS base
WORKDIR /app

# Install ALL dependencies (including dev for workspace packages)
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/providers/package.json ./packages/providers/
COPY packages/logger/package.json ./packages/logger/
COPY tooling/typescript/package.json ./tooling/typescript/
COPY apps/api/package.json ./apps/api/
RUN bun install

# Production stage - run source directly with bun
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy everything needed to run
COPY --from=deps /app/node_modules ./node_modules
COPY packages ./packages
COPY apps/api ./apps/api

WORKDIR /app/apps/api

# Run the API directly from source (bun handles TS natively)
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
