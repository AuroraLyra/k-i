FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_GOOGLE_DRIVE_CLIENT_ID=""
ARG VITE_ONEDRIVE_CLIENT_ID=""
ARG VITE_DROPBOX_APP_KEY=""
ARG LINK_MIN_ANDROID_NATIVE_BUILD="0"
ARG LINK_MIN_IOS_NATIVE_BUILD="0"
ENV VITE_GOOGLE_DRIVE_CLIENT_ID=$VITE_GOOGLE_DRIVE_CLIENT_ID
ENV VITE_ONEDRIVE_CLIENT_ID=$VITE_ONEDRIVE_CLIENT_ID
ENV VITE_DROPBOX_APP_KEY=$VITE_DROPBOX_APP_KEY
ENV LINK_MIN_ANDROID_NATIVE_BUILD=$LINK_MIN_ANDROID_NATIVE_BUILD
ENV LINK_MIN_IOS_NATIVE_BUILD=$LINK_MIN_IOS_NATIVE_BUILD
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN npm run build:all

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist
COPY --from=build /app/server/public ./server/public
RUN mkdir -p /app/releases /app/cache/image-proxy && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server-dist/index.js"]