import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, DiagnosticCategory } from "typescript/unstable/async";

// A small consumer of Typers' native API, maintained alongside this example.
// Nest CLI assets, plugins, path rewriting and watch mode are separate integrations.
const cwd = path.dirname(fileURLToPath(import.meta.url));
const config = path.resolve(cwd, process.argv[2] ?? "tsconfig.json");
if (process.argv.length > 3) throw new Error("Usage: node build-api.mjs [tsconfig.json]");

const api = new API({ cwd });
try {
  const snapshot = await api.updateSnapshot({ openProjects: [config] });
  try {
    const project = snapshot.getProject(config);
    if (!project) throw new Error(`Could not open project: ${config}`);
    const result = await project.typersEmitProject();
    for (const diagnostic of result.diagnostics) {
      console.error(`${diagnostic.fileName ?? config}: TS${diagnostic.code}: ${diagnostic.text}`);
      const printRelated = (messages, indent) => {
        for (const message of messages ?? []) {
          console.error(`${indent}${message.text}`);
          printRelated(message.messageChain, `${indent}  `);
        }
      };
      printRelated(diagnostic.messageChain, "  ");
      printRelated(diagnostic.relatedInformation, "  ");
    }
    if (result.diagnostics.some((diagnostic) => diagnostic.category === DiagnosticCategory.Error)) {
      process.exitCode = 1;
    } else if (!result.emitSkipped) {
      // This example writes only within its configured output directory. The API
      // itself returns files in memory and never writes them to the filesystem.
      const outDir = project.compilerOptions.outDir;
      if (!outDir) throw new Error("This example requires an explicit compilerOptions.outDir");
      const outputRoot = path.resolve(cwd, outDir);
      const outputs = result.outputs.map(({ fileName, text }) => {
        const target = path.resolve(cwd, fileName);
        const relative = path.relative(outputRoot, target);
        if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
          throw new Error(`Output is outside compilerOptions.outDir: ${fileName}`);
        }
        return { target, text };
      });
      for (const { target, text } of outputs) {
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, text);
      }
      console.log(`Typers native API: wrote ${outputs.length} files from ${path.basename(config)}.`);
    } else {
      console.log(`Typers native API: emission skipped for ${path.basename(config)}.`);
    }
  } finally {
    await snapshot.dispose();
  }
} finally {
  await api.close();
}
