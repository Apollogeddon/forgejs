const tsconfigPaths = require("vite-tsconfig-paths").default;
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./junit-report.xml",
    },
    includeSource: ["src/**/*.?(c|m)[jt]s?(x)"],
    passWithNoTests: true,
    exclude: ["node_modules", "dist", ".git", ".cache"],
    coverage: {
      enabled: true,
      reporter: ["html", "text", "json-summary", "json"],
      include: ["src/**/*.?(c|m)[jt]s?(x)"],
    },
    testTimeout: 30000,
  },
  plugins: [tsconfigPaths()],
});
