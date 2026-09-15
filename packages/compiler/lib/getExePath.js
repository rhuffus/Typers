import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Resolve the same native executable used by this package's CLI. */
export default function getExePath() {
  const packageRoot = fileURLToPath(new URL("../", import.meta.url));
  const info = JSON.parse(readFileSync(path.join(packageRoot, "build-info.json"), "utf8"));
  if (info.platform !== process.platform || info.arch !== process.arch) {
    throw new Error(
      `This Typers package targets ${info.platform}/${info.arch}; ` +
        `current platform is ${process.platform}/${process.arch}. Rebuild it on this platform.`,
    );
  }
  const executable = path.join(packageRoot, "native", process.platform === "win32" ? "typers.exe" : "typers");
  if (!existsSync(executable)) {
    throw new Error(`The packaged Typers executable is missing: ${executable}`);
  }
  return executable;
}
