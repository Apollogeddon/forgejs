export const snodebConfig = `\
const { defineSnodebConfig } = require("snodeb");
// a package.json without a name falls back to the project directory's name
const { name = require("node:path").basename(__dirname) } = require("./package.json");

// The service runs as its own system user, which the package's postinst creates, never as root.
// It's named after the package without its scope, as a Debian user name can't hold '@', '/' or '.'.
const unscoped = name
  .split("/")
  .pop()
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, "-");
const user = (/^[a-z_]/.test(unscoped) ? unscoped : \`svc-\${unscoped}\`).slice(0, 32);

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
    user,
    group: user,
    entryPoint: "dist/index.js",
  },
});
`;
