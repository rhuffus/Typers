import { Err, None, Ok, Some, fromNullable, type Option, type Result } from "@typers/core";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type Expect<T extends true> = T;

const absent: None = None;
const present: Some<string | undefined> = Some(undefined);
const success: Ok<{ id: string }> = Ok({ id: "ada" });
const failure: Err<{ kind: "NotFound" }> = Err({ kind: "NotFound" });
const option: Option<string | undefined> = present;
const result: Result<{ id: string }, { kind: "NotFound" }> = Math.random() > 0.5
  ? success
  : failure;

function optionLength(value: Option<string>): number {
  if (value.kind === "some") {
    return value.value.length;
  }
  const absence: None = value;
  return absence.kind.length;
}

function resultLabel(value: Result<number, { message: string }>): string {
  if (value.kind === "ok") {
    return value.value.toFixed();
  }
  return value.error.message;
}

declare const nullable: string | null | undefined;
const converted = fromNullable(nullable);
type NullableContract = Expect<Equal<typeof converted, Option<string>>>;

const undefinedPresent = Some(undefined);
type UndefinedContract = Expect<Equal<typeof undefinedPresent, Some<undefined>>>;

const neverPresent = fromNullable(null);
type NullContract = Expect<Equal<typeof neverPresent, Option<never>>>;

const readonlyResult: Readonly<Result<string, number>> = Ok("value");
void [absent, option, result, optionLength, resultLabel, readonlyResult];
