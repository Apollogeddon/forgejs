export const viteConfig = `\
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs so the build works under a GitHub Pages sub-path (/<repo>/)
  base: "./",
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: "dist",
  },
});
`;
