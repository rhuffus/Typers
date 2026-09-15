/** A value that is explicitly present, including undefined when T allows it. */
export type Some<T> = {
  readonly kind: "some";
  readonly value: T;
};

/** Explicit absence, independent of the truthiness of any value. */
export type None = {
  readonly kind: "none";
};

export type Option<T> = Some<T> | None;

/** A successful result. */
export type Ok<T> = {
  readonly kind: "ok";
  readonly value: T;
};

/** A failed result that carries a value, without throwing it. */
export type Err<E> = {
  readonly kind: "err";
  readonly error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

export function Some<T>(value: T): Some<T> {
  return { kind: "some", value };
}

/** Shared absence value within this module instance. */
export const None: None = Object.freeze({ kind: "none" });

export function Ok<T>(value: T): Ok<T> {
  return { kind: "ok", value };
}

export function Err<E>(error: E): Err<E> {
  return { kind: "err", error };
}

/** Convert only null and undefined to absence; preserve every other value. */
export function fromNullable<T>(value: T): Option<NonNullable<T>> {
  return value === null || value === undefined ? None : Some(value);
}
