import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadNestConfig } from "./config.mjs";
import { planAssets } from "./assets.mjs";
import { assertInsideWorkspace, assertOutputPaths } from "./paths.mjs";

/** Build one project. Collect and validate everything before changing output files. */
export async function buildNest(options = {}) {
  const cwd = realpathSync(path.resolve(options.cwd ?? process.cwd()));
  const config = loadNestConfig({ ...options, cwd });
  const compilerPackage = options.compilerPackage ?? "typescript";
  if (!["typescript", "@typers/compiler"].includes(compilerPackage)) {
    throw new Error("compilerPackage must be typescript or @typers/compiler");
  }
  const requireFromProject = createRequire(path.join(cwd, "package.json"));
  let packagePath;
  try {
    packagePath = requireFromProject.resolve(`${compilerPackage}/package.json`);
  } catch (cause) {
    throw new Error(`Install the local Typers compiler in this project as ${compilerPackage}.`, { cause });
  }
  const metadata = JSON.parse(readFileSync(packagePath, "utf8"));
  if (metadata.name !== "@typers/compiler") {
    throw new Error(`Expected @typers/compiler under ${compilerPackage}; found ${metadata.name}@${metadata.version}.`);
  }
  const { API, DiagnosticCategory } = await import(pathToFileURL(requireFromProject.resolve(`${compilerPackage}/unstable/async`)).href);
  const api = new API({ cwd });
  try {
    const snapshot = await api.updateSnapshot({ openProjects: [config.tsconfig] });
    try {
      const project = snapshot.getProject(config.tsconfig);
      if (!project) throw new Error(`Could not open TypeScript project: ${config.tsconfig}`);
      if (typeof project.typersEmitProject !== "function") {
        throw new Error("This Typers compiler does not expose typersEmitProject; rebuild and install the current local compiler package.");
      }
      const tsOptions = project.compilerOptions;
      if (tsOptions.paths && Object.keys(tsOptions.paths).length) {
        throw new Error("compilerOptions.paths requires alias rewriting, which typers-nest does not support yet. Use runtime-resolvable imports for this build.");
      }
      if (!tsOptions.outDir) throw new Error("typers-nest requires an explicit compilerOptions.outDir in tsconfig.");
      const outDir = path.resolve(cwd, tsOptions.outDir);
      assertInsideWorkspace(cwd, outDir, "compilerOptions.outDir");
      const result = await project.typersEmitProject();
      const report = {
        success: !result.diagnostics.some((diagnostic) => diagnostic.category === DiagnosticCategory.Error),
        emitSkipped: result.emitSkipped,
        diagnostics: result.diagnostics,
        configFile: config.configFile,
        tsconfig: config.tsconfig,
        project: options.project,
        compiler: { name: metadata.name, version: metadata.version, packagePath },
        emittedFiles: [],
        assetFiles: [],
      };
      // A noEmit check or failed compilation must preserve a previous good build,
      // including its assets, even when deleteOutDir is configured.
      if (!report.success || result.emitSkipped) return report;
      if (!Array.isArray(result.configFileNames) || result.configFileNames.length === 0) {
        throw new Error("This Typers compiler does not report configuration dependencies; rebuild and install the current local compiler package before writing outputs.");
      }

      const rootDir = tsOptions.rootDir && path.resolve(cwd, tsOptions.rootDir);
      const assets = planAssets({
        cwd,
        sourceRoot: config.sourceRoot,
        rootDir,
        outDir,
        assets: config.compilerOptions.assets,
      });
      const declarationDir = tsOptions.declarationDir && path.resolve(cwd, tsOptions.declarationDir);
      const outputRoots = [...new Set([outDir, declarationDir, ...config.compilerOptions.assets.map((asset) =>
        typeof asset === "object" && asset.outDir ? path.resolve(cwd, asset.outDir) : undefined)].filter(Boolean))];
      const files = [
        ...result.outputs.map(({ fileName, text }) => ({ fileName: path.resolve(cwd, fileName), contents: text })),
        ...assets,
      ];
      const sourceFiles = await project.program.getSourceFileNames();
      const protectedPaths = [
        config.sourceRoot === cwd ? undefined : config.sourceRoot,
        rootDir === cwd ? undefined : rootDir,
        config.configFile,
        config.tsconfig,
        ...result.configFileNames,
        path.join(cwd, "package.json"),
        ...sourceFiles,
        ...assets.map((asset) => asset.sourceFile),
      ].filter(Boolean);
      assertOutputPaths({ cwd, outputRoots, files, protectedPaths });

      if (config.compilerOptions.deleteOutDir) {
        // Match Nest's scope: only the compiler outDir is cleared. A distinct
        // declarationDir or asset outDir is written without recursive cleanup.
        rmSync(outDir, { recursive: true, force: true, maxRetries: 3 });
      }
      for (const file of files) {
        mkdirSync(path.dirname(file.fileName), { recursive: true });
        writeFileSync(file.fileName, file.contents);
      }
      report.emittedFiles = result.outputs.map((output) => output.fileName);
      report.assetFiles = assets.map((asset) => asset.fileName);
      return report;
    } finally {
      await snapshot.dispose();
    }
  } finally {
    await api.close();
  }
}
