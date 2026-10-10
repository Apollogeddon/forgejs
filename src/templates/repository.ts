// Repository files every project gets: editor settings, Dependabot and code owners.

export const editorconfig = `root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
max_line_length = 120

[*.md]
trim_trailing_whitespace = false
`;

interface Ecosystem {
  name: string;
  prefix: string;
  group: string;
  // only these update types are grouped; others get a pull request each
  updateTypes?: string[];
  ignore?: string[];
}

const ecosystem = ({ name, prefix, group, updateTypes = [], ignore = [] }: Ecosystem) =>
  [
    `  - package-ecosystem: "${name}"`,
    `    directory: "/"`,
    `    schedule:`,
    `      interval: "weekly"`,
    `    groups:`,
    `      ${group}:`,
    `        patterns:`,
    `          - "*"`,
    ...(updateTypes.length ? [`        update-types:`, ...updateTypes.map((t) => `          - "${t}"`)] : []),
    `    commit-message:`,
    `      prefix: "${prefix}"`,
    ...(ignore.length ? [`    ignore:`, ...ignore.map((d) => `      - dependency-name: "${d}"`)] : []),
    `    cooldown:`,
    `      default-days: 3`,
  ].join("\n");

export function dependabotConfig(docker: boolean): string {
  const ecosystems: Ecosystem[] = [
    { name: "npm", prefix: "fix(deps)", group: "dependencies", updateTypes: ["minor", "patch"] },
    // the reusable workflows are called at @main, which has no versions to propose
    { name: "github-actions", prefix: "chore(ci)", group: "actions", ignore: ["apollogeddon/forgejs"] },
  ];
  if (docker) {
    ecosystems.push({ name: "docker", prefix: "fix(deps)", group: "docker", updateTypes: ["minor", "patch"] });
  }
  return `version: 2
# Every update waits 3 days after a version is published before it's proposed, so a
# compromised release has time to be caught and yanked upstream first.
updates:
${ecosystems.map(ecosystem).join("\n\n")}
`;
}

export const codeowners = (
  owner: string,
) => `# Every pull request opened by someone else, Dependabot and release-please included,
# requests a review from the owner, so it shows in their review requests.
* @${owner}
`;
