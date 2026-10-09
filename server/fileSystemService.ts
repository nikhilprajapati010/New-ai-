import fs from "fs";
import path from "path";
import { vanguardWebSocket } from "./websocketService.js";

export interface FileNode {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  lines?: number;
  extension?: string;
  updatedAt?: string;
  children?: FileNode[];
}

export interface FileSystemStats {
  totalFiles: number;
  totalLinesOfCode: number;
  typescriptFiles: number;
  reactComponents: number;
  serverServices: number;
  scannedAt: string;
}

export class FileSystemService {
  private baseDir: string;
  private backupDir: string;

  constructor() {
    this.baseDir = process.cwd();
    this.backupDir = path.join(this.baseDir, ".vanguard_backups");
    if (!fs.existsSync(this.backupDir)) {
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
      } catch {
        // Ignore backup creation errors if in read-only environment
      }
    }
  }

  private resolveSafePath(relPath: string): string {
    const clean = relPath.replace(/^(\.\.[\/\\])+/, "").replace(/^\/+/, "");
    const absolute = path.resolve(this.baseDir, clean);
    if (!absolute.startsWith(this.baseDir)) {
      throw new Error("Access Denied: Path escapes sandbox boundary.");
    }
    return absolute;
  }

  /**
   * Recursively scans directory and builds tree representation
   */
  public getDirectoryTree(relativeRoot: string = "src"): FileNode {
    const fullPath = this.resolveSafePath(relativeRoot);
    return this.buildTreeNode(fullPath, relativeRoot);
  }

  private buildTreeNode(fullPath: string, relativePath: string): FileNode {
    const stat = fs.statSync(fullPath);
    const name = path.basename(fullPath);

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(fullPath);
      const children: FileNode[] = [];

      for (const entry of entries) {
        if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === "dist-server" || entry.startsWith(".")) {
          continue;
        }
        const childFull = path.join(fullPath, entry);
        const childRel = path.join(relativePath, entry);
        try {
          children.push(this.buildTreeNode(childFull, childRel));
        } catch {
          // Skip unreadable files
        }
      }

      return {
        path: relativePath,
        name,
        type: "directory",
        children,
      };
    } else {
      let lines = 0;
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        lines = content.split("\n").length;
      } catch {
        // Binary or unreadable
      }

      return {
        path: relativePath,
        name,
        type: "file",
        size: stat.size,
        lines,
        extension: path.extname(name),
        updatedAt: stat.mtime.toISOString(),
      };
    }
  }

  /**
   * Reads file content with safe path resolution
   */
  public readFile(relativePath: string): { path: string; content: string; lines: number; size: number } {
    const fullPath = this.resolveSafePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error(`Target is a directory, not a file: ${relativePath}`);
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    return {
      path: relativePath,
      content,
      lines: content.split("\n").length,
      size: stat.size,
    };
  }

  /**
   * Writes file content safely with automatic backup
   */
  public writeFile(relativePath: string, content: string): { success: boolean; path: string; bytesWritten: number } {
    const fullPath = this.resolveSafePath(relativePath);

    // Create automatic snapshot backup
    if (fs.existsSync(fullPath)) {
      try {
        const backupName = `${relativePath.replace(/[\/\\]/g, "_")}.${Date.now()}.bak`;
        fs.writeFileSync(path.join(this.backupDir, backupName), fs.readFileSync(fullPath));
      } catch {
        // Best-effort backup
      }
    }

    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf-8");
    const stat = fs.statSync(fullPath);

    vanguardWebSocket.broadcastLog({
      level: "INFO",
      source: "omniscient-fs",
      message: `[FS WRITE]: Updated ${relativePath} (${stat.size} bytes).`,
    });

    return {
      success: true,
      path: relativePath,
      bytesWritten: stat.size,
    };
  }

  /**
   * Returns high-level statistics across /src and /server
   */
  public getStats(): FileSystemStats {
    let totalFiles = 0;
    let totalLinesOfCode = 0;
    let typescriptFiles = 0;
    let reactComponents = 0;
    let serverServices = 0;

    const scanDirs = ["src", "server"];
    for (const dir of scanDirs) {
      const fullDir = path.resolve(this.baseDir, dir);
      if (!fs.existsSync(fullDir)) continue;

      const walk = (d: string) => {
        const entries = fs.readdirSync(d);
        for (const entry of entries) {
          const full = path.join(d, entry);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            walk(full);
          } else {
            totalFiles++;
            const ext = path.extname(entry);
            if (ext === ".ts" || ext === ".tsx") typescriptFiles++;
            if (ext === ".tsx") reactComponents++;
            if (d.includes("server") && ext === ".ts") serverServices++;

            try {
              const lines = fs.readFileSync(full, "utf-8").split("\n").length;
              totalLinesOfCode += lines;
            } catch {
              // Ignore binary
            }
          }
        }
      };

      walk(fullDir);
    }

    return {
      totalFiles,
      totalLinesOfCode,
      typescriptFiles,
      reactComponents,
      serverServices,
      scannedAt: new Date().toISOString(),
    };
  }

  /**
   * Fast text search across codebase files
   */
  public searchCode(query: string): Array<{ path: string; line: number; snippet: string }> {
    const results: Array<{ path: string; line: number; snippet: string }> = [];
    if (!query || query.trim().length === 0) return results;

    const lowerQuery = query.toLowerCase();
    const scanDirs = ["src", "server"];

    for (const dir of scanDirs) {
      const fullDir = path.resolve(this.baseDir, dir);
      if (!fs.existsSync(fullDir)) continue;

      const walk = (d: string) => {
        if (results.length > 50) return;
        const entries = fs.readdirSync(d);
        for (const entry of entries) {
          if (results.length > 50) return;
          const full = path.join(d, entry);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            walk(full);
          } else if (entry.endsWith(".ts") || entry.endsWith(".tsx") || entry.endsWith(".json")) {
            try {
              const content = fs.readFileSync(full, "utf-8");
              const lines = content.split("\n");
              lines.forEach((lineText, idx) => {
                if (lineText.toLowerCase().includes(lowerQuery)) {
                  results.push({
                    path: path.relative(this.baseDir, full),
                    line: idx + 1,
                    snippet: lineText.trim().substring(0, 120),
                  });
                }
              });
            } catch {
              // Skip
            }
          }
        }
      };

      walk(fullDir);
    }

    return results;
  }
}

export const fileSystemService = new FileSystemService();
