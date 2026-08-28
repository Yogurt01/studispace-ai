# Build the Vite client and bundled Express server with the project's supported Node version.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Install only production packages in a small runtime image.
FROM node:22-bookworm-slim AS runtime
# NODE_ENV=production is what makes server.ts serve the built assets instead of
# the Vite dev server. It is baked here so the image is correct even if the
# platform forgets to set it.
ENV NODE_ENV=production
# Cloud Run injects its own PORT and defaults to 8080; this is only the fallback
# for `docker run` with no PORT. Never a development port.
ENV PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.cjs"]
