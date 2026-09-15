# Ejemplo NestJS para Typers

Fuentes de aceptación del prototipo. Consultar [la guía de ejecución](../../docs/typers/getting-started.md).

Desde la raíz:

```sh
npm --prefix tsc ci --ignore-scripts --no-audit --no-fund
npm --prefix tooling ci --ignore-scripts --no-audit --no-fund
node tooling/compatibility.mjs
node built/typers/consumer/dist/main.js
```

El harness prepara una copia aislada de estas fuentes, instala los tarballs del compilador y runtime, y conserva versiones externas mediante este lockfile. Las integridades de los dos paquetes locales se recalculan expresamente para la copia generada; el lockfile original no se regenera en cada prueba.

La dependencia llamada `typescript` de la copia instalada es realmente `@typers/compiler`. El script verifica sus bytes y el resultado de la compilación. El compilador oficial TypeScript usado para comparar está en `tooling/`, fuera del consumidor.

`src/app.ts` usa TypeScript estándar con Result/Option. `src/experimental.ts` usa if-let y se incluye únicamente al habilitar `experimentalTypersSyntax`. La prueba levanta ambos módulos y comprueba DI, metadata y respuestas HTTP. `nest build` se ejecuta por separado como sonda de la incompatibilidad conocida de la API clásica.

## Build con la API nativa

Desde `built/typers/consumer`, después de preparar el consumidor:

```sh
npm run build:api
npm run build:api:typers
```

`build-api.mjs` abre una vista del proyecto usando `typescript/unstable/async`, llama a `project.typersEmitProject()`, comprueba diagnósticos y guarda los archivos devueltos en `outDir`. La API utiliza el binario del paquete instalado y no escribe por sí misma. El harness compara todos los archivos con el CLI y ejecuta también estas dos compilaciones mediante HTTP.

Es un consumidor de ejemplo de la API. No implementa assets, watch, plugins o aliases de Nest CLI. La emisión programática rechaza incremental, composite y referencias entre proyectos por ahora. El [contrato de API nativa](../../docs/typers/native-api.md) detalla el alcance.
