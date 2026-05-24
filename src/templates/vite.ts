export const viteConfig = `\
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: "dist",
  },
});
`;
