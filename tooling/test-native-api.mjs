import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Exercise the native API from the installed compiler, without an executable override. */
export async function testNativeApi(consumerDir) {
  const consumer = path.resolve(consumerDir);
  const requireFromConsumer = createRequire(path.join(consumer, "package.json"));
  const metadata = requireFromConsumer("typescript/package.json");
  assert.equal(metadata.name, "@typers/compiler");
  const load = (name) => import(pathToFileURL(requireFromConsumer.resolve(`typescript/unstable/${name}`)).href);
  const routes = ["sync", "async", "fs", "proto", "ast", "ast/is", "ast/factory", "ast/utils", "ast/scanner", "ast/visitor", "ast/clone"];
  const entries = await Promise.all(routes.map(async (route) => [route, await load(route)]));
  const modules = Object.fromEntries(entries);
  const ast = modules.ast;
  const factory = modules["ast/factory"];
  assert.equal(typeof modules.fs.createVirtualFileSystem, "function");
  assert.equal(typeof modules["ast/is"].isIdentifier, "function");
  assert.equal(typeof modules["ast/visitor"].visitEachChild, "function");
  assert.equal(typeof modules["ast/scanner"].createScanner, "function");
  assert.equal(typeof modules["ast/clone"].getSynthesizedDeepClone, "function");
  assert.equal(modules["ast/utils"].formatSyntaxKind(ast.SyntaxKind.Identifier), "Identifier");

  const fixture = path.join(consumer, ".native-api");
  mkdirSync(fixture, { recursive: true });
  const configFile = path.join(fixture, "tsconfig.json");
  const inputFile = path.join(fixture, "input.ts");
  const invalidFile = path.join(fixture, "invalid.ts");
  const typersFile = path.join(fixture, "pattern.ts");
  const source = "export const answer: number = 42;\n";
  writeFileSync(inputFile, source);
  writeFileSync(invalidFile, 'export const invalid: number = "incorrect";\n');
  writeFileSync(typersFile, [
    'declare const option: { kind: "some"; value: number } | { kind: "none" };',
    'export function valueOrZero(): number {',
    '  if let Some(value) = option { return value; }',
    '  return 0;',
    '}',
    '',
  ].join("\n"));
  writeFileSync(configFile, JSON.stringify({
    compilerOptions: {
      strict: true,
      target: "ES2022",
      module: "NodeNext",
      types: [],
      experimentalTypersSyntax: true,
      declaration: true,
      sourceMap: true,
      outDir: "emitted",
    },
    files: ["input.ts", "invalid.ts", "pattern.ts"],
  }, null, 2) + "\n");

  const clients = {};
  for (const mode of ["sync", "async"]) {
    // Deliberately omit tsserverPath: this checks the packaged #getExePath resolver.
    const api = new modules[mode].API({ cwd: fixture });
    try {
      const config = await api.parseConfigFile(configFile);
      assert.deepEqual(new Set(config.fileNames), new Set([inputFile, invalidFile, typersFile]));
      const snapshot = await api.updateSnapshot({ openProject: configFile });
      const project = snapshot.getProject(configFile);
      assert.ok(project, `${mode}: project did not open`);
      assert.deepEqual(await project.program.getProgramDiagnostics(), []);
      assert.deepEqual(await project.program.getSyntacticDiagnostics(), []);
      assert.deepEqual(await project.program.getSemanticDiagnostics(inputFile), []);
      assert.deepEqual(await project.program.getSemanticDiagnostics(typersFile), []);
      const invalid = await project.program.getSemanticDiagnostics(invalidFile);
      assert.equal(invalid.length, 1);
      assert.equal(invalid[0].code, 2322);

      const sourceFile = await project.program.getSourceFile(inputFile);
      assert.ok(sourceFile);
      assert.equal(sourceFile.kind, ast.SyntaxKind.SourceFile);
      assert.equal(sourceFile.text, source);
      assert.ok(ast.isVariableStatement(sourceFile.statements[0]));
      const declaration = sourceFile.statements[0].declarationList.declarations[0];
      assert.equal(declaration.name.getText(), "answer");
      const type = await project.checker.getTypeAtLocation(declaration.name);
      assert.ok(type);
      assert.equal(await project.checker.typeToString(type), "number");
      const symbol = await project.checker.getSymbolAtLocation(declaration.name);
      assert.equal(symbol?.name, "answer");

      const union = factory.createUnionTypeNode([
        factory.createKeywordTypeNode(ast.SyntaxKind.StringKeyword),
        factory.createKeywordTypeNode(ast.SyntaxKind.NumberKeyword),
      ]);
      const cloned = modules["ast/clone"].getSynthesizedDeepClone(union);
      assert.notEqual(cloned, union);
      assert.equal(await project.emitter.printNode(union), "string | number");
      assert.equal(await project.emitter.printNode(cloned), "string | number");
      assert.equal(existsSync(path.join(fixture, "emitted")), false);
      const emission = await project.typersEmitProject();
      assert.equal(emission.emitSkipped, false);
      const filenames = emission.outputs.map((output) => output.fileName);
      assert.deepEqual(filenames, [...filenames].sort());
      for (const name of ["input.js", "input.d.ts", "input.js.map", "pattern.js", "pattern.d.ts"]) {
        assert.ok(emission.outputs.some((output) => path.basename(output.fileName) === name), `${mode}: missing captured ${name}`);
      }
      const js = emission.outputs.find((output) => path.basename(output.fileName) === "input.js").text;
      const evaluated = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
      assert.equal(evaluated.answer, 42);
      const patternJs = emission.outputs.find((output) => path.basename(output.fileName) === "pattern.js").text;
      assert.doesNotMatch(patternJs, /if\s+let\s+Some/);
      assert.equal(existsSync(path.join(fixture, "emitted")), false, "API emission must not write captured output files");

      const blockedConfig = path.join(fixture, "tsconfig.blocked.json");
      writeFileSync(blockedConfig, JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { noEmitOnError: true } }));
      const blockedSnapshot = await api.updateSnapshot({ openProject: blockedConfig });
      const blockedProject = blockedSnapshot.getProject(blockedConfig);
      assert.ok(blockedProject);
      const blockedEmission = await blockedProject.typersEmitProject();
      assert.equal(blockedEmission.emitSkipped, true);
      assert.deepEqual(blockedEmission.outputs, []);
      assert.ok(blockedEmission.diagnostics.some((diagnostic) => diagnostic.code === 2322));
      clients[mode] = {
        configuration: "parsed",
        diagnostics: "valid TS/if-let plus expected TS2322",
        astAndTypes: "source, variable, symbol and number type verified",
        printer: "factory and cloned AST printed through the native process",
        emission: "JS/declarations/maps captured without disk writes; noEmitOnError respected",
        executable: "default packaged binary",
      };
    } finally {
      await api.close();
    }
  }

  const typeFixture = path.join(fixture, "consumer.mts");
  writeFileSync(typeFixture, [
    'import { API } from "typescript/unstable/sync";',
    'import { API as AsyncAPI } from "typescript/unstable/async";',
    'import { SyntaxKind, type Node } from "typescript/unstable/ast";',
    'import { createKeywordTypeNode } from "typescript/unstable/ast/factory";',
    'const node: Node = createKeywordTypeNode(SyntaxKind.StringKeyword);',
    'declare const sync: API;',
    'const syncProject = sync.updateSnapshot({ openProject: "tsconfig.json" }).getProject("tsconfig.json");',
    'const printed: string | undefined = syncProject?.emitter.printNode(node);',
    'const skipped: boolean | undefined = syncProject?.typersEmitProject().emitSkipped;',
    'declare const asynchronous: AsyncAPI;',
    'const config = await asynchronous.parseConfigFile("tsconfig.json");',
    'const files: readonly string[] = config.fileNames;',
    '// @ts-expect-error The native API does not pretend to expose the legacy facade.',
    'sync.createProgram([], {});',
    'void [printed, files, skipped];',
    '',
  ].join("\n"));
  const nativeCli = path.join(consumer, "node_modules/typescript/bin/typers.cjs");
  const result = spawnSync(process.execPath, [
    nativeCli, "--ignoreConfig", "--noEmit", "--strict", "--target", "ES2022",
    "--module", "NodeNext", "--moduleResolution", "NodeNext", "--types", "node",
    "--pretty", "false", typeFixture,
  ], { cwd: consumer, encoding: "utf8" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Installed API declarations failed:\n${result.stdout}${result.stderr}`);

  return { exports: routes, clients, declarations: "installed sync/async APIs type-check with native Typers" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv[2], "Usage: node tooling/test-native-api.mjs <installed-consumer-directory>");
  console.log(JSON.stringify(await testNativeApi(process.argv[2]), null, 2));
}
