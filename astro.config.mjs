import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightTypeDoc from "starlight-typedoc";

export default defineConfig({
  site: "https://example.com",
  integrations: [
    starlight({
      title: "My Project",
      social: [
        {
          label: "GitHub",
          href: "https://github.com/example/repo",
          icon: "github",
        },
      ],
      sidebar: [
        {
          label: "Guides",
          items: [
            // { label: 'Example Guide', link: '/guides/example/' },
          ],
        },
        {
          label: "Reference",
          items: [
            {
              label: "API",
              items: [{ autogenerate: { directory: "api" } }],
            },
          ],
        },
      ],
      plugins: [
        starlightTypeDoc({
          entryPoints: ["src/index.ts"],
          tsconfig: "./tsconfig.json",
          sidebar: {
            label: "API",
          },
        }),
      ],
    }),
  ],
});
