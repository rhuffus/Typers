import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync,
  readFileSync, symlinkSync, writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function write(file, contents) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

function writeJson(file, value) {
  write(file, JSON.stringify(value, null, 2) + "\n");
}

function filesUnder(directory) {
  if (!existsSync(directory)) return {};
  const files = {};
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `Unexpected symlink in inspected output: ${full}`);
    if (entry.isDirectory()) {
      for (const [file, contents] of Object.entries(filesUnder(full))) files[`${entry.name}/${file}`] = contents;
    } else {
      assert.ok(entry.isFile(), `Unexpected output entry: ${full}`);
      files[entry.name] = readFileSync(full).toString("base64");
    }
  }
  return files;
}

function assertSuccess(result, label) {
  if (result.error) throw result.error;
  assert.equal(result.signal, null, `${label}: process terminated by ${result.signal}`);
  assert.equal(result.status, 0, `${label}:\n${result.stdout}${result.stderr}`);
}

/** Test the explicit Nest adapter against an installed consumer, in isolated fixtures. */
export async function testNestBuilder(consumerDir) {
  const consumer = path.resolve(consumerDir);
  const nestBin = path.join(consumer, "node_modules/@typers/nest/bin/typers-nest.mjs");
  const nativeBin = path.join(consumer, "node_modules/typescript/bin/typers.cjs");
  assert.ok(existsSync(nestBin), "The consumer must contain the installed @typers/nest package");
  const requireFromConsumer = createRequire(path.join(consumer, "package.json"));
  assert.equal(requireFromConsumer("typescript/package.json").name, "@typers/compiler");
  const fixtures = path.join(consumer, ".nest-builder");
  mkdirSync(fixtures, { recursive: true });
  // Keep each invocation independent without deleting another test's files.
  const runRoot = mkdtempSync(path.join(fixtures, "run-"));
  const { TYPERS_BIN: _executableOverride, ...env } = process.env;
  const invoke = (bin, args, cwd) => spawnSync(process.execPath, [bin, ...args], {
    cwd, env, encoding: "utf8", timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
  });
  const build = (cwd, args = []) => invoke(nestBin, ["build", ...args], cwd);
  const successful = [];
  const rejected = [];

  function fixture(name, compilerOptions = {}, nestOptions = {}) {
    const directory = path.join(runRoot, name);
    mkdirSync(directory, { recursive: true });
    writeJson(path.join(directory, "package.json"), { private: true, type: "module" });
    write(path.join(directory, "src/index.ts"), "export const answer: number = 42;\n");
    const config = {
      compilerOptions: {
        target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true,
        types: [], declaration: true, declarationMap: true, sourceMap: true,
        rootDir: "src", outDir: "dist", ...compilerOptions,
      },
      files: ["src/index.ts"],
    };
    writeJson(path.join(directory, "tsconfig.json"), config);
    const nest = {
      sourceRoot: "src",
      compilerOptions: { tsConfigPath: "tsconfig.json", deleteOutDir: true, ...nestOptions },
    };
    writeJson(path.join(directory, "nest-cli.json"), nest);
    return { directory, config, nest };
  }

  function compareWithNative(directory, configFile, outputDirectory, args = []) {
    assertSuccess(invoke(nativeBin, ["-p", configFile, "--pretty", "false"], directory), "Native reference emission");
    const out = path.resolve(directory, outputDirectory);
    const expected = filesUnder(out);
    assert.ok(Object.keys(expected).some((name) => name.endsWith(".js")), "Reference emission has no JavaScript");
    assert.ok(Object.keys(expected).some((name) => name.endsWith(".d.ts")), "Reference emission has no declarations");
    assert.ok(Object.keys(expected).some((name) => name.endsWith(".js.map")), "Reference emission has no source maps");
    write(path.join(out, ".stale-output"), "delete only after a successful preflight\n");
    assertSuccess(build(directory, args), "Explicit Nest adapter build");
    assert.deepEqual(filesUnder(out), expected, "Adapter output differs byte-for-byte from native CLI output");
    return Object.keys(expected).length;
  }

  function rejectWithoutDeleting(label, directory, args = [], expectedMessage, outputDirectory = "dist") {
    const out = path.resolve(directory, outputDirectory);
    write(path.join(out, "sentinel.bin"), Buffer.from([0, 255, 1, 128, 13, 10]));
    write(path.join(out, "nested/sentinel.txt"), "existing build must survive\n");
    const before = filesUnder(out);
    const result = build(directory, args);
    if (result.error) throw result.error;
    assert.equal(result.signal, null, `${label}: process terminated unexpectedly`);
    assert.notEqual(result.status, null, `${label}: process did not exit`);
    assert.notEqual(result.status, 0, `${label}: unsupported build was accepted`);
    assert.match(result.stdout + result.stderr, expectedMessage, `${label}: unexpected diagnostic`);
    assert.deepEqual(filesUnder(out), before, `${label}: failed build changed existing output`);
    rejected.push(label);
  }

  const selection = fixture("selection", { outDir: "dist/root" });
  selection.nest.projects = {
    "service.v1": {
      type: "application", root: "apps/service.v1", sourceRoot: "apps/service.v1/src",
      compilerOptions: { tsConfigPath: "apps/service.v1/tsconfig.app.json" },
    },
  };
  writeJson(path.join(selection.directory, "nest-cli.json"), selection.nest);
  write(path.join(selection.directory, "apps/service.v1/src/index.ts"), 'export const selected = "service.v1";\n');
  writeJson(path.join(selection.directory, "apps/service.v1/tsconfig.app.json"), {
    compilerOptions: { ...selection.config.compilerOptions, rootDir: "src", outDir: "../../dist/service.v1" },
    files: ["src/index.ts"],
  });
  compareWithNative(selection.directory, "tsconfig.json", "dist/root");
  const rootEmission = filesUnder(path.join(selection.directory, "dist/root"));
  compareWithNative(selection.directory, "apps/service.v1/tsconfig.app.json", "dist/service.v1", ["service.v1"]);
  assert.deepEqual(filesUnder(path.join(selection.directory, "dist/root")), rootEmission, "Project build changed root output");
  assert.match(readFileSync(path.join(selection.directory, "dist/service.v1/index.js"), "utf8"), /service\.v1/);
  successful.push("root selection and dotted project name; inherited deleteOutDir; identical JS/d.ts/maps");

  const overrides = fixture("overrides");
  write(path.join(overrides.directory, "alternate/input.ts"), 'export const selected = "alternate config";\n');
  writeJson(path.join(overrides.directory, "tsconfig.alternate.json"), {
    compilerOptions: { ...overrides.config.compilerOptions, rootDir: "alternate", outDir: "dist-config" },
    files: ["alternate/input.ts"],
  });
  writeJson(path.join(overrides.directory, "nest.alternate.json"), {
    sourceRoot: "alternate", compilerOptions: { tsConfigPath: "tsconfig.alternate.json", deleteOutDir: true },
  });
  compareWithNative(overrides.directory, "tsconfig.alternate.json", "dist-config", ["-c", "nest.alternate.json"]);
  writeJson(path.join(overrides.directory, "tsconfig.override.json"), {
    compilerOptions: { ...overrides.config.compilerOptions, outDir: "dist-path" }, files: ["src/index.ts"],
  });
  compareWithNative(overrides.directory, "tsconfig.override.json", "dist-path", [
    "--config", "nest.alternate.json", "--path", "tsconfig.override.json",
  ]);
  compareWithNative(overrides.directory, "tsconfig.override.json", "dist-path", ["-p", "tsconfig.override.json"]);
  successful.push("alternate configuration and short/long tsconfig path overrides");

  const assets = fixture("assets", {}, { assets: [
    "templates/**/*",
    { include: "images/**/*", exclude: "images/private/**", outDir: "public-assets" },
  ] });
  const binary = Buffer.from([0, 1, 127, 128, 254, 255, 10, 13]);
  write(path.join(assets.directory, "src/templates/nested/email.txt"), "hello {{name}}\n");
  write(path.join(assets.directory, "src/templates/.hidden/config.txt"), "hidden directory\n");
  write(path.join(assets.directory, "src/images/.hidden.bin"), binary);
  write(path.join(assets.directory, "src/images/icons/logo.bin"), binary);
  write(path.join(assets.directory, "src/images/private/secret.bin"), binary);
  write(path.join(assets.directory, "src/unselected.txt"), "not selected\n");
  write(path.join(assets.directory, "dist/stale.txt"), "stale\n");
  assertSuccess(build(assets.directory), "Asset copy");
  assert.equal(existsSync(path.join(assets.directory, "dist/stale.txt")), false);
  assert.equal(readFileSync(path.join(assets.directory, "dist/templates/nested/email.txt"), "utf8"), "hello {{name}}\n");
  assert.equal(readFileSync(path.join(assets.directory, "dist/templates/.hidden/config.txt"), "utf8"), "hidden directory\n");
  assert.deepEqual(readFileSync(path.join(assets.directory, "public-assets/images/.hidden.bin")), binary);
  assert.deepEqual(readFileSync(path.join(assets.directory, "public-assets/images/icons/logo.bin")), binary);
  assert.equal(existsSync(path.join(assets.directory, "public-assets/images/private/secret.bin")), false);
  assert.equal(existsSync(path.join(assets.directory, "dist/unselected.txt")), false);
  successful.push("asset strings/objects, nested paths, excludes, hidden files and binary bytes");

  const wideRoot = fixture("assets-wide-root", { rootDir: "." }, { assets: ["templates/**/*.txt"] });
  write(path.join(wideRoot.directory, "src/templates/nested/message.txt"), "relative to TypeScript rootDir\n");
  assertSuccess(build(wideRoot.directory), "Asset paths with rootDir distinct from sourceRoot");
  assert.equal(readFileSync(path.join(wideRoot.directory, "dist/src/templates/nested/message.txt"), "utf8"), "relative to TypeScript rootDir\n");
  assert.equal(existsSync(path.join(wideRoot.directory, "dist/templates")), false);
  successful.push("asset hierarchy relative to explicit rootDir when sourceRoot is nested");

  const invalid = fixture("invalid-types");
  write(path.join(invalid.directory, "src/index.ts"), 'export const answer: number = "incorrect";\n');
  rejectWithoutDeleting("TS2322", invalid.directory, [], /TS2322/);
  const noEmit = fixture("no-emit", { noEmit: true }, { assets: ["template.txt"] });
  write(path.join(noEmit.directory, "src/template.txt"), "new asset must not be copied\n");
  write(path.join(noEmit.directory, "dist/sentinel.bin"), binary);
  write(path.join(noEmit.directory, "dist/template.txt"), "previous good asset\n");
  const noEmitBefore = filesUnder(path.join(noEmit.directory, "dist"));
  const checked = build(noEmit.directory, ["--json"]);
  assertSuccess(checked, "noEmit check");
  const checkedReport = JSON.parse(checked.stdout);
  assert.equal(checkedReport.success, true);
  assert.equal(checkedReport.emitSkipped, true);
  assert.deepEqual(checkedReport.emittedFiles, []);
  assert.deepEqual(checkedReport.assetFiles, []);
  assert.deepEqual(filesUnder(path.join(noEmit.directory, "dist")), noEmitBefore, "noEmit changed existing output/assets");
  successful.push("noEmit check succeeds without changing existing output or assets");
  for (const [label, option, message] of [
    ["paths", { paths: { "@app/*": ["./src/*"] } }, /paths/i],
    ["incremental", { incremental: true }, /incremental/i],
    ["missing explicit outDir", { outDir: undefined }, /outDir/i],
  ]) {
    const current = fixture(label, option);
    rejectWithoutDeleting(label, current.directory, [], message);
  }
  const plugins = fixture("plugins", {}, { plugins: [{ name: "@nestjs/swagger" }] });
  rejectWithoutDeleting("plugins", plugins.directory, [], /plugin/i);
  const implicitAssetRoot = fixture("implicit-asset-root", { rootDir: undefined }, { assets: ["asset.txt"] });
  write(path.join(implicitAssetRoot.directory, "src/asset.txt"), "needs explicit rootDir\n");
  rejectWithoutDeleting("assets need explicit rootDir", implicitAssetRoot.directory, [], /rootDir/i);
  const unknown = fixture("unknown-project");
  rejectWithoutDeleting("unknown project", unknown.directory, ["missing.project"], /project|missing\.project/i);
  for (const option of ["--watch", "--all"]) {
    rejectWithoutDeleting(`unsupported ${option}`, unknown.directory, [option], /unknown|unsupported|option/i);
  }

  const outside = fixture("outside-output", { outDir: "../outside-output-target" });
  rejectWithoutDeleting("outside output", outside.directory, [], /outDir|outside|within|escape/i, "../outside-output-target");
  const overlap = fixture("overlap", { outDir: "src" });
  rejectWithoutDeleting("source/output overlap", overlap.directory, [], /overlap|source|outDir/i, "src");
  for (const transitive of [false, true]) {
    const label = transitive ? "transitive inherited config in output" : "inherited config in output";
    const inherited = fixture(transitive ? "extends-transitive" : "extends-direct");
    inherited.config.extends = transitive ? "./configs/intermediate.json" : "./dist/base.json";
    writeJson(path.join(inherited.directory, "tsconfig.json"), inherited.config);
    writeJson(path.join(inherited.directory, "dist/base.json"), { compilerOptions: { strict: true } });
    if (transitive) {
      writeJson(path.join(inherited.directory, "configs/intermediate.json"), { extends: "../dist/base.json" });
    }
    const configFiles = ["tsconfig.json", "dist/base.json", ...(transitive ? ["configs/intermediate.json"] : [])];
    const previousConfigs = configFiles.map((name) => readFileSync(path.join(inherited.directory, name)));
    rejectWithoutDeleting(label, inherited.directory, [], /overlap|protected/i);
    for (let index = 0; index < configFiles.length; index++) {
      assert.deepEqual(readFileSync(path.join(inherited.directory, configFiles[index])), previousConfigs[index],
        `${label}: changed configuration ${configFiles[index]}`);
    }
  }
  const collision = fixture("collision", {}, { assets: ["index.js"] });
  write(path.join(collision.directory, "src/index.js"), "asset collides with compiler output\n");
  rejectWithoutDeleting("asset/compiler collision", collision.directory, [], /colli|conflict|same.*file|duplicate/i);
  const outsideAsset = fixture("outside-asset", {}, { assets: [{ include: "asset.txt", outDir: "../outside-asset-target" }] });
  write(path.join(outsideAsset.directory, "src/asset.txt"), "must not escape\n");
  rejectWithoutDeleting("outside asset output", outsideAsset.directory, [], /outDir|outside|within|escape/i);
  assert.equal(existsSync(path.join(runRoot, "outside-asset-target")), false);

  const symlinkOutput = fixture("symlink-output");
  const symlinkTarget = path.join(runRoot, "symlink-output-target");
  mkdirSync(symlinkTarget);
  symlinkSync(symlinkTarget, path.join(symlinkOutput.directory, "dist"), "dir");
  rejectWithoutDeleting("symlink output", symlinkOutput.directory, [], /symlink|symbolic/i, symlinkTarget);
  assert.equal(lstatSync(path.join(symlinkOutput.directory, "dist")).isSymbolicLink(), true);
  const symlinkAsset = fixture("symlink-asset", {}, { assets: ["linked.txt"] });
  const externalAsset = path.join(runRoot, "external-asset.txt");
  write(externalAsset, "external asset remains unchanged\n");
  symlinkSync(externalAsset, path.join(symlinkAsset.directory, "src/linked.txt"), "file");
  rejectWithoutDeleting("symlink asset", symlinkAsset.directory, [], /symlink|symbolic/i);
  assert.equal(readFileSync(externalAsset, "utf8"), "external asset remains unchanged\n");

  const apiDeclarationFile = path.join(runRoot, "adapter-api.mts");
  write(apiDeclarationFile, [
    'import { buildNest, type NestBuildOptions, type NestBuildResult } from "@typers/nest";',
    'const options: NestBuildOptions = { cwd: ".", project: "service.v1", compilerPackage: "typescript" };',
    'const result: Promise<NestBuildResult> = buildNest(options);',
    'const report = await result;',
    'const emitted: readonly string[] = report.emittedFiles;',
    'const skipped: boolean = report.emitSkipped;',
    '// @ts-expect-error Only explicitly supported compiler package names are accepted.',
    'const invalid: NestBuildOptions = { compilerPackage: "unrelated-compiler" };',
    'void [emitted, skipped, invalid];',
    '',
  ].join("\n"));
  assertSuccess(invoke(nativeBin, [
    "--ignoreConfig", "--noEmit", "--strict", "--target", "ES2022", "--module", "NodeNext",
    "--moduleResolution", "NodeNext", "--types", "node", "--pretty", "false", apiDeclarationFile,
  ], runRoot), "Installed adapter API declarations");
  successful.push("installed buildNest API declarations type-check with native Typers");

  const { NestFactory } = await import(pathToFileURL(requireFromConsumer.resolve("@nestjs/core")).href);
  async function verifyHttp(module, label) {
    const app = await NestFactory.create(module, { logger: false });
    try {
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl();
      const success = await fetch(`${base}/users/1`);
      assert.equal(success.status, 200, label);
      assert.deepEqual(await success.json(), { id: "1", name: "Ada" }, label);
      const failure = await fetch(`${base}/users/missing`);
      assert.equal(failure.status, 404, label);
      assert.deepEqual(await failure.json(), { kind: "UserNotFound", id: "missing" }, label);
    } finally {
      await app.close();
    }
  }
  const nestEmission = {};
  for (const [label, configFile, outDir, moduleFile, exportName] of [
    ["standard", "tsconfig.json", "dist", "app.js", "AppModule"],
    ["if-let", "tsconfig.typers.json", "dist-typers", "experimental.js", "PatternAppModule"],
  ]) {
    const current = fixture(`nest-${label}`);
    cpSync(path.join(consumer, "src"), path.join(current.directory, "src"), { recursive: true });
    for (const name of ["tsconfig.json", "tsconfig.typers.json"]) {
      cpSync(path.join(consumer, name), path.join(current.directory, name));
    }
    writeJson(path.join(current.directory, "nest-cli.json"), {
      sourceRoot: "src", compilerOptions: { tsConfigPath: configFile, deleteOutDir: true },
    });
    nestEmission[label] = compareWithNative(current.directory, configFile, outDir);
    const emitted = await import(pathToFileURL(path.join(current.directory, outDir, moduleFile)).href);
    await verifyHttp(emitted[exportName], label);
  }
  successful.push("standard Nest and if-let: identical CLI emission, DI/metadata and HTTP 200/404");
  return {
    adapter: "@typers/nest (explicit native API build)",
    counts: { positiveGroups: successful.length, rejectedBuilds: rejected.length },
    passed: successful,
    rejectedWithoutOutputChanges: rejected,
    nestEmissionFiles: nestEmission,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv[2], "Usage: node tooling/test-nest-builder.mjs <installed-consumer-directory>");
  console.log(JSON.stringify(await testNestBuilder(process.argv[2]), null, 2));
}
