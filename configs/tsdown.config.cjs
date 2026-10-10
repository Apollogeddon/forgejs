// A plain object, so a project's own tsdown.config.ts spreads it into defineConfig.
module.exports = {
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true,
  treeshake: true,
  // Keep .js and .d.ts, as main, types and bin point there; tsdown would otherwise emit .mjs
  fixedExtension: false,
};
