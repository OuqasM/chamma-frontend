# --- build stage ------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Left empty on purpose: the SPA talks to the API through the same-origin
# /api and /images routes that nginx proxies, so no absolute API origin is
# baked into the bundle.
ARG VITE_API_URL=""
ARG VITE_API_BASE=/api
ARG VITE_DEFAULT_LOCALE=fr
ENV VITE_API_URL=$VITE_API_URL \
    VITE_API_BASE=$VITE_API_BASE \
    VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE

RUN npm run build

# --- runtime stage ----------------------------------------------------------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=6 \
    CMD wget -qO- http://127.0.0.1:5173/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
