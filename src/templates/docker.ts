// @apollogeddon packages live on GitHub Packages, which needs a token even to read. The .npmrc only
// holds a placeholder; the token is mounted per RUN as a build secret, so it never lands in a layer.
// `?` makes npm substitute an empty string instead of failing when no secret is passed. The secret is
// read from its file mount because Podman/Buildah doesn't support BuildKit's `env=` secret mounts.
const npmrc = `RUN printf '@apollogeddon:registry=https://npm.pkg.github.com\\n//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN?}\\n' > /root/.npmrc`;
const npmSecret = `--mount=type=secret,id=npm_token NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token 2>/dev/null)"`;

export const dockerConfigBackend = `\
# syntax=docker/dockerfile:1
# Compiled JS is platform-independent, so build once on the build host
FROM --platform=$BUILDPLATFORM node:22-slim AS build
WORKDIR /usr/src/app
${npmrc}
COPY . .
RUN ${npmSecret} npm ci --ignore-scripts
RUN npm run build

# Production dependencies can include native add-ons, so install them per target platform.
# Install scripts stay enabled so those add-ons compile; prepare is dropped because it runs
# lefthook, a dev dependency that --omit=dev leaves out.
FROM node:22-slim AS deps
WORKDIR /usr/src/app
${npmrc}
COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare
RUN ${npmSecret} npm ci --omit=dev

# Same base as deps so native add-ons find the libraries they were built against
FROM node:22-slim
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY package.json ./
USER node
CMD ["node", "dist/index.js"]
`;

export const dockerConfigWebsite = `\
# syntax=docker/dockerfile:1
# The static build is platform-independent, so only the nginx runtime is per target platform
FROM --platform=$BUILDPLATFORM node:22-slim AS build
WORKDIR /usr/src/app
${npmrc}
COPY . .
RUN ${npmSecret} npm ci --ignore-scripts
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;

export const dockerIgnore = `\
node_modules
dist
.git
.github
.npmrc
*.md
`;
