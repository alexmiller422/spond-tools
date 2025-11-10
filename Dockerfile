FROM node:lts-trixie-slim AS base

WORKDIR /usr/local/spond-tools

FROM base AS build

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM base AS final

COPY --from=build /usr/local/spond-tools/package.json /usr/local/spond-tools/package-lock.json ./
RUN npm ci --production &&\
    npx playwright install --with-deps chromium


COPY --from=build /usr/local/spond-tools/dist ./dist