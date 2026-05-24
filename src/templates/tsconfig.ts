export const tsconfigConfig = JSON.stringify(
  {
    extends: "@apollogeddon/forgejs/configs/tsconfig.json",
    compilerOptions: {
      rootDir: ".",
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  },
  null,
  2,
);

export const websiteTsconfigConfig = JSON.stringify(
  {
    extends: "@apollogeddon/forgejs/configs/tsconfig.json",
    compilerOptions: {
      rootDir: ".",
      noEmit: true,
      lib: ["DOM", "DOM.Iterable", "ESNext"],
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  },
  null,
  2,
);
