export const snodebConfig = `\
const { defineSnodebConfig } = require("snodeb");

module.exports = defineSnodebConfig({
  architecture: "all",
  depends: ["nodejs"],
  files: {
    include: ["dist/index.js", "node_modules/**/*"],
    configInclude: [".env", "config/default.json"],
    prune: true,
    unPrune: false,
  },
  systemd: {
    user: "root",
    group: "node-service",
    entryPoint: "dist/index.js",
  },
});
`;
