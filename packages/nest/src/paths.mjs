import { lstatSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const reserved = new Set([".git", "node_modules"]);

function pathString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty path`);
  }
}

function within(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

// Output paths often do not exist yet. Canonicalize the nearest existing
// ancestor so e.g. an existing SRC alias cannot bypass protection of src.
function canonical(target) {
  let current = path.resolve(target);
  const missing = [];
  for (;;) {
    try {
      return path.join(realpathSync(current), ...missing);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

function caseInsensitive(directory) {
  let current = canonical(directory);
  while (current !== path.dirname(current)) {
    const name = path.basename(current);
    const changed = name.replace(/[a-zA-Z]/, (letter) => letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase());
    if (changed !== name) {
      try {
        const original = statSync(current);
        const alternate = statSync(path.join(path.dirname(current), changed));
        return original.dev === alternate.dev && original.ino === alternate.ino;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    }
    current = path.dirname(current);
  }
  return process.platform === "win32";
}

/** Return a strict workspace descendant, rejecting existing symlink components. */
export function assertInsideWorkspace(cwd, target, label = "Path") {
  pathString(cwd, "Workspace");
  pathString(target, label);
  const workspace = path.resolve(cwd);
  const resolved = path.resolve(workspace, target);
  if (resolved === workspace || !within(workspace, resolved)) {
    throw new Error(`${label} must stay inside the workspace and cannot equal it: ${target}`);
  }
  const segments = path.relative(workspace, resolved).split(path.sep);
  if (segments.some((segment) => reserved.has(segment.toLowerCase()))) {
    throw new Error(`${label} cannot use .git or node_modules: ${target}`);
  }
  let current = workspace;
  for (const segment of ["", ...segments]) {
    current = path.join(current, segment);
    let entry;
    try {
      entry = lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
    if (entry.isSymbolicLink()) {
      throw new Error(`${label} cannot traverse a symlink: ${current}`);
    }
  }
  return resolved;
}

/** Validate every destructive destination before the caller removes or writes files. */
export function assertOutputPaths({ cwd, outputRoots, files, protectedPaths = [] }) {
  if (!Array.isArray(outputRoots) || outputRoots.length === 0 || !Array.isArray(files)) {
    throw new Error("Output roots and files must be arrays, with at least one output root");
  }
  const roots = [...new Set(outputRoots.map((root) => assertInsideWorkspace(cwd, root, "Output directory")))];
  const insensitive = caseInsensitive(cwd);
  const comparisonPath = (target) => {
    const resolved = canonical(target);
    return insensitive ? resolved.toLowerCase() : resolved;
  };
  const rootKeys = roots.map(comparisonPath);
  const protectedFiles = protectedPaths.map((entry) => {
    pathString(entry, "Protected path");
    return comparisonPath(path.resolve(cwd, entry));
  });
  for (const root of roots) {
    const existingRoot = lstatSync(root, { throwIfNoEntry: false });
    if (existingRoot && !existingRoot.isDirectory()) {
      throw new Error(`Output directory is an existing non-directory: ${root}`);
    }
    for (const protectedPath of protectedFiles) {
      const rootKey = comparisonPath(root);
      if (within(rootKey, protectedPath) || within(protectedPath, rootKey)) {
        throw new Error(`Output directory overlaps a protected source or configuration path: ${root} / ${protectedPath}`);
      }
    }
  }
  const destinations = new Set();
  for (const file of files) {
    const destination = assertInsideWorkspace(cwd, file.fileName, "Output file");
    const destinationKey = comparisonPath(destination);
    if (!rootKeys.some((root) => destinationKey !== root && within(root, destinationKey))) {
      throw new Error(`Output file is outside the configured output directories: ${destination}`);
    }
    if (rootKeys.includes(destinationKey)) {
      throw new Error(`Output file would overwrite an output directory: ${destination}`);
    }
    const existingFile = lstatSync(destination, { throwIfNoEntry: false });
    if (existingFile && !existingFile.isFile()) {
      throw new Error(`Output file is an existing non-file: ${destination}`);
    }
    if (destinations.has(destinationKey)) {
      throw new Error(`Multiple outputs target the same file: ${destination}`);
    }
    destinations.add(destinationKey);
  }
  for (const destination of destinations) {
    let parent = path.dirname(destination);
    while (parent !== path.dirname(parent)) {
      if (destinations.has(parent)) {
        throw new Error(`Output file collides with an output directory: ${parent} / ${destination}`);
      }
      parent = path.dirname(parent);
    }
  }
}
