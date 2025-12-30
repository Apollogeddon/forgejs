import fs from "node:fs";
import path from "node:path";

export interface IFileSystem {
  cwd(): string;
  resolve(...paths: string[]): string;
  join(...paths: string[]): string;
  dirname(p: string): string;
  basename(p: string): string;
  existsSync(p: string): boolean;
  mkdirSync(p: string, options?: fs.MakeDirectoryOptions): string | undefined;
  writeFileSync(p: string, content: string): void;
  readFileSync(p: string, encoding: BufferEncoding): string;
}

export class NodeFileSystem implements IFileSystem {
  cwd(): string {
    return process.cwd();
  }

  resolve(...paths: string[]): string {
    return path.resolve(...paths);
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
    return fs.existsSync(p);
  }

  mkdirSync(p: string, options?: fs.MakeDirectoryOptions): string | undefined {
    return fs.mkdirSync(p, options);
  }

  writeFileSync(p: string, content: string): void {
    fs.writeFileSync(p, content);
  }

  readFileSync(p: string, encoding: BufferEncoding): string {
    return fs.readFileSync(p, encoding);
  }
}
