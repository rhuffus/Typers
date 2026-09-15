# API nativa del compilador

Estado: **experimental**, incorporada al paquete local de Typers. Esta API permite que herramientas JavaScript consulten el compilador nativo y soliciten emisión. No implementa la API clásica importada históricamente desde la raíz de `typescript`.

## Distribución y resolución

`@typers/compiler` incluye el cliente JavaScript construido desde `tsc/_packages/native-preview`, sus declaraciones, el transporte JSON-RPC vendorizado y el binario Typers del host. El empaquetador compila ese cliente con el propio compilador nativo. No utiliza TypeScript 6 para construir el paquete ni como compilador alternativo en el consumidor.

Las dependencias de desarrollo de `tsc/` sí deben estar instaladas: contienen, entre otras cosas, los tipos de Node necesarios para comprobar el cliente. Los generadores upstream de desarrollo son otro proceso; el generador sync utiliza la API legacy para transformar el código async. Sus resultados están en Git y el build del paquete no ejecuta ese generador.

| Ruta pública | Uso |
| --- | --- |
| `unstable/sync` | Cliente síncrono, proyectos, checker y diagnósticos |
| `unstable/async` | Cliente asíncrono con el mismo modelo de proyectos |
| `unstable/fs` | Contratos y utilidades de filesystem virtual |
| `unstable/proto` | Tipos del protocolo nativo |
| `unstable/ast` | Nodos y enumeraciones del AST nativo |
| `unstable/ast/is` | Predicados sobre nodos |
| `unstable/ast/factory` | Construcción de nodos |
| `unstable/ast/utils` | Utilidades del AST |
| `unstable/ast/scanner` | Scanner de la API upstream |
| `unstable/ast/visitor` | Recorrido y transformación del AST de esta API |
| `unstable/ast/clone` | Clonado de nodos |

Si el tarball se instala bajo el nombre `typescript`, se importan como `typescript/unstable/async`, etc. Si se instala bajo su propio nombre, se usan `@typers/compiler/unstable/async`, etc. El consumidor de aceptación prueba el primer caso. No se ha publicado ninguno de estos artefactos en npm.

La entrada raíz conserva información de versión; no incorpora `createProgram`, `sys` ni `getParsedCommandLineOfConfigFile`. Un consumidor de la nueva API debe escoger una subruta explícita. Los módulos nuevos se distribuyen como ESM y la entrada raíz sigue siendo CJS. El soporte probado usa Node 24; no implica una matriz completa de versiones de Node.

Los clientes abren por defecto el binario de **su propio paquete instalado**. No buscan un paquete oficial `@typescript/*` ni usan el `tsc` del PATH. La resolución verifica plataforma y arquitectura con `build-info.json`. La opción upstream `tsserverPath` permanece disponible para quien elija explícitamente otro servidor; usarla deja fuera la comprobación del binario predeterminado.

## Modelo de proyectos y snapshots

Una instancia `API` gestiona un proceso nativo. `updateSnapshot` abre proyectos y obtiene una vista de sus fuentes. Las consultas y la emisión se realizan sobre esa vista concreta. Cambiar un archivo en disco no modifica una vista ya retenida: se debe notificar el cambio al obtener una vista nueva.

```js
import path from "node:path";
import { API } from "typescript/unstable/async";

const config = path.resolve("tsconfig.json");
const api = new API({ cwd: process.cwd() });
try {
  const snapshot = await api.updateSnapshot({ openProjects: [config] });
  try {
    const project = snapshot.getProject(config);
    if (!project) throw new Error(`Project not found: ${config}`);

    const diagnostics = await project.program.getSemanticDiagnostics();
    const result = await project.typersEmitProject();
    console.log(diagnostics, result.diagnostics, result.emitSkipped);
    for (const output of result.outputs) {
      console.log(output.fileName, output.text.length);
    }
  } finally {
    await snapshot.dispose();
  }
} finally {
  await api.close();
}
```

El ejemplo no escribe los resultados. Para un uso que sí los guarda, consultar [`examples/nestjs/build-api.mjs`](../../examples/nestjs/build-api.mjs). El cliente síncrono ofrece las mismas operaciones pertinentes sin devolver promesas. Cerrar la API y liberar las vistas evita retener procesos y memoria.

El paquete [`@typers/nest`](../../packages/nest/README.md) añade un consumidor más completo de esta operación: lee configuración de Nest, selecciona un proyecto y planifica assets y escrituras antes de modificar las salidas. Mantiene esas responsabilidades fuera de la API del compilador. Su comando es `typers-nest build`; la API clásica del comando original de Nest continúa pendiente.

## `project.typersEmitProject()`

Es una ampliación propia de Typers. El nombre distingue esta operación del contrato upstream y se conserva en el método RPC `typersEmitProject`. La operación de upstream `project.emitter.printNode()` imprime AST; no equivale a compilar un proyecto y eliminar los tipos.

```ts
interface TypersEmitOutput {
  readonly fileName: string;
  readonly text: string;
}

interface TypersEmitResult {
  readonly emitSkipped: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly outputs: readonly TypersEmitOutput[];
  readonly configFileNames: readonly string[];
}
```

Contrato:

- Emite el proyecto entero de la vista seleccionada mediante `compiler.Program.Emit` del núcleo Go. No vuelve a cargar las fuentes mediante otro compilador.
- Recoge diagnósticos de configuración, sintaxis, binding, tipos, proyecto/globales y declaraciones. Los ordena y elimina duplicados mediante las utilidades del compilador.
- Devuelve JavaScript, declaraciones y mapas según la configuración. La metadata de decoradores y el lowering de if-let atraviesan los mismos transformadores nativos que el CLI.
- Captura todos los archivos en memoria, con resultados ordenados por nombre. No escribe, borra ni crea directorios del proyecto.
- `configFileNames` contiene las rutas absolutas normalizadas de la configuración seleccionada y su cadena de `extends`, ordenadas y sin duplicados. También está presente cuando no se emite o hay diagnósticos de error; en un proyecto inferido sin tsconfig es `[]`. El adaptador Nest utiliza esta información para proteger sus entradas antes de limpiar o escribir salidas.
- `noEmit` devuelve `emitSkipped: true` y `outputs: []`, conservando los diagnósticos.
- `noEmitOnError` impide emitir cuando hay diagnósticos que bloquean la emisión. Si está desactivado, pueden coexistir archivos emitidos y errores: el consumidor debe examinar ambos campos.
- `emitDeclarationOnly` conserva el comportamiento de declaraciones del compilador.
- Una vista liberada, un proyecto inexistente o un modo no soportado produce un error de API. No se traduce a una respuesta de emisión correcta.
- La captura de archivos está sincronizada porque el emisor nativo puede procesar distintas fuentes en paralelo. La vista permanece retenida durante la petición.

`emitSkipped` y los diagnósticos no constituyen una transacción de publicación. El consumidor decide si acepta los resultados y cómo los guarda. El script del ejemplo no escribe si encuentra errores y comprueba todos los destinos antes de guardar dentro de su `outDir`.

### Alcance inicial

La operación rechaza expresamente `incremental`, `composite` y referencias entre proyectos. No genera `.tsbuildinfo` ni construye un grafo de proyectos. Usar el CLI Typers para esas operaciones mientras se diseña su soporte programático.

No admite transformadores JavaScript de la API clásica, callbacks `writeFile` remotos, configuración alternativa por llamada ni emisión selectiva de un archivo. Tampoco ejecuta plugins Nest, reescribe aliases de imports, copia assets, limpia `outDir` o implementa watch. Estas capacidades requieren contratos y pruebas propios.

La captura en memoria puede aumentar el consumo de memoria en proyectos grandes; no se ha medido un límite ni se ha implementado streaming. Las superficies `unstable/*` siguen siendo experimentales, aunque estén empaquetadas y comprobadas.

La implementación retiene el bloqueo de lectura del registro de vistas durante la emisión. Esto protege su vida útil, pero hace esperar la publicación de nuevas vistas y su liberación. La suite con detección de carreras cubre la captura multifuente; no certifica todas las combinaciones de emisión, actualización y liberación simultáneas de una misma sesión. Una integración interactiva deberá medir y ampliar esa cobertura.

## AST y sintaxis Typers

El proyecto nativo reconoce if-let cuando `experimentalTypersSyntax` está activado. Su representación actual normaliza esa construcción a nodos existentes antes de binder/checker. Consultar tipos y emitir código no exige un parser TypeScript independiente.

Eso no convierte el AST expuesto en una representación sin pérdida de la sintaxis original. Los temporales sintéticos, rangos, comentarios y operaciones editoriales necesitan validación específica. Exportar el scanner y el visitor upstream no añade automáticamente un nodo `IfLet` ni proporciona un parser de texto Typers independiente. No usar `printNode` como formatter de un archivo Typers sin un contrato de preservación.

## NestJS: resultado y trabajo restante

El ejemplo se compila mediante esta API en versiones estándar y con if-let. Su integración compara todos los archivos JS, `.d.ts` y mapas contra el CLI y ejecuta DI, metadata y HTTP sobre los módulos emitidos.

Este comando usa la API desde el consumidor preparado:

```sh
cd built/typers/consumer
npm run build:api
npm run build:api:typers
```

No es el comando `nest build`. Nest CLI 12.0.1 necesita la API clásica antes de seleccionar el builder. Los builders contemplados por esa versión no ofrecen una entrada pública para un builder Typers arbitrario. Cambiar solo el nombre del builder no resuelve la carga inicial del compilador.

| Operación exigida por Nest CLI | Base nativa disponible | Trabajo aún necesario |
| --- | --- | --- |
| Configuración clásica y `sys` | `parseConfigFile`, proyectos y filesystem de la API | Adaptación de contrato, errores y opciones |
| `createProgram`/programa incremental | Proyectos y snapshots | Fachada o integración específica; incremental no cubierto por el nuevo emisor |
| Diagnósticos y formato clásico | Diagnósticos nativos | Compatibilidad de formas y presentación |
| `program.emit` | `typersEmitProject` devuelve archivos en memoria | Callbacks, opciones y semántica de integración |
| `before`/`after`/`afterDeclarations` | Impresión y utilidades AST | Transformadores compatibles o plugins adaptados |
| Reescritura de `paths`, Swagger, GraphQL | Sin cobertura equivalente verificada | Casos concretos, configuración y pruebas |

La adaptación explícita se ha concretado en [`@typers/nest`](../../packages/nest/README.md), según [ADR 0006](decisions/0006-nest-build-adapter.md). Cubre configuración, selección de proyecto, assets y escrituras mediante `typers-nest build`. La tabla anterior sigue describiendo el trabajo para consumidores de la API clásica. Los próximos pasos del adaptador son aliases y transformadores nativos con sus contratos y pruebas; la compatibilidad histórica permanece abierta.

## Validación reproducible

Desde la raíz:

```sh
npm --prefix tsc ci --ignore-scripts --no-audit --no-fund
npm --prefix tooling ci --ignore-scripts --no-audit --no-fund
node tooling/compatibility.mjs
```

El harness crea tarballs e instala un consumidor nuevo. Comprueba hashes del código distribuido, importación de las once subrutas, clientes sync/async sin override de ejecutable, AST/tipos/diagnósticos, emisión en memoria y consumo de las declaraciones instaladas. Comprueba también el script mantenido del ejemplo y conserva la sonda negativa de `nest build`.

Las pruebas Go del RPC cubren opciones de emisión, diagnósticos, configuraciones heredadas, ausencia de escrituras, vistas antiguas/nuevas, cancelación, captura multifuente y rechazo de modos no soportados. Su comando enfocado es `go test ./internal/api -run TestTypersEmitProject -count=1`, desde `tsc/`. Ver [estado](status.md) para los resultados de cada entrega y [ADR 0005](decisions/0005-native-api-and-project-emission.md) para la decisión.
