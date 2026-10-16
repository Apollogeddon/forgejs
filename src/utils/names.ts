// Lowercase letters, digits and single dashes: valid as an npm name, a Docker image name and a
// shell word. "My JS" gives my-js, as forgego and forgepy name a project.
export function slug(name: string): string {
  return (
    name
      // accents come off rather than taking the letter with them: Ünï gives uni
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app"
  );
}

// A scope's "@" isn't valid in an image name, so a scoped package's image is named for the package alone.
export function imageName(packageName: string): string {
  return slug(packageName.replace(/^@[^/]+\//, ""));
}
