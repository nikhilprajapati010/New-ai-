import fs from "fs";
import path from "path";
import { vanguardWebSocket } from "./websocketService.js";
import { redactSecrets } from "./securityService.js";

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

  private isForbiddenTarget(filePath: string): boolean {
    const base = path.basename(filePath).toLowerCase();
    // Block environment variables, keys, credentials, and configuration files
    if (
      base.startsWith(".env") ||
      base.includes("firebase-applet-config") ||
      base.includes("firebase-blueprint") ||
      base.includes("firestore.rules") ||
      base.endsWith(".key") ||
      base.endsWith(".pem") ||
      base.endsWith(".cert") ||
      base.endsWith(".p12") ||
      base.endsWith(".lock") ||
      base.includes("securityservice") ||
      filePath.includes(".vanguard_backups") ||
      filePath.includes(".git") ||
      filePath.includes("node_modules")
    ) {
      return true;
    }
    return false;
  }

  private resolveSafePath(relPath: string): string {
    const clean = relPath.replace(/^(\.\.[\/\\])+/, "").replace(/^\/+/, "");
    const absolute = path.resolve(this.baseDir, clean);

    // Verify absolute path stays strictly inside baseDir
    const relFromBase = path.relative(this.baseDir, absolute);
    if (relFromBase.startsWith("..") || path.isAbsolute(relFromBase)) {
      throw new Error("Access Denied: Path escapes sandbox boundary.");
    }

    // Verify it targets only /src or /server
    const normalized = relFromBase.replace(/\\/g, "/");
    const allowedPrefixes = ["src", "server"];
    const isAllowedDir = allowedPrefixes.some(
      (prefix) => normalized === prefix || normalized.startsWith(prefix + "/")
    );

    if (!isAllowedDir) {
      throw new Error("Access Denied: File system operations are strictly restricted to /src and /server.");
    }

    if (this.isForbiddenTarget(absolute)) {
      throw new Error("Access Denied: Protected system or credential file.");
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
   * Reads file content with safe path resolution and secret redaction
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

    const rawContent = fs.readFileSync(fullPath, "utf-8");
    const content = redactSecrets(rawContent);
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

    const ext = path.extname(fullPath).toLowerCase();
    const allowedExts = [".ts", ".tsx", ".css", ".json", ".js", ".mjs", ".svg", ".md"];
    if (!allowedExts.includes(ext)) {
      throw new Error(`Access Denied: Writing files with extension '${ext}' is disallowed.`);
    }

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
            if (this.isForbiddenTarget(full)) return;
            walk(full);
          } else if (entry.endsWith(".ts") || entry.endsWith(".tsx") || entry.endsWith(".json")) {
            if (this.isForbiddenTarget(full)) return;
            try {
              const content = fs.readFileSync(full, "utf-8");
              const lines = content.split("\n");
              lines.forEach((lineText, idx) => {
                if (lineText.toLowerCase().includes(lowerQuery)) {
                  results.push({
                    path: path.relative(this.baseDir, full),
                    line: idx + 1,
                    snippet: redactSecrets(lineText.trim().substring(0, 120)),
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
