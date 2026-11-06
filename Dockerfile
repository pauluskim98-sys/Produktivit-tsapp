FROM node:24-bookworm-slim
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN DATABASE_PATH=/tmp/lifemap-build.sqlite pnpm build
ENV NODE_ENV=production DATABASE_PATH=/data/raum.sqlite
CMD ["sh", "-c", "node scripts/check-private-host.mjs && exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port \"${PORT:-3000}\""]
