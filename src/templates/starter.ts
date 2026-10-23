// src/index.ts for a backend or library, src/main.ts for a website
export function starterTs(projectName: string): string {
  return `console.log("Hello from ${projectName}!");\n`;
}

export function indexHtml(projectName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
}
