const tsconfig = (compilerOptions: Record<string, unknown> = {}) =>
  JSON.stringify(
    {
      extends: "@apollogeddon/forgejs/configs/tsconfig.json",
      compilerOptions: { rootDir: ".", ...compilerOptions },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2,
  );

export const tsconfigConfig = tsconfig();

export const websiteTsconfigConfig = tsconfig({ noEmit: true, lib: ["DOM", "DOM.Iterable", "ESNext"] });
