# FacultyCore API — production image
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.ops.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Each institution's files live under storage/tenants/<code>/ on a mounted volume, backups under
# backups/ (see docker-compose.yml). uploads/ is only read when migrating pre-multi-tenant files.
RUN mkdir -p storage/tenants uploads backups && chown -R node:node /app
USER node
EXPOSE 5000
# Ready = database, institution registry and every active institution's database answer
HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
