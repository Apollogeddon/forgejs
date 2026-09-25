export function lefthookConfig(includeCommitlint: boolean): string {
  const commitMsgSection = includeCommitlint
    ? `
commit-msg:
  parallel: true
  commands:
    commitlint:
      run: npx commitlint --edit {1}
`
    : "";

  return `# Lefthook Configuration
# Refer to https://github.com/evilmartians/lefthook/blob/master/docs/configuration.md

pre-commit:
  parallel: true
  commands:
    biome-check:
      glob: "*.{js,ts,cjs,mjs,d.cts,d.mts,json,jsonc}"
      run: npx biome check --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
    publint:
      run: npx publint
${commitMsgSection}`;
}
