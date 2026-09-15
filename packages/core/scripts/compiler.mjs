import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const packageRoot = fileURLToPath(new URL("../", import.meta.url));

export const compilerPath = process.env.TYPERS_BIN
  ? resolve(process.env.TYPERS_BIN)
  : fileURLToPath(new URL("../../../tsc/built/local/typers", import.meta.url));

export function compile(args) {
  const result = spawnSync(compilerPath, args, {
    cwd: packageRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(
      `No se pudo ejecutar el compilador nativo ${compilerPath}. ` +
        "Construye tsc/built/local/typers o configura TYPERS_BIN.",
      { cause: result.error },
    );
  }

  return result;
}

export function compileOrThrow(args) {
  const result = compile(args);

  if (result.status !== 0) {
    throw new Error(
      `El compilador terminó con código ${result.status}` +
        (result.signal ? ` y señal ${result.signal}` : "") +
        `:\n${result.stdout}${result.stderr}`,
    );
  }

  return result;
}
