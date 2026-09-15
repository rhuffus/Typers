import { Err, None, Ok, Some, fromNullable, type Option, type Result } from "@typers/core";

const value = Some(1);
// @ts-expect-error Payload properties are readonly.
value.value = 2;
// @ts-expect-error Variant tags are readonly.
value.kind = "some";
// @ts-expect-error Absence has no payload.
None.value;
// @ts-expect-error A present undefined is not absence or a number.
const invalidOption: Option<number> = Some(undefined);
// @ts-expect-error A string cannot fill a numeric Option.
const wrongValue: Option<number> = Some("1");
// @ts-expect-error An error is not an Option variant.
const wrongVariant: Option<number> = Err("failure");
// @ts-expect-error The error type is part of the Result contract.
const wrongError: Result<number, string> = Err(404);

declare const result: Result<number, string>;
// @ts-expect-error Narrow the variant before accessing a success payload.
result.value;
if (result.kind === "err") {
  // @ts-expect-error The failure branch has no success payload.
  result.value;
  // @ts-expect-error Error payload properties are readonly.
  result.error = "changed";
}

const success = Ok(false);
// @ts-expect-error Ok has no error payload.
success.error;

declare const input: string | null | undefined;
const converted = fromNullable(input);
if (converted.kind === "some") {
  // @ts-expect-error Null and undefined were removed from the present payload.
  const nullValue: null | undefined = converted.value;
}

void [invalidOption, wrongValue, wrongVariant, wrongError];
