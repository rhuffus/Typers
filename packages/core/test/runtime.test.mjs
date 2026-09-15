import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import * as esm from "@typers/core";

const require = createRequire(import.meta.url);
const cjs = require("@typers/core");

for (const [format, core] of [["ESM", esm], ["CommonJS", cjs]]) {
  test(`${format}: Some conserva valores falsy y referencias`, () => {
    const reference = { id: "user-1" };

    for (const value of [false, 0, -0, "", undefined, null, NaN, reference]) {
      const result = core.Some(value);
      assert.equal(result.kind, "some");
      assert.ok(Object.is(result.value, value));
      assert.notEqual(result, core.None);
    }

    assert.notEqual(core.Some(1), core.Some(1));
  });

  test(`${format}: None es ausencia compartida y no se puede corromper`, () => {
    assert.deepEqual(core.None, { kind: "none" });
    assert.equal(core.fromNullable(null), core.None);
    assert.equal(core.fromNullable(undefined), core.None);
    assert.equal(Object.isFrozen(core.None), true);
    assert.equal(Reflect.set(core.None, "kind", "some"), false);
    assert.equal(core.None.kind, "none");
  });

  test(`${format}: fromNullable elimina únicamente null y undefined`, () => {
    for (const value of [false, 0, -0, "", NaN, {}, []]) {
      const result = core.fromNullable(value);
      assert.equal(result.kind, "some");
      assert.ok(Object.is(result.value, value));
    }
  });

  test(`${format}: Ok y Err conservan su payload sin lanzar ni clonarlo`, () => {
    const value = { name: "Ada" };
    const error = new Error("unavailable");
    const success = core.Ok(value);
    const failure = core.Err(error);

    assert.equal(success.kind, "ok");
    assert.equal(success.value, value);
    assert.equal(failure.kind, "err");
    assert.equal(failure.error, error);
    assert.deepEqual(core.Err(undefined), { kind: "err", error: undefined });
    assert.deepEqual(core.Err("failure"), { kind: "err", error: "failure" });
  });

  test(`${format}: los discriminantes permiten componer búsqueda y resultado`, () => {
    const users = new Map([["ada", { id: "ada", name: "Ada" }]]);

    function find(id) {
      const candidate = core.fromNullable(users.get(id));
      return candidate.kind === "some"
        ? core.Ok(candidate.value)
        : core.Err({ kind: "UserNotFound", id });
    }

    assert.deepEqual(find("ada"), {
      kind: "ok",
      value: { id: "ada", name: "Ada" },
    });
    assert.deepEqual(find("missing"), {
      kind: "err",
      error: { kind: "UserNotFound", id: "missing" },
    });
  });
}
