# Compilador Typers experimental

Paquete local del compilador nativo basado en TypeScript 7.0.2. No está publicado.

Desde la raíz del repositorio:

```sh
node tooling/build-compiler.mjs
node packages/compiler/bin/typers.cjs --version
npm pack ./packages/compiler --pack-destination ./built/typers
```

El paquete incluye un binario para la plataforma donde se construye y sus bibliotecas estándar embebidas. No se anuncia distribución multiplataforma: el launcher rechaza una plataforma diferente. Expone los comandos `typers` y `tsc`.

Para probar una sustitución por nombre, instalar el tarball bajo la dependencia `typescript`, como hace el ejemplo NestJS. Esto no proporciona la API clásica del compilador: la entrada principal exporta únicamente información de versión y procedencia. Las rutas API `unstable/*` de upstream todavía no forman parte de este paquete experimental de CLI.

`--version` identifica la revisión Typers; `upstreamVersion` declara la base. `build-info.json` registra commit, estado de los archivos del compilador, plataforma y versión de Go. No usar este paquete como prueba de compatibilidad completa de Nest CLI, ts-node o transformadores.
