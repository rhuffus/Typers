# Primer prototipo: construir y probar

Esta guía corresponde al prototipo experimental de CLI, runtime, if-let y API nativa. Se construye desde el código del fork; no necesita una publicación npm de Typers. La API clásica de Nest CLI sigue fuera de la cobertura disponible.

## Requisitos y ubicación

Ejecutar los comandos desde la raíz del repositorio. La prueba local se desarrolla con Node 24, npm 11 y Go 1.27. El empaquetador admite construir un artefacto para su host macOS/Linux/Windows en arm64/x64; eso no significa que todas las combinaciones hayan pasado una matriz de CI.

```sh
npm --prefix tsc ci --ignore-scripts --no-audit --no-fund
npm --prefix tooling ci --ignore-scripts --no-audit --no-fund
node tooling/compatibility.mjs
```

La prueba construye el compilador y su cliente de API nativa, ejecuta las pruebas del runtime, crea tarballs y prepara un consumidor aislado con dependencias externas fijadas. Comprueba las once subrutas de API, compila la aplicación mediante CLI y API y ejecuta HTTP 200/404. Registra por separado el fallo conocido de la API clásica.

El consumidor generado se encuentra en `built/typers/consumer`. Se comprueba el contenido instalado para evitar que un tarball o una caché antigua produzcan un falso positivo. El informe queda en `built/typers/compatibility.json`; los artefactos generados no se guardan en Git.

## Ejecutar la aplicación de ejemplo

Después de la verificación:

```sh
node built/typers/consumer/dist/main.js
```

La aplicación escucha por defecto en `127.0.0.1:3000`. `GET /users/1` devuelve Ada y `GET /users/missing` devuelve 404 con un error de dominio. `PORT` permite elegir otro puerto. El script de pruebas usa un puerto libre y cierra las aplicaciones al terminar.

Las fuentes mantenidas están en `examples/nestjs/`. La variante estándar demuestra runtime y compatibilidad de emisión; `src/experimental.ts` demuestra if-let dentro de un servicio con inyección de dependencias. Ambas se prueban automáticamente.

Para construir mediante la API desde el consumidor ya preparado:

```sh
cd built/typers/consumer
npm run build:api
npm run build:api:typers
```

Estos scripts invocan `project.typersEmitProject()` y guardan los resultados dentro de `outDir`. La operación de API captura los archivos en memoria; el script realiza las escrituras. No son `nest build` ni ejecutan sus plugins, assets o reescritura de aliases. Ver [API nativa](native-api.md).

## Usar las APIs

```ts
import { Some, None, Ok, Err, fromNullable } from "@typers/core";
import type { Option, Result } from "@typers/core";

const present: Option<number> = Some(0);
const absent: Option<number> = None;
const result: Result<number, string> = Ok(42);
const failure: Result<number, string> = Err("invalid input");
const optional = fromNullable<number | undefined>(undefined);
```

Las importaciones anteriores funcionan en el consumidor preparado. No son una instrucción para descargar un paquete público aún inexistente. `@typers/core` es una dependencia de ejecución pequeña; `@typers/compiler` es el compilador de desarrollo.

## Activar if-let

```json
{
  "compilerOptions": {
    "experimentalTypersSyntax": true
  }
}
```

```text
// Sintaxis experimental de Typers, no TypeScript estándar.
if let Some(value) = present {
  console.log(value);
} else {
  console.log("absent");
}
```

`Some` en el patrón es sintaxis contextual. No se llama a un constructor para probar el valor; el compilador verifica el protocolo estructural y extrae el payload. El binding equivale a `const` dentro del bloque. El lado derecho se evalúa una vez. `None` y los valores falsy están diferenciados.

Solo se admite `Some(identifier)`. Las ramas requieren bloques. No hay match general, `?`, while-let ni let-else. El detalle del contrato y la representación interna está en [ADR 0004](decisions/0004-experimental-runtime-and-if-let.md).

## Construir solo un componente

```sh
node tooling/build-compiler.mjs
node packages/compiler/bin/typers.cjs --version
npm --prefix packages/core test
```

No usar `npm --prefix packages/core pack`: en la versión de npm observada no selecciona el paquete esperado. Usar `npm pack ./packages/core` o ejecutar `npm pack` desde esa carpeta. El harness utiliza rutas explícitas y comprueba el nombre del paquete.

El paquete CLI es local y contiene un binario para el host. Rechaza una plataforma distinta en ejecución. Incluye bibliotecas estándar embebidas; no utiliza un compilador legacy como fallback.

## Ejecutar la suite nativa

```sh
node tooling/prepare-test-corpus.mjs
npm --prefix tsc ci --ignore-scripts --no-audit --no-fund
cd tsc
go test ./...
```

El corpus se fija al gitlink upstream. La dependencia de desarrollo TypeScript JS dentro de `tsc/node_modules` se usa para comparaciones de ciertas pruebas upstream; no se instala en el consumidor Typers como segundo compilador.

## Limitaciones actuales

- `nest build` con el builder tsc de Nest CLI 12.0.1 requiere la API clásica y la sonda registra esa incompatibilidad.
- Las rutas `unstable/*` son experimentales. La emisión programática rechaza incremental, composite y referencias entre proyectos; esas operaciones siguen disponibles mediante el CLI según el soporte de la base.
- Oxlint/Oxfmt, loaders y editores no adquieren soporte de if-let por instalar el paquete. Falta su adaptación y validación.
- El AST normalizado no es una representación pública sin pérdida de la sintaxis original. Los mapas de fuentes tienen cobertura inicial, no una certificación completa del editor.
- La comparación con upstream cubre fixtures concretos y la suite ejecutada; no es una garantía universal de todas las bibliotecas.

Consultar [estado](status.md) para resultados efectivos y [compatibilidad](compatibility.md) para el contrato completo.
