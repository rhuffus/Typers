# Adaptador de build NestJS para Typers

Paquete experimental local `@typers/nest`. Proporciona `typers-nest build`, un
comando que lee configuración de Nest y compila mediante la API nativa de Typers.
Requiere Node 24. No está publicado en npm.

## Probar desde el repositorio

```sh
npm --prefix tsc ci --ignore-scripts --no-audit --no-fund
npm --prefix tooling ci --ignore-scripts --no-audit --no-fund
node tooling/compatibility.mjs
cd built/typers/consumer
npm run build:nest
npm run build:nest:typers
```

El consumidor generado instala tres tarballs locales: compilador, runtime y
adaptador. Su dependencia llamada `typescript` contiene `@typers/compiler`.
El adaptador resuelve esa dependencia desde el proyecto y comprueba su identidad.
No instala un compilador mediante un peerDependency ni depende de `@nestjs/cli`.
Su dependencia de ejecución auxiliar es `minimatch`, fijada en 10.2.6.

## Comandos y API

```sh
typers-nest build
typers-nest build api --config nest-cli.json
typers-nest build api --path tsconfig.typers.json
typers-nest build --json
typers-nest build --compiler @typers/compiler
```

El último comando sirve cuando el compilador se instala bajo su propio nombre.
Por defecto se resuelve `typescript`. `--json` devuelve el informe estructurado,
incluidos diagnósticos, archivos escritos e identidad del compilador utilizado.
Errores de configuración o filesystem se presentan por stderr y terminan con
código 1. Una compilación con errores también termina con código 1. `noEmit`
correcto termina con código 0, indicando `emitSkipped`, y conserva los archivos.

```js
import { buildNest } from "@typers/nest";

const result = await buildNest({ cwd: process.cwd(), project: "api" });
console.log(result.success, result.emittedFiles, result.assetFiles);
```

## Configuración soportada

- Busca `nest-cli.json` o `.nest-cli.json`; sin ninguno utiliza valores por defecto.
  Un `--config` explícito debe existir y contener JSON válido.
- Un nombre selecciona `projects[name]`; sin nombre se usa la configuración raíz.
- Cada propiedad del proyecto sustituye su valor raíz. Los arrays no se concatenan.
- Tsconfig: `--path`, luego `compilerOptions.tsConfigPath`, luego
  `builder.options.configPath`, luego `tsconfig.build.json` si existe o `tsconfig.json`.
- Las rutas de configuración Nest se resuelven desde el directorio de ejecución,
  incluso al seleccionar un archivo de configuración en otra carpeta.
- Se aceptan builder ausente, `tsc` y `typers` para este comando. La ejecución usa
  siempre el compilador Typers seleccionado.
- `outDir` debe ser explícito en tsconfig. Con assets también se exige `rootDir`.
- `deleteOutDir` vale false por defecto. Cuando está activo, limpia el `outDir`
  del compilador después de validar la compilación y todos los destinos.

Ejemplo:

```json
{
  "sourceRoot": "src",
  "compilerOptions": {
    "builder": "tsc",
    "tsConfigPath": "tsconfig.typers.json",
    "deleteOutDir": true,
    "assets": ["**/*.graphql", { "include": "templates", "exclude": "templates/private/**" }]
  }
}
```

Los assets admiten strings y objetos `{ include, exclude, outDir }`, incluyendo
patrones, directorios, archivos ocultos y bytes binarios. Sus patrones son
relativos a `sourceRoot`; su estructura de destino es relativa a `rootDir` de
TypeScript. Un `outDir` específico del asset se resuelve desde el workspace.
Ese directorio alternativo no se limpia recursivamente con `deleteOutDir`.

La planificación rechaza escapes del workspace, `.git`, `node_modules`, symlinks
en las rutas gestionadas, solapamientos con fuentes, configuración Nest seleccionada,
tsconfig y su cadena de `extends`, y
colisiones de destinos. Carga los assets antes de modificar outputs. Un error de
tipos o `noEmit` conserva el build anterior. No garantiza rollback ante fallos de IO
ni protege frente a cambios concurrentes del filesystem durante las escrituras.

## Límites

Se rechazan plugins, otros builders, aliases `paths` no vacíos, incremental,
composite, referencias entre proyectos, watch, `--all`, `includeLibraryAssets`,
salidas o assets fuera del workspace y opciones de assets no soportadas. La
ejecución concurrente no está soportada. Las
opciones de otros comandos, como `collection`, `entryFile` y `generateOptions`,
no participan en este build. No ofrece `start` ni generación de código.

Este paquete no sustituye al comando `nest` ni implementa la API clásica de
TypeScript. Nest CLI 12.0.1 sigue requiriendo una integración específica para usar
su comando original. Swagger/GraphQL como plugins de compilación permanecen
pendientes, aunque copiar un archivo `.graphql` como asset sí está cubierto.
