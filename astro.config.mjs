import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import mermaid from "astro-mermaid";
import starlightTypeDoc from "starlight-typedoc";

export default defineConfig({
  site: "https://apollogeddon.github.io/forgejs",
  outDir: "docs",
  integrations: [
    mermaid(),
    starlight({
      title: "Forge.js",
      logo: {
        src: "./public/forgejs.png",
      },
      social: [{ label: "GitHub", href: "https://github.com/apollogeddon/forgejs", icon: "github" }],
      sidebar: [
        {
          label: "Overview",
          items: [
            { label: "Getting Started", link: "/overview/getting-started/" },
            { label: "Configuration", link: "/overview/configuration/" },
            { label: "Contributing", link: "/overview/contributing/" },
          ],
        },
        {
          label: "Reference",
          items: [
            {
              label: "Workflows",
              items: [
                { label: "Overview", link: "/reference/workflows/" },
                { label: "Job Reference", link: "/reference/workflows/job-reference/" },
              ],
            },
          ],
        },
      ],
      plugins: [
        starlightTypeDoc({
          entryPoints: ["src/index.ts"],
          tsconfig: "./tsconfig.doc.json",
        }),
      ],
    }),
  ],
});
