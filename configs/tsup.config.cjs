const { defineConfig } = require("tsup");

module.exports = defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  minify: true,
});
