import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { prepareConsumer } from "./prepare-consumer.mjs";
import { testNativeApi } from "./test-native-api.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  TYPERS_BIN: path.join(root, "tsc/built/local", process.platform === "win32" ? "typers.exe" : "typers"),
};
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: "inherit", env });
const expectSuccess = (res) => {
  if (res.error) throw res.error;
  assert.equal(res.status, 0, res.stdout + res.stderr);
};

// A failed new run must not leave a previous success report looking current.
rmSync(path.join(root, "built/typers/compatibility.json"), { force: true });
run(process.execPath, ["tooling/build-compiler.mjs"]);
run(npm, ["test"], path.join(root, "packages/core"));
run(npm, ["pack", "./packages/compiler", "--pack-destination", "./built/typers", "--quiet"]);
run(npm, ["pack", "./packages/core", "--pack-destination", "./built/typers", "--quiet"]);
const preparation = prepareConsumer();
const example = preparation.directory;
const result = (command, args, cwd = example) => spawnSync(command, args, { cwd, encoding: "utf8", env });

const requireFromExample = createRequire(path.join(example, "package.json"));
const requireFromTools = createRequire(import.meta.url);
const installed = requireFromExample("typescript/package.json");
assert.equal(installed.name, "@typers/compiler");
assert.equal(installed.version, "7.0.2-typers.0");
const upstreamMetadata = requireFromTools("typescript/package.json");
assert.equal(upstreamMetadata.name, "typescript");
assert.equal(upstreamMetadata.version, "7.0.2");
const forkBin = path.join(example, "node_modules/typescript/bin/typers.cjs");
const upstreamBin = path.join(path.dirname(requireFromTools.resolve("typescript/package.json")), "bin/tsc");
const cli = (bin, args) => result(process.execPath, [bin, ...args]);
const version = cli(forkBin, ["--version"]);
expectSuccess(version);
assert.equal(version.stdout.trim(), `Version ${installed.version}`);
assert.equal(version.stderr, "");
const upstreamVersion = cli(upstreamBin, ["--version"]);
expectSuccess(upstreamVersion);
assert.equal(upstreamVersion.stdout.trim(), `Version ${upstreamMetadata.version}`);
assert.equal(upstreamVersion.stderr, "");

for (const directory of ["dist", "dist-upstream", "dist-typers", "dist-api", "dist-api-typers", "dist-api-invalid"]) {
  rmSync(path.join(example, directory), { recursive: true, force: true });
}

expectSuccess(cli(forkBin, ["-p", "tsconfig.json"]));
expectSuccess(cli(upstreamBin, ["-p", "tsconfig.json", "--outDir", "dist-upstream"]));
function emittedFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...emittedFiles(path.join(directory, entry.name)).map((name) => path.join(entry.name, name)));
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  return files.sort();
}
function assertSameEmission(actual, expected, label) {
  const emitted = emittedFiles(path.join(example, actual));
  assert.deepEqual(emitted, emittedFiles(path.join(example, expected)), `${label}: different file sets`);
  assert.ok(emitted.includes("app.js") && emitted.includes("app.d.ts") && emitted.includes("app.js.map"));
  for (const file of emitted) {
    assert.equal(readFileSync(path.join(example, actual, file), "utf8"), readFileSync(path.join(example, expected, file), "utf8"), `${label}: emission differs for ${file}`);
  }
  return emitted;
}
assertSameEmission("dist", "dist-upstream", "Typers CLI and upstream");

const invalidDir = path.join(example, ".compatibility");
mkdirSync(invalidDir, { recursive: true });
writeFileSync(path.join(invalidDir, "invalid.ts"), 'const count: number = "invalid";\nexport { count };\n');
const negativeArgs = ["--ignoreConfig", "--noEmit", "--strict", "--types", "node", "--module", "NodeNext", ".compatibility/invalid.ts", "--pretty", "false"];
const badFork = cli(forkBin, negativeArgs);
const badUpstream = cli(upstreamBin, negativeArgs);
assert.equal(badFork.status, 1, "Type errors with --noEmit should report skipped output");
assert.equal(badFork.status, badUpstream.status);
assert.match(badFork.stdout, /TS2322/);
assert.equal(badFork.stdout, badUpstream.stdout);
assert.equal(badFork.stderr, badUpstream.stderr);

expectSuccess(cli(forkBin, ["-p", "tsconfig.typers.json"]));
const standardRejects = cli(upstreamBin, ["-p", "tsconfig.typers.json", "--noEmit"]);
assert.equal(standardRejects.error, undefined);
assert.notEqual(standardRejects.status, null);
assert.notEqual(standardRejects.status, 0, "Upstream unexpectedly accepted the Typers-only project");
assert.match(standardRejects.stdout, /TS1005/, "Upstream should reject the if-let grammar itself");
assert.match(standardRejects.stdout, /TS5023.*experimentalTypersSyntax/);

writeFileSync(path.join(invalidDir, "declarations.ts"), [
  'import type { PatternUsersService } from "../dist-typers/experimental.js";',
  'import type { User, UserNotFound } from "../dist-typers/app.js";',
  'import type { Result } from "@typers/core";',
  'declare const service: PatternUsersService;',
  'const result: Result<User, UserNotFound> = service.findById("1");',
  'if (result.kind === "ok") {',
  '  const user: User = result.value;',
  '  void user;',
  '} else {',
  '  const error: UserNotFound = result.error;',
  '  void error;',
  '}',
  '',
].join("\n"));
expectSuccess(cli(upstreamBin, [
  "--ignoreConfig", "--noEmit", "--strict", "--types", "node",
  "--module", "NodeNext", ".compatibility/declarations.ts", "--pretty", "false",
]));

const nativeApi = await testNativeApi(example);
for (const [config, base, outDir, expected] of [
  ["tsconfig.api.json", "./tsconfig.json", "dist-api", "dist"],
  ["tsconfig.api-typers.json", "./tsconfig.typers.json", "dist-api-typers", "dist-typers"],
]) {
  writeFileSync(path.join(example, config), JSON.stringify({ extends: base, compilerOptions: { outDir } }));
  const build = result(process.execPath, ["build-api.mjs", config]);
  expectSuccess(build);
  assert.match(build.stdout, /Typers native API: wrote \d+ files/);
  assert.equal(build.stderr, "");
  assertSameEmission(outDir, expected, `Native API and CLI (${config})`);
}
writeFileSync(path.join(example, "tsconfig.api-invalid.json"), JSON.stringify({
  extends: "./tsconfig.json",
  compilerOptions: { rootDir: ".compatibility", outDir: "dist-api-invalid", noEmitOnError: true },
  include: [".compatibility/invalid.ts"],
  exclude: [],
}));
const invalidApiBuild = result(process.execPath, ["build-api.mjs", "tsconfig.api-invalid.json"]);
assert.equal(invalidApiBuild.error, undefined);
assert.equal(invalidApiBuild.status, 1, invalidApiBuild.stdout + invalidApiBuild.stderr);
assert.match(invalidApiBuild.stderr, /TS2322/);
assert.equal(existsSync(path.join(example, "dist-api-invalid")), false, "An invalid API build wrote output");

const { NestFactory } = await import(pathToFileURL(requireFromExample.resolve("@nestjs/core")).href);
async function testHttp(module, label) {
  const app = await NestFactory.create(module, { logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const success = await fetch(`${base}/users/1`);
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), { id: "1", name: "Ada" });
    const failure = await fetch(`${base}/users/missing`);
    assert.equal(failure.status, 404);
    assert.deepEqual(await failure.json(), { kind: "UserNotFound", id: "missing" });
  } finally {
    await app.close();
  }
  console.log(`PASS: ${label} (DI, metadata, HTTP 200/404)`);
}
const { AppModule } = await import(pathToFileURL(path.join(example, "dist/app.js")).href);
await testHttp(AppModule, "NestJS standard TypeScript");
const { PatternAppModule } = await import(pathToFileURL(path.join(example, "dist-typers/experimental.js")).href);
await testHttp(PatternAppModule, "NestJS experimental if-let");
const apiApp = await import(pathToFileURL(path.join(example, "dist-api/app.js")).href);
await testHttp(apiApp.AppModule, "NestJS compiled through native API");
const apiPatternApp = await import(pathToFileURL(path.join(example, "dist-api-typers/experimental.js")).href);
await testHttp(apiPatternApp.PatternAppModule, "NestJS if-let compiled through native API");

const classicApi = requireFromExample("typescript");
const missing = ["getParsedCommandLineOfConfigFile", "createProgram", "createIncrementalProgram"].filter((key) => typeof classicApi[key] !== "function");
assert.equal(missing.length, 3);
const nestBin = path.join(root, "tooling/node_modules/@nestjs/cli/bin/nest.js");
const nestBuild = result(process.execPath, [nestBin, "build"]);
assert.equal(nestBuild.error, undefined);
assert.notEqual(nestBuild.status, null);
assert.notEqual(nestBuild.status, 0);
assert.match(nestBuild.stdout + nestBuild.stderr, /does not expose the programmatic compiler API/);

const report = {
  platform: `${process.platform}/${process.arch}`,
  node: process.version,
  compiler: installed.name,
  version: installed.version,
  upstreamVersion: "7.0.2",
  consumer: preparation,
  nestVersion: JSON.parse(readFileSync(path.join(example, "node_modules/@nestjs/core/package.json"), "utf8")).version,
  nestCliVersion: JSON.parse(readFileSync(path.join(root, "tooling/node_modules/@nestjs/cli/package.json"), "utf8")).version,
  standardEmission: "identical JS, declarations and source maps for this fixture",
  invalidTypes: "same TS2322 diagnostic and exit status",
  emittedDeclarations: "TypeScript 7.0.2 consumes declarations emitted from the if-let module",
  nativeApi,
  nativeApiEmission: "standard and if-let JS, declarations and maps identical to CLI; invalid build writes no files",
  nestRuntime: "standard and experimental modules from CLI and native API pass DI/metadata/HTTP tests",
  classicCompilerApi: { status: "known unsupported", missing },
  nestBuild: { status: "known unsupported", diagnostic: (nestBuild.stdout + nestBuild.stderr).trim() },
  oxcAndEditor: "not yet adapted or verified for if-let",
};
writeFileSync(path.join(root, "built/typers/compatibility.json"), JSON.stringify(report, null, 2) + "\n");
console.log("PASS: native CLI/API, package alias, standard output, invalid types and NestJS runtime.");
console.log("KNOWN UNSUPPORTED: Nest CLI compiler API; see built/typers/compatibility.json.");
