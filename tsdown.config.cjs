/** @type {import('tsdown').Config} */
module.exports = {
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  clean: true,
  minify: true,
  dts: true,
};
