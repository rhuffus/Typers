import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { assertInsideWorkspace } from "./paths.mjs";

const rootKeys = new Set(["$schema", "language", "collection", "sourceRoot", "entryFile", "exec", "root", "monorepo", "compilerOptions", "projects", "generateOptions"]);
const projectKeys = new Set(["type", "root", "sourceRoot", "entryFile", "exec", "compilerOptions", "generateOptions"]);
const compilerKeys = new Set(["tsConfigPath", "builder", "assets", "deleteOutDir", "plugins", "webpack", "webpackConfigPath", "rspackConfigPath", "typeCheck", "emitDeclarations", "includeLibraryAssets", "watchAssets", "manualRestart", "allowOutsidePaths", "preserveWatchOutput"]);

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function keys(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Unsupported ${label} field: ${key}`);
  }
}

function string(value, label) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function boolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
}

export function validateAssetEntries(assets) {
  if (!Array.isArray(assets)) throw new Error("compilerOptions.assets must be an array");
  return assets.map((entry, index) => {
    const label = `assets[${index}]`;
    if (typeof entry === "string") return string(entry, label);
    keys(entry, new Set(["include", "exclude", "outDir", "watchAssets", "flat"]), label);
    string(entry.include, `${label}.include`);
    for (const field of ["exclude", "outDir"]) {
      if (Object.hasOwn(entry, field)) string(entry[field], `${label}.${field}`);
    }
    for (const field of ["watchAssets", "flat"]) {
      if (Object.hasOwn(entry, field)) {
        boolean(entry[field], `${label}.${field}`);
        if (entry[field]) throw new Error(`${label}.${field} is not supported by typers-nest build`);
      }
    }
    return { ...entry };
  });
}

function validateCompilerOptions(options) {
  keys(options, compilerKeys, "compilerOptions");
  options.assets = validateAssetEntries(options.assets);
  boolean(options.deleteOutDir, "compilerOptions.deleteOutDir");
  if (Object.hasOwn(options, "tsConfigPath")) string(options.tsConfigPath, "compilerOptions.tsConfigPath");
  for (const field of ["webpack", "typeCheck", "emitDeclarations", "watchAssets", "manualRestart", "allowOutsidePaths", "preserveWatchOutput"]) {
    if (Object.hasOwn(options, field)) {
      boolean(options[field], `compilerOptions.${field}`);
      if (options[field]) throw new Error(`compilerOptions.${field} is not supported by typers-nest build`);
    }
  }
  for (const field of ["plugins", "includeLibraryAssets"]) {
    if (Object.hasOwn(options, field) && (!Array.isArray(options[field]) || options[field].length)) {
      throw new Error(`compilerOptions.${field} must be empty; this feature is not supported by typers-nest build`);
    }
  }
  for (const field of ["webpackConfigPath", "rspackConfigPath"]) {
    if (Object.hasOwn(options, field)) throw new Error(`compilerOptions.${field} is not supported by typers-nest build`);
  }
  if (Object.hasOwn(options, "builder")) {
    const builder = options.builder;
    if (typeof builder === "string") {
      if (!["tsc", "typers"].includes(builder)) throw new Error(`Unsupported builder: ${builder}; typers-nest uses the native Typers API`);
    } else {
      keys(builder, new Set(["type", "options"]), "compilerOptions.builder");
      if (!["tsc", "typers"].includes(builder.type)) throw new Error("compilerOptions.builder.type must be tsc or typers for this adapter");
      if (Object.hasOwn(builder, "options")) {
        keys(builder.options, new Set(["configPath"]), "compilerOptions.builder.options");
        if (Object.hasOwn(builder.options, "configPath")) string(builder.options.configPath, "compilerOptions.builder.options.configPath");
      }
    }
  }
  return options;
}

function existingFile(cwd, file, label) {
  const resolved = assertInsideWorkspace(cwd, string(file, label), label);
  if (!existsSync(resolved) || !statSync(resolved).isFile()) throw new Error(`${label} does not name an existing file: ${resolved}`);
  return resolved;
}

/** Resolve the supported Nest configuration using cwd, rather than the config file's directory. */
export function loadNestConfig({ cwd, project, config, path: tsconfigOverride }) {
  cwd = path.resolve(cwd);
  let configFile = null;
  if (config !== undefined) {
    configFile = existingFile(cwd, config, "Nest configuration");
  } else {
    const discovered = ["nest-cli.json", ".nest-cli.json"].find((file) => existsSync(path.join(cwd, file)));
    if (discovered) configFile = existingFile(cwd, discovered, "Nest configuration");
  }
  let root = {};
  if (configFile) {
    try {
      root = JSON.parse(readFileSync(configFile, "utf8"));
    } catch (error) {
      throw new Error(`Could not parse Nest configuration ${configFile}: ${error.message}`, { cause: error });
    }
  }
  keys(root, rootKeys, "Nest configuration");
  if (root.language !== undefined && root.language !== "ts") throw new Error("Only Nest language ts is supported");
  if (Object.hasOwn(root, "projects")) object(root.projects, "projects");
  let selected = {};
  if (project !== undefined) {
    string(project, "Project name");
    if (!root.projects || !Object.hasOwn(root.projects, project)) throw new Error(`Unknown Nest project: ${project}`);
    selected = root.projects[project];
    keys(selected, projectKeys, `projects[${project}]`);
    if (selected.type !== undefined && !["application", "library"].includes(selected.type)) throw new Error(`Unsupported project type: ${selected.type}`);
  }
  const rootOptions = Object.hasOwn(root, "compilerOptions") ? object(root.compilerOptions, "compilerOptions") : {};
  const projectOptions = Object.hasOwn(selected, "compilerOptions") ? object(selected.compilerOptions, "project compilerOptions") : {};
  const compilerOptions = validateCompilerOptions({ assets: [], deleteOutDir: false, ...rootOptions, ...projectOptions });
  const configuredTsconfig = tsconfigOverride ?? compilerOptions.tsConfigPath
    ?? (typeof compilerOptions.builder === "object" ? compilerOptions.builder.options?.configPath : undefined)
    ?? (existsSync(path.join(cwd, "tsconfig.build.json")) ? "tsconfig.build.json" : "tsconfig.json");
  const tsconfig = existingFile(cwd, configuredTsconfig, "TypeScript configuration");
  const sourceRootValue = Object.hasOwn(selected, "sourceRoot") ? selected.sourceRoot : (Object.hasOwn(root, "sourceRoot") ? root.sourceRoot : "src");
  const sourceRoot = path.resolve(cwd, string(sourceRootValue, "sourceRoot"));
  if (sourceRoot !== cwd) assertInsideWorkspace(cwd, sourceRoot, "sourceRoot");
  return { configFile, tsconfig, sourceRoot, compilerOptions };
}
