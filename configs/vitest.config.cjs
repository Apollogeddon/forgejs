const { defineConfig } = require("vitest/config");
const path = require("node:path");

module.exports = defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  test: {
    environment: "node",
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./junit-report.xml",
    },
    includeSource: ["src/**/*.?(c|m)[jt]s?(x)"],
    passWithNoTests: true,
    exclude: ["**/node_modules/**", "dist", ".git", ".cache"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["html", "text", "json-summary", "json"],
      include: ["src/**/*.?(c|m)[jt]s?(x)"],
      exclude: ["**/*.config.*", "**/*.d.ts"],
    },
    testTimeout: 30000,
  },
});
