# RantaiRenteng frontend — Vite build (Node 20; Tailwind v4 oxide needs it) then
# served as static files by nginx. VITE_* are baked at build time.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# API base + demo group id are fixed at build time (Vite inlines them).
ARG VITE_API_URL=http://localhost:3001
ARG VITE_DEMO_GROUP_ID=e5f6a7b8-9c0d-41e2-8a4b-5c6d7e8f9a0b
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEMO_GROUP_ID=$VITE_DEMO_GROUP_ID
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
