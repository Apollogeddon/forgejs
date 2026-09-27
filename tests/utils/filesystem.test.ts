import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { init } from "../../src/core.js";
import type { IFileSystem } from "../../src/utils/filesystem.js";

class MockFileSystem implements IFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set([process.cwd()]);

  cwd(): string {
    return "/mock/cwd";
  }

  resolve(...paths: string[]): string {
    return path.resolve("/", ...paths);
  }

  join(...paths: string[]): string {
    return path.join(...paths);
  }

  dirname(p: string): string {
    return path.dirname(p);
  }

  basename(p: string): string {
    return path.basename(p);
  }

  existsSync(p: string): boolean {
    return this.files.has(p) || this.directories.has(p);
  }

  mkdirSync(p: string): string | undefined {
    this.directories.add(p);
    return p;
  }

  writeFileSync(p: string, content: string): void {
    this.files.set(p, content);
  }

  readFileSync(p: string): string {
    const content = this.files.get(p);
    if (content === undefined) {
      throw new Error(`File not found: ${p}`);
    }
    return content;
  }

  getFileContent(p: string): string | undefined {
    return this.files.get(p);
  }

  unlinkSync(p: string): void {
    if (this.files.has(p)) {
      this.files.delete(p);
    } else {
      throw new Error(`File not found: ${p}`);
    }
  }
}

describe("CLI Init with MockFileSystem", () => {
  const defaultConfig = {
    force: false,
    dryRun: false,
    backend: false,
    library: true,
    website: false,
    debian: false,
    docker: false,
    testing: true,
    version: true,
    linting: true,
  };

  it("should create expected files in mock filesystem", () => {
    const mockFs = new MockFileSystem();

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    init(defaultConfig, mockFs);

    const cwd = mockFs.cwd();

    expect(mockFs.existsSync(mockFs.join(cwd, "biome.json"))).toBe(true);
    expect(mockFs.existsSync(mockFs.join(cwd, "tsconfig.json"))).toBe(true);
    expect(mockFs.existsSync(mockFs.join(cwd, "lefthook.yml"))).toBe(true);

    expect(mockFs.existsSync(mockFs.join(cwd, "tsup.config.ts"))).toBe(true);

    expect(mockFs.existsSync(mockFs.join(cwd, "vitest.config.ts"))).toBe(true);

    const packageJsonContent = mockFs.getFileContent(mockFs.join(cwd, "package.json"));
    expect(packageJsonContent).toBeDefined();
    const packageJson = JSON.parse(packageJsonContent ?? "{}");
    expect(packageJson.name).toBe("cwd"); // basename of /mock/cwd
    expect(packageJson.type).toBe("module");
    expect(packageJson.scripts.test).toBe("vitest run");

    consoleSpy.mockRestore();
  });

  it("should respect dry-run and not create files", () => {
    const mockFs = new MockFileSystem();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    init({ ...defaultConfig, dryRun: true }, mockFs);

    const cwd = mockFs.cwd();
    expect(mockFs.existsSync(mockFs.join(cwd, "biome.json"))).toBe(false);

    consoleSpy.mockRestore();
  });

  it("should handle existing files correctly (skip without force)", () => {
    const mockFs = new MockFileSystem();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const cwd = mockFs.cwd();

    const existingContent = "original content";
    mockFs.writeFileSync(mockFs.join(cwd, "biome.json"), existingContent);

    init(defaultConfig, mockFs);

    expect(mockFs.getFileContent(mockFs.join(cwd, "biome.json"))).toBe(existingContent);

    consoleSpy.mockRestore();
  });

  it("should overwrite existing files with force", () => {
    const mockFs = new MockFileSystem();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const cwd = mockFs.cwd();

    const existingContent = "original content";
    mockFs.writeFileSync(mockFs.join(cwd, "biome.json"), existingContent);

    init({ ...defaultConfig, force: true }, mockFs);

    const newContent = mockFs.getFileContent(mockFs.join(cwd, "biome.json"));
    expect(newContent).not.toBe(existingContent);
    expect(newContent).toContain("node_modules/@apollogeddon/forgejs/configs/biome.json");

    consoleSpy.mockRestore();
  });
});
