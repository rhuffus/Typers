import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileOrThrow, packageRoot } from "./compiler.mjs";

const dist = join(packageRoot, "dist");
const source = join(packageRoot, "src", "index.ts");
const commonArgs = [
  "--strict",
  "--target", "ES2022",
  "--module", "NodeNext",
  "--moduleResolution", "NodeNext",
  "--declaration",
  "--noEmitOnError",
  "--pretty", "false",
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

compileOrThrow([
  ...commonArgs,
  "--rootDir", join(packageRoot, "src"),
  "--outDir", join(dist, "esm"),
  source,
]);

// NodeNext determines the output format from the source package boundary.
// Compile the same source within a temporary CommonJS package for the CJS build.
const stage = mkdtempSync(join(packageRoot, ".build-"));

try {
  copyFileSync(source, join(stage, "index.ts"));
  writeFileSync(join(stage, "package.json"), '{"type":"commonjs"}\n');

  compileOrThrow([
    ...commonArgs,
    "--rootDir", stage,
    "--outDir", join(dist, "cjs"),
    join(stage, "index.ts"),
  ]);

  writeFileSync(join(dist, "cjs", "package.json"), '{"type":"commonjs"}\n');
} finally {
  rmSync(stage, { recursive: true, force: true });
}

console.log("@typers/core: JavaScript y declaraciones ESM/CJS generados con Typers.");
