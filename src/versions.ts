import { createRequire } from "node:module";

// versions.ts and the tsdown bundle output are both one directory below repo root, so
// "../package.json" resolves in both - don't move this into a deeper-nested file.
const require = createRequire(import.meta.url);
export const ownPackageJson = require("../package.json") as { name: string; version: string };
export const forgejsVersion = ownPackageJson.version;

// The Node.js major a new project pins in .nvmrc and engines, and the workflows' fallback when a
// project has no .nvmrc. Raise it here; a test keeps the workflows' fallback in step.
export const NODE_VERSION = "24";

// A Node.js version init accepts: a major, major.minor or major.minor.patch, from NODE_VERSION up
export function validNodeVersion(version: string): boolean {
  const match = /^(\d+)(\.\d+){0,2}$/.exec(version);
  return match !== null && Number(match[1]) >= Number(NODE_VERSION);
}
