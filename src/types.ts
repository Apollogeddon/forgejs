export interface InitConfig {
  force: boolean;
  dryRun: boolean;
  backend: boolean;
  library: boolean;
  website: boolean;
  debian: boolean;
  docker: boolean;
  testing: boolean;
  versioning: boolean;
  linting: boolean;
  // the directory to scaffold; the current directory when unset
  target?: string;
}

export interface PackageJson {
  name: string;
  version: string;
  description: string;
  main?: string;
  type?: string;
  private?: boolean;
  scripts: Record<string, string>;
  devDependencies?: Record<string, string>;
  keywords: string[];
  author: string;
  license: string;
  [key: string]: unknown;
}
