import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadNestConfig } from "../src/config.mjs";
import { planAssets } from "../src/assets.mjs";
import { assertInsideWorkspace, assertOutputPaths } from "../src/paths.mjs";

function workspace(t) {
  const cwd = realpathSync(mkdtempSync(path.join(os.tmpdir(), "typers-nest-config-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const file = (name, contents = "{}") => {
    const target = path.join(cwd, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, typeof contents === "object" && !Buffer.isBuffer(contents) ? JSON.stringify(contents) : contents);
    return target;
  };
  file("tsconfig.json");
  file("src/main.ts", "export {};\n");
  return { cwd, file };
}

test("configuration discovery, defaults and build tsconfig preference", (t) => {
  const { cwd, file } = workspace(t);
  assert.deepEqual(loadNestConfig({ cwd }), {
    configFile: null,
    tsconfig: path.join(cwd, "tsconfig.json"),
    sourceRoot: path.join(cwd, "src"),
    compilerOptions: { assets: [], deleteOutDir: false },
  });
  file("tsconfig.build.json");
  file(".nest-cli.json", { sourceRoot: "fallback" });
  assert.equal(loadNestConfig({ cwd }).sourceRoot, path.join(cwd, "fallback"));
  file("nest-cli.json", { sourceRoot: "preferred" });
  assert.equal(loadNestConfig({ cwd }).sourceRoot, path.join(cwd, "preferred"));
  assert.equal(loadNestConfig({ cwd }).tsconfig, path.join(cwd, "tsconfig.build.json"));
});

test("project values override by property; arrays replace and config paths stay relative to cwd", (t) => {
  const { cwd, file } = workspace(t);
  file("root.json");
  file("selected.json");
  file("override.json");
  file("config/nest.json", {
    sourceRoot: "src", compilerOptions: { tsConfigPath: "root.json", assets: ["**/*.graphql"], deleteOutDir: true, plugins: ["legacy-plugin"] },
    projects: { "api.v1": { root: "apps/ignored-prefix", sourceRoot: "apps/api/src", compilerOptions: { tsConfigPath: "selected.json", assets: [], plugins: [], deleteOutDir: false } } },
  });
  const loaded = loadNestConfig({ cwd, config: "config/nest.json", project: "api.v1" });
  assert.equal(loaded.sourceRoot, path.join(cwd, "apps/api/src"));
  assert.equal(loaded.tsconfig, path.join(cwd, "selected.json"));
  assert.deepEqual(loaded.compilerOptions.assets, []);
  assert.equal(loaded.compilerOptions.deleteOutDir, false);
  assert.equal(loadNestConfig({ cwd, config: "config/nest.json", project: "api.v1", path: "override.json" }).tsconfig, path.join(cwd, "override.json"));
});

test("builder configPath fallback and root selection without a project name", (t) => {
  const { cwd, file } = workspace(t);
  file("builder.json");
  file("nest-cli.json", { compilerOptions: { builder: { type: "tsc", options: { configPath: "builder.json" } } }, projects: { api: { sourceRoot: "apps/api/src" } } });
  const loaded = loadNestConfig({ cwd });
  assert.equal(loaded.tsconfig, path.join(cwd, "builder.json"));
  assert.equal(loaded.sourceRoot, path.join(cwd, "src"));
  assert.throws(() => loadNestConfig({ cwd, project: "missing" }), /Unknown Nest project/);
  assert.throws(() => loadNestConfig({ cwd, project: "toString" }), /Unknown Nest project/);
  file("nest-cli.json", { compilerOptions: { tsConfigPath: "tsconfig.json", builder: { type: "tsc", options: { configPath: "builder.json" } } } });
  assert.equal(loadNestConfig({ cwd }).tsconfig, path.join(cwd, "tsconfig.json"));
  file("nest-cli.json", { compilerOptions: { builder: { type: "typers", options: { configPath: "builder.json" } } } });
  assert.equal(loadNestConfig({ cwd }).tsconfig, path.join(cwd, "builder.json"));
});

test("invalid and unsupported configuration fails explicitly", (t) => {
  const { cwd, file } = workspace(t);
  assert.throws(() => loadNestConfig({ cwd, config: "absent.json" }), /existing file/);
  file("nest-cli.json", "{ // comments are not JSON\n}");
  assert.throws(() => loadNestConfig({ cwd }), /Could not parse Nest/);
  const cases = [
    { typo: true },
    { compilerOptions: { typo: true } },
    { compilerOptions: { builder: "swc" } },
    { compilerOptions: { builder: { type: "tsc", options: { typo: true } } } },
    { compilerOptions: { plugins: ["@nestjs/swagger"] } },
    { compilerOptions: { assets: [{ include: "*.graphql", flat: true }] } },
    { compilerOptions: { assets: [{ include: "*.graphql", watchAssets: true }] } },
    { compilerOptions: { assets: [{ include: "*.graphql", typo: true }] } },
    { compilerOptions: { assets: [{ exclude: "*.graphql" }] } },
    { compilerOptions: { deleteOutDir: "true" } },
    { compilerOptions: { includeLibraryAssets: ["lib"] } },
    { compilerOptions: { allowOutsidePaths: true } },
  ];
  for (const configuration of cases) {
    file("nest-cli.json", configuration);
    assert.throws(() => loadNestConfig({ cwd }), undefined, JSON.stringify(configuration));
  }
});

test("assets retain binary bytes, dotfiles and nested layout relative to TypeScript rootDir", (t) => {
  const { cwd, file } = workspace(t);
  file("apps/api/src/schema/query.graphql", "type Query { answer: Int }\n");
  file("apps/api/src/schema/private.graphql", "private");
  file("apps/api/src/templates/.hidden.hbs", Buffer.from([0, 1, 254, 255]));
  const output = planAssets({ cwd, sourceRoot: path.join(cwd, "apps/api/src"), rootDir: path.join(cwd, "apps"), outDir: path.join(cwd, "dist"), assets: [
    { include: "**/*.graphql", exclude: "**/private.graphql" },
    { include: "templates", outDir: "public" },
  ] });
  assert.deepEqual(output.map((item) => path.relative(cwd, item.fileName)), ["dist/api/src/schema/query.graphql", "public/api/src/templates/.hidden.hbs"].map((name) => name.split("/").join(path.sep)));
  assert.deepEqual(output[1].contents, Buffer.from([0, 1, 254, 255]));
  assert.equal(existsSync(path.join(cwd, "dist")), false);
  assert.equal(existsSync(path.join(cwd, "public")), false);
  assert.ok(output.every((item) => Buffer.isBuffer(item.contents) && path.isAbsolute(item.sourceFile)));
});

test("minimatch braces, excludes, directory expansion and repeated identical entries", (t) => {
  const { cwd, file } = workspace(t);
  file("src/resources/a.json", "a");
  file("src/resources/b.graphql", "b");
  file("src/resources/private/hidden.json", "hidden");
  file("src/resources/nested/c.json", "c");
  const parameters = { cwd, sourceRoot: path.join(cwd, "src"), rootDir: path.join(cwd, "src"), outDir: path.join(cwd, "dist") };
  const output = planAssets({ ...parameters, assets: [{ include: "**/*.{json,graphql}", exclude: "resources/private/**" }, "resources/a.json"] });
  assert.deepEqual(output.map((item) => item.contents.toString()), ["a", "b", "c"]);
  assert.equal(planAssets({ ...parameters, assets: ["resources/*"] }).length, 2, "trailing star copies matching files, not directory descendants");
  assert.equal(planAssets({ ...parameters, assets: ["resources"] }).length, 4, "literal directories include descendants");
  assert.deepEqual(planAssets({ ...parameters, assets: ["missing/**/*.json"] }), []);
});

test("asset plans reject escapes, unsupported entries and missing explicit rootDir", (t) => {
  const { cwd, file } = workspace(t);
  file("src/data/a.json", "a");
  const parameters = { cwd, sourceRoot: path.join(cwd, "src"), rootDir: path.join(cwd, "src"), outDir: path.join(cwd, "dist") };
  assert.deepEqual(planAssets({ cwd, assets: [] }), []);
  assert.throws(() => planAssets({ ...parameters, rootDir: undefined, assets: ["**/*.json"] }), /explicit.*rootDir/);
  for (const include of ["../outside.json", "/outside.json", "C:/outside.json", "data\\*.json", "node_modules/**/*"]) {
    assert.throws(() => planAssets({ ...parameters, assets: [include] }));
  }
  assert.throws(() => planAssets({ ...parameters, assets: [{ include: "**/*.json", outDir: "../outside" }] }), /inside the workspace/);
  assert.throws(() => planAssets({ ...parameters, rootDir: path.join(cwd, "other"), assets: ["**/*.json"] }), /inside TypeScript rootDir/);
});

test("asset patterns treat leading exclamation and hash as literal filenames", (t) => {
  const { cwd, file } = workspace(t);
  file("src/!literal.txt", "exclamation");
  file("src/#literal.txt", "hash");
  file("src/other.txt", "not selected");
  const output = planAssets({ cwd, sourceRoot: path.join(cwd, "src"), rootDir: path.join(cwd, "src"), outDir: path.join(cwd, "dist"), assets: ["!literal.txt", "#literal.txt"] });
  assert.deepEqual(output.map((item) => item.contents.toString()), ["exclamation", "hash"]);
});

test("workspace confinement rejects reserved directories and symlink ancestors", (t) => {
  const { cwd, file } = workspace(t);
  assert.equal(assertInsideWorkspace(cwd, "dist/app.js"), path.join(cwd, "dist/app.js"));
  for (const target of [cwd, "../outside", "node_modules/owned", ".git/owned", "dist/node_modules/owned"]) {
    assert.throws(() => assertInsideWorkspace(cwd, target));
  }
  mkdirSync(path.join(cwd, "actual"));
  symlinkSync(path.join(cwd, "actual"), path.join(cwd, "linked"), "dir");
  assert.throws(() => assertInsideWorkspace(cwd, "linked/new/file.js"), /symlink/);
  const source = file("src/actual.json", "source");
  symlinkSync(source, path.join(cwd, "src/link.json"));
  assert.throws(() => planAssets({ cwd, sourceRoot: path.join(cwd, "src"), rootDir: path.join(cwd, "src"), outDir: path.join(cwd, "dist"), assets: ["*.json"] }), /symlink/);
});

test("asset traversal prunes excluded and unrelated symlinked directories", (t) => {
  const { cwd, file } = workspace(t);
  file("src/selected/a.json", "selected");
  file("private/private.json", "private");
  symlinkSync(path.join(cwd, "private"), path.join(cwd, "src/skip"), "dir");
  const parameters = { cwd, sourceRoot: path.join(cwd, "src"), rootDir: path.join(cwd, "src"), outDir: path.join(cwd, "dist") };
  assert.equal(planAssets({ ...parameters, assets: ["selected/*.json"] }).length, 1);
  assert.equal(planAssets({ ...parameters, assets: [{ include: "**/*.json", exclude: "skip/**" }] }).length, 1);
  assert.throws(() => planAssets({ ...parameters, assets: ["**/*.json"] }), /symlink/);
});

test("output validation prevents collisions and cleanup of protected files without changing anything", (t) => {
  const { cwd, file } = workspace(t);
  const original = file("dist/previous.js", "previous");
  const parameters = { cwd, outputRoots: [path.join(cwd, "dist")], protectedPaths: [path.join(cwd, "src"), path.join(cwd, "tsconfig.json")] };
  assert.doesNotThrow(() => assertOutputPaths({ ...parameters, files: [{ fileName: path.join(cwd, "dist/new.js") }] }));
  for (const files of [
    [{ fileName: path.join(cwd, "dist/a.js") }, { fileName: path.join(cwd, "dist/a.js") }],
    [{ fileName: path.join(cwd, "dist/a") }, { fileName: path.join(cwd, "dist/a/b.js") }],
    [{ fileName: path.join(cwd, "elsewhere/a.js") }],
    [{ fileName: path.join(cwd, "dist") }],
  ]) assert.throws(() => assertOutputPaths({ ...parameters, files }));
  assert.throws(() => assertOutputPaths({ ...parameters, outputRoots: [path.join(cwd, "src")], files: [] }), /protected/);
  assert.throws(() => assertOutputPaths({ ...parameters, outputRoots: [path.join(cwd, "src/generated")], files: [] }), /protected/);
  assert.throws(() => assertOutputPaths({ ...parameters, protectedPaths: [path.join(cwd, "dist/base-config.json")], files: [] }), /protected/);
  assert.equal(readFileSync(original, "utf8"), "previous");
});

test("case-insensitive filesystems cannot bypass source protection or create colliding outputs", (t) => {
  const { cwd } = workspace(t);
  if (!existsSync(path.join(cwd, "SRC"))) return t.skip("Workspace filesystem is case-sensitive");
  assert.throws(() => assertOutputPaths({ cwd, outputRoots: [path.join(cwd, "SRC")], files: [], protectedPaths: [path.join(cwd, "src")] }), /protected/);
  assert.throws(() => assertOutputPaths({ cwd, outputRoots: [path.join(cwd, "dist")], files: [
    { fileName: path.join(cwd, "dist/A.js") }, { fileName: path.join(cwd, "dist/a.js") },
  ] }), /same file/);
});
