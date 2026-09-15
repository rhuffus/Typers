import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, chmodSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageDir = path.join(root, "packages/compiler");
const metadata = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));
const nativeDir = path.join(packageDir, "native");
const builtDir = path.join(root, "tsc/built/local");
const goos = { darwin: "darwin", linux: "linux", win32: "windows" }[process.platform];
const goarch = { arm64: "arm64", x64: "amd64" }[process.arch];
if (!goos || !goarch) throw new Error(`Local packaging is not configured for ${process.platform}/${process.arch}`);
rmSync(nativeDir, { recursive: true, force: true });
const filename = process.platform === "win32" ? "typers.exe" : "typers";
mkdirSync(nativeDir, { recursive: true });
mkdirSync(builtDir, { recursive: true });
mkdirSync(path.join(root, "built/typers"), { recursive: true });
const bin = path.join(builtDir, filename);
execFileSync("go", ["build", "-trimpath", "-ldflags", `-X github.com/microsoft/typescript-go/internal/core.version=${metadata.version}`, "-o", bin, "./cmd/tsgo"], {
  cwd: path.join(root, "tsc"),
  stdio: "inherit",
  env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: "0" },
});
copyFileSync(bin, path.join(nativeDir, filename));
chmodSync(path.join(nativeDir, filename), 0o755);
chmodSync(path.join(packageDir, "bin/typers.cjs"), 0o755);
copyFileSync(path.join(root, "LICENSE.txt"), path.join(packageDir, "LICENSE.txt"));
copyFileSync(path.join(root, "tsc/NOTICE.txt"), path.join(packageDir, "NOTICE.txt"));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const info = {
  name: metadata.name,
  version: metadata.version,
  upstreamVersion: "7.0.2",
  upstreamCommit: "1e4744d68260a7cb91b62b12edc3f6a2187faaf1",
  sourceCommit: git("rev-parse", "HEAD"),
  compilerWorktreeDirty: git("status", "--porcelain", "--", "tsc").length > 0,
  platform: process.platform,
  arch: process.arch,
  goos,
  goarch,
  goVersion: execFileSync("go", ["version"], { encoding: "utf8" }).trim(),
};
writeFileSync(path.join(packageDir, "build-info.json"), JSON.stringify(info, null, 2) + "\n");
console.log(`Built ${metadata.name}@${metadata.version} for ${info.platform}/${info.arch}`);
