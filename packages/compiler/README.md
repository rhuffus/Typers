# Compilador Typers experimental

Paquete local del compilador nativo basado en TypeScript 7.0.2. No está publicado.

Desde la raíz del repositorio:

```sh
npm --prefix tsc ci --ignore-scripts --no-audit --no-fund
node tooling/build-compiler.mjs
node packages/compiler/bin/typers.cjs --version
npm pack ./packages/compiler --pack-destination ./built/typers
```

El paquete incluye un binario para la plataforma donde se construye y sus bibliotecas estándar embebidas. No se anuncia distribución multiplataforma: el launcher rechaza una plataforma diferente. Expone los comandos `typers` y `tsc`.

Para probar una sustitución por nombre, instalar el tarball bajo la dependencia `typescript`, como hace el ejemplo NestJS. La entrada principal exporta información de versión y procedencia; las API nativas se importan desde las rutas `unstable/*`.

`--version` identifica la revisión Typers; `upstreamVersion` declara la base. `build-info.json` registra commit, estado de los archivos del compilador, plataforma y versión de Go. No usar este paquete como prueba de compatibilidad completa de Nest CLI, ts-node o transformadores.

## API nativa instalada

Se distribuyen las once rutas del cliente nativo de la base upstream:

| Ruta tras instalar el paquete bajo `typescript` | Contenido |
| --- | --- |
| `typescript/unstable/sync` | Cliente síncrono `API`, snapshots, proyectos, checker y diagnósticos. |
| `typescript/unstable/async` | Cliente asíncrono equivalente. |
| `typescript/unstable/fs` | Interfaces y utilidades de sistema de archivos virtual. |
| `typescript/unstable/proto` | Tipos y utilidades del protocolo. |
| `typescript/unstable/ast` | Tipos, constantes y utilidades del AST nativo. |
| `typescript/unstable/ast/is` | Predicados de nodos. |
| `typescript/unstable/ast/factory` | Construcción de nodos. |
| `typescript/unstable/ast/utils` | Utilidades de AST. |
| `typescript/unstable/ast/scanner` | Scanner de la API upstream. |
| `typescript/unstable/ast/visitor` | Visitantes. |
| `typescript/unstable/ast/clone` | Clonado de nodos. |

Si se instala bajo su propio nombre, las mismas rutas empiezan por
`@typers/compiler/`. Los módulos de API son ESM y tienen declaraciones `.d.ts`.
La entrada de versión y los launchers conservan sus archivos `.cjs`.

```ts
import { API } from "typescript/unstable/sync";

const api = new API({ cwd: process.cwd() });
try {
  const snapshot = api.updateSnapshot({ openProject: "./tsconfig.json" });
  const project = snapshot.getProject("./tsconfig.json");
  if (!project) throw new Error("Project did not open");

  const diagnostics = project.program.getSemanticDiagnostics();
  const result = project.typersEmitProject();
  console.log(diagnostics, result.emitSkipped, result.outputs);
} finally {
  api.close();
}
```

El cliente inicia el binario `native/typers` del propio paquete mediante la
resolución predeterminada. No necesita un paquete de plataforma de Microsoft ni
un `tsserverPath` personalizado. El cliente y el binario deben proceder del mismo
build, porque comparten un protocolo que upstream marca como inestable.

`project.emitter.printNode(node)` utiliza el printer nativo sobre un AST. La
ampliación propia `project.typersEmitProject()` devuelve JavaScript, declaraciones
y mapas según las opciones del proyecto, como
`{ emitSkipped, diagnostics, outputs: [{ fileName, text }] }`. Los archivos se
capturan en memoria y sus rutas se ordenan; la API no los escribe en disco.
`noEmitOnError` puede impedir la emisión. Los proyectos incrementales, composite
o con referencias se rechazan en este primer alcance: la API no construye su
grafo ni administra archivos de build incremental. La variante asíncrona devuelve
una promesa para la operación de emisión.

## Cómo se construye el cliente

El script utiliza las fuentes generadas ya incluidas en
`tsc/_packages/native-preview` y su configuración upstream, y las compila con el
binario nativo Typers recién construido. Desactiva cachés incrementales para no
mezclar outputs anteriores y activa la condición de resolución de fuentes de
upstream. Copia el cliente, sus declaraciones, mapas JavaScript con fuentes
incluidas y el JSON-RPC vendorizado con su licencia.

Las dependencias fijadas de desarrollo en `tsc/` aportan los tipos de Node y las
herramientas de pruebas upstream. Aunque esa infraestructura heredada contiene
herramientas del compilador anterior, este script no invoca su compilador ni sus
generadores basados en la API clásica. El paquete distribuido no depende de otro
compilador ni de bibliotecas npm de ejecución externas.

## Pruebas y límites

Después de preparar un consumidor mediante `node tooling/compatibility.mjs`:

```sh
node tooling/test-native-api.mjs ./built/typers/consumer
```

El test carga todas las rutas desde el paquete instalado. Comprueba sync y async,
resolución del ejecutable por defecto, configuración, diagnósticos, AST, símbolos,
tipos, printer, emisión capturada y consumo de las declaraciones. El harness
general añade la construcción de la aplicación NestJS mediante la API.

Estas rutas no implementan la API histórica `createProgram` ni
`getParsedCommandLineOfConfigFile`. Nest CLI y los plugins que dependen de esa
superficie siguen necesitando una integración específica. El AST expuesto sigue
el modelo nativo y la normalización del prototipo Typers; no se promete identidad
ni comportamiento de todos los consumidores del AST histórico. El scanner
distribuido no convierte a Oxlint, Oxfmt ni otros parsers independientes en
herramientas compatibles con la sintaxis nueva.
