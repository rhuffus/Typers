# Ejemplo NestJS para Typers

Fuentes de aceptación del primer prototipo. Consultar [la guía de ejecución](../../docs/typers/getting-started.md).

Desde la raíz:

```sh
npm --prefix tooling ci --ignore-scripts --no-audit --no-fund
node tooling/compatibility.mjs
node built/typers/consumer/dist/main.js
```

El harness prepara una copia aislada de estas fuentes, instala los tarballs del compilador y runtime, y conserva versiones externas mediante este lockfile. Las integridades de los dos paquetes locales se recalculan expresamente para la copia generada; el lockfile original no se regenera en cada prueba.

La dependencia llamada `typescript` de la copia instalada es realmente `@typers/compiler`. El script verifica sus bytes y el resultado de la compilación. El compilador oficial TypeScript usado para comparar está en `tooling/`, fuera del consumidor.

`src/app.ts` usa TypeScript estándar con Result/Option. `src/experimental.ts` usa if-let y se incluye únicamente al habilitar `experimentalTypersSyntax`. La prueba levanta ambos módulos y comprueba DI, metadata y respuestas HTTP. `nest build` se ejecuta por separado como sonda de la incompatibilidad conocida de la API clásica.
