import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../scripts/compiler.mjs";

for (const fixture of ["positive.mts", "positive.cts", "expected-errors.mts"]) {
  test(`tipos: ${fixture}`, () => {
    const result = compile([
      "--strict",
      "--noEmit",
      "--target", "ES2022",
      "--module", "NodeNext",
      "--moduleResolution", "NodeNext",
      "--pretty", "false",
      `test/types/${fixture}`,
    ]);

    assert.equal(
      result.status,
      0,
      `El contrato de tipos falló:\n${result.stdout}${result.stderr}`,
    );
  });
}
