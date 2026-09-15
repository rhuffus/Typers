#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildNest } from "../src/build.mjs";

const help = `Usage: typers-nest build [project] [options]

Build one NestJS project with its installed native Typers compiler.

  -c, --config <file>      Nest configuration (default: nest-cli.json or .nest-cli.json)
  -p, --path <file>        TypeScript configuration override
      --compiler <name>   Compiler dependency: typescript (default) or @typers/compiler
      --json              Print a structured build report
  -h, --help              Show help
  -v, --version           Show adapter version

Experimental: plugins, aliases, incremental builds, watch and --all are not supported.
`;

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      config: { type: "string", short: "c" },
      path: { type: "string", short: "p" },
      compiler: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  if (values.version) {
    console.log(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
  } else if (values.help || !positionals.length) {
    console.log(help);
  } else {
    if (positionals[0] !== "build" || positionals.length > 2) {
      throw new Error("Expected: typers-nest build [project]. Use --help for supported options.");
    }
    const result = await buildNest({
      project: positionals[1], config: values.config, path: values.path, compilerPackage: values.compiler,
    });
    if (values.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const printDiagnostic = (diagnostic, indent = "") => {
        console.error(`${indent}${diagnostic.fileName ?? result.tsconfig}: TS${diagnostic.code}: ${diagnostic.text}`);
        for (const next of diagnostic.messageChain ?? []) printDiagnostic(next, `${indent}  `);
        for (const next of diagnostic.relatedInformation ?? []) printDiagnostic(next, `${indent}  `);
      };
      for (const diagnostic of result.diagnostics) printDiagnostic(diagnostic);
      if (result.success) {
        console.log(result.emitSkipped
          ? "Typers Nest: check completed; emission skipped."
          : `Typers Nest: built ${result.emittedFiles.length} compiler outputs and copied ${result.assetFiles.length} assets.`);
      }
    }
    if (!result.success) process.exitCode = 1;
  }
} catch (error) {
  console.error(`Typers Nest: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
