import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Minimatch } from "minimatch";
import { validateAssetEntries } from "./config.mjs";
import { assertInsideWorkspace } from "./paths.mjs";

function pattern(value, label) {
  if (path.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.includes("\\") || value.includes("\0")) {
    throw new Error(`${label} must be a relative glob using forward slashes`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => ["..", ".git", "node_modules"].includes(segment.toLowerCase()))) {
    throw new Error(`${label} cannot escape sourceRoot or use .git/node_modules`);
  }
  const normalized = value.replace(/^(\.\/)+/, "").replace(/\/+$/, "") || ".";
  const options = { dot: true, nonegate: true, nocomment: true };
  return {
    value: normalized,
    matcher: new Minimatch(normalized, options),
    directoryMatcher: normalized.endsWith("/**") ? new Minimatch(normalized.slice(0, -3) || ".", options) : undefined,
  };
}

function ancestors(relative) {
  const parents = ["."];
  const segments = relative.split("/");
  for (let count = 1; count < segments.length; count++) parents.push(segments.slice(0, count).join("/"));
  return parents;
}

function excluded(relative, exclude) {
  return !!exclude && [relative, ...ancestors(relative)].some((candidate) =>
    exclude.matcher.match(candidate) || exclude.directoryMatcher?.match(candidate));
}

function matchesFile(relative, include, exclude) {
  const parents = ancestors(relative);
  if (excluded(relative, exclude)) return false;
  return include.matcher.match(relative)
    || (!include.value.endsWith("*") && parents.some((candidate) => include.matcher.match(candidate)));
}

function mayDescend(relative, include, exclude) {
  if (excluded(relative, exclude)) return false;
  return include.matcher.match(relative, true)
    || (!include.value.endsWith("*") && [relative, ...ancestors(relative)].some((candidate) => include.matcher.match(candidate)));
}

/** Capture an asset plan. All paths are confined; no directories or files are written. */
export function planAssets({ cwd, sourceRoot, rootDir, outDir, assets }) {
  const entries = validateAssetEntries(assets);
  if (entries.length === 0) return [];
  if (typeof rootDir !== "string" || !rootDir) throw new Error("Assets require an explicit TypeScript compilerOptions.rootDir");
  cwd = path.resolve(cwd);
  sourceRoot = path.resolve(cwd, sourceRoot);
  rootDir = path.resolve(cwd, rootDir);
  if (sourceRoot !== cwd) assertInsideWorkspace(cwd, sourceRoot, "sourceRoot");
  if (rootDir !== cwd) assertInsideWorkspace(cwd, rootDir, "rootDir");
  if (!statSync(sourceRoot).isDirectory()) throw new Error(`sourceRoot is not a directory: ${sourceRoot}`);
  const defaultOutDir = assertInsideWorkspace(cwd, outDir, "outDir");
  const patterns = entries.map((entry, index) => {
    const asset = typeof entry === "string" ? { include: entry } : entry;
    return {
      include: pattern(asset.include, `assets[${index}].include`),
      exclude: asset.exclude === undefined ? undefined : pattern(asset.exclude, `assets[${index}].exclude`),
      outDir: asset.outDir === undefined ? defaultOutDir : assertInsideWorkspace(cwd, asset.outDir, `assets[${index}].outDir`),
    };
  });
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if ([".git", "node_modules"].includes(entry.name.toLowerCase())) continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(sourceRoot, absolute).split(path.sep).join("/");
      if (entry.isSymbolicLink()) {
        if (patterns.some(({ include, exclude }) => mayDescend(relative, include, exclude))) {
          throw new Error(`Asset paths cannot traverse symlinks: ${absolute}`);
        }
      } else if (entry.isDirectory()) {
        if (patterns.some(({ include, exclude }) => mayDescend(relative, include, exclude))) walk(absolute);
      } else if (entry.isFile()) {
        files.push({ absolute, relative });
      }
    }
  };
  walk(sourceRoot);
  const outputs = new Map();
  for (const { absolute, relative } of files) {
    for (const { include, exclude, outDir: destinationRoot } of patterns) {
      if (!matchesFile(relative, include, exclude)) continue;
      assertInsideWorkspace(cwd, absolute, "Asset source");
      const suffix = path.relative(rootDir, absolute);
      if (!suffix || suffix === ".." || suffix.startsWith(`..${path.sep}`) || path.isAbsolute(suffix)) {
        throw new Error(`Asset source must stay inside TypeScript rootDir: ${absolute}`);
      }
      const fileName = assertInsideWorkspace(cwd, path.join(destinationRoot, suffix), "Asset destination");
      const previous = outputs.get(fileName);
      if (previous && previous.sourceFile !== absolute) throw new Error(`Multiple asset sources target the same output: ${fileName}`);
      if (!previous) outputs.set(fileName, { fileName, contents: readFileSync(absolute), sourceFile: absolute });
    }
  }
  return [...outputs.values()].sort((a, b) => a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0);
}
