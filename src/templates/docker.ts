export const dockerConfigBackend = `\
FROM node:22-slim AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN npm ci --ignore-scripts
RUN npm run build
RUN npm ci --omit=dev --ignore-scripts

FROM gcr.io/distroless/nodejs22-debian12
COPY --from=build /usr/src/app/dist /usr/src/app/dist
COPY --from=build /usr/src/app/node_modules /usr/src/app/node_modules
COPY --from=build /usr/src/app/package.json /usr/src/app/package.json
WORKDIR /usr/src/app
CMD ["dist/index.js"]
`;

export const dockerConfigWebsite = `\
FROM node:22-slim AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN npm ci --ignore-scripts
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
*.md
`;
