# App del alumno (PWA): se compila con Vite y la sirve nginx, que reenvía /api a Directus (mismo origen, D-032).
FROM node:22.23.4-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @memora/web build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
