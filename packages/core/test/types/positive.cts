import { Err, None, Ok, Some, fromNullable, type Option, type Result } from "@typers/core";

const present: Some<number> = Some(0);
const absent: None = None;
const success: Ok<boolean> = Ok(false);
const failure: Err<string> = Err("missing");
const optional: Option<number> = Math.random() > 0.5 ? present : absent;
const result: Result<boolean, string> = Math.random() > 0.5 ? success : failure;
const converted: Option<number> = fromNullable(Math.random() > 0.5 ? 1 : null);

if (optional.kind === "some") {
  const value: number = optional.value;
  void value;
}

if (result.kind === "err") {
  const error: string = result.error;
  void error;
}

void converted;
