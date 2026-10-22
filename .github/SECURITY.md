# Security policy

## Supported versions

Only the latest published version of `@apollogeddon/forgejs` receives security fixes.

## Reporting a vulnerability

Report security vulnerabilities privately through [GitHub's private vulnerability reporting](https://github.com/Apollogeddon/forgejs/security/advisories/new). Don't open a public issue.

You can expect an initial response within a few days. If the issue is confirmed, the fix is released as a patch version and credited in the advisory unless you ask otherwise.

## Automated security tooling

This repository's CI runs on every pull request and again before each release:

- **Gitleaks** scans for committed secrets.
- **OSV-Scanner** scans dependencies for known vulnerabilities.
- **Dependency review** fails a pull request that adds a dependency with a high or critical vulnerability.

**OpenSSF Scorecard** checks the repository's practices on every push to `main` and weekly, with the results in the Security tab.

**Dependabot** proposes dependency updates weekly, with a 3-day cooldown after a version is published. The cooldown gives time for a compromised release to be caught and yanked upstream before it is proposed here.

**Dependabot security updates** (Settings → Code security → Dependabot security updates) open a pull request for each dependency with a known vulnerability as soon as a fixed version exists. They replace the weekly `patch` job, which committed `osv-scanner fix`'s changes straight to `main`.
