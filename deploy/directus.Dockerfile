# Directus 12 con las extensiones de Memora ya compiladas y el esquema versionado dentro de la imagen.
FROM node:22.18-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && node backend/extensions/memora/build.mjs

FROM directus/directus:12.4.1
COPY --from=build /repo/backend/extensions-dist /directus/extensions
COPY backend/schema /directus/schema
