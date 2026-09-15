# Registro de implementación y evidencia

## 2026-09-15 — Fundación

### Completado y verificado

- Fork público `rhuffus/Typers`, derivado de `microsoft/TypeScript`.
- Rama predeterminada `typers-main`, inicialmente en `v7.0.2`, commit `1e4744d68260a7cb91b62b12edc3f6a2187faaf1`.
- Clon parcial `tree:0`, no superficial, con `origin` y `upstream`.
- Compilador nativo `tsc/` con versión interna `7.0.2`; raíz heredada con versión de paquete `6.0.0`.
- Documentación inicial de visión, decisiones, riesgos, diseño, compatibilidad y hoja de ruta.

### Hallazgos de código, aún sin ejecución del fork

La entrada principal del paquete nativo exporta versión; la API nueva está en rutas `unstable/*`. Nest CLI inspeccionado requiere funciones clásicas. El primer hito debe reproducir y medir ese obstáculo. Ver [compatibilidad](compatibility.md).

### Pendiente al cerrar la documentación inicial

- Build y paquete local.
- Aplicación NestJS y comparación con upstream.
- Runtime Result/Option y sintaxis if-let.
- Adaptadores, plugins, editor, distribución y compatibilidad ampliada.

Cada entrega añadirá comandos, resultados, versiones y límites. Un hito parcialmente verificado permanece parcial.

## 2026-09-15 — Primer incremento experimental

La documentación fundacional se integró primero mediante [PR #1](https://github.com/rhuffus/Typers/pull/1), merge `73696bfaadbffaf5ef4004c864f468b59e3d991d`. La implementación posterior sigue ADR 0003 y concreta el contrato en [ADR 0004](decisions/0004-experimental-runtime-and-if-let.md).

### Implementado

- Paquete local `@typers/compiler@7.0.2-typers.0`, binario Go propio y bibliotecas estándar embebidas; comandos `typers` y `tsc`, versión base y procedencia explícitas.
- Runtime `@typers/core@0.1.0-alpha.0`: Result/Option, Ok/Err/Some/None, fromNullable, ESM/CJS y declaraciones, sin dependencias de ejecución.
- Opción `experimentalTypersSyntax` y `if let Some(identifier)` nativo, opt-in, protocolo estructural, binding const, else con bloque y evaluación única.
- Temporales sin colisiones, control de tipos y diagnósticos propios; normalización interna a AST existente sin TS intermedio.
- Ejemplo NestJS estándar y experimental, consumidor instalado desde tarballs, lockfile externo fijado y comprobación de hashes.
- Preparación reproducible del corpus nativo y workflow propio de CI dirigido a `typers-main`.

### Verificación local completada

Entorno: macOS arm64, Node 24.20.0, npm 11.19.0 y Go 1.27.1. Referencia: TypeScript 7.0.2; NestJS 12.0.3; Nest CLI 12.0.1.

| Comprobación | Resultado |
| --- | --- |
| `go test ./...` desde `tsc/`, con corpus y dependencias upstream | Correcto: 56 paquetes con tests, 43 sin tests, ningún paquete fallido |
| Tests específicos de Typers | Correctos: parser, checker/emisión, runtime del JS emitido, opciones y diagnósticos |
| Tests del runtime | 13/13 correctos |
| Instalación de tarballs | Consumidor nuevo mediante npm ci, hashes de 12 archivos coincidentes y lock externo conservado |
| Compilación TS estándar | Conjunto de archivos y bytes de JS, `.d.ts` y mapas idénticos a upstream para el ejemplo |
| Error de tipos | Diagnóstico TS2322 y código de salida 1 idénticos usando noEmit |
| Sintaxis experimental | Aceptada por Typers activado; rechazada por upstream |
| Consumo de declaraciones emitidas | TypeScript oficial compila un consumidor de `.d.ts` del módulo experimental |
| NestJS estándar y experimental | DI, metadata, HTTP 200 y HTTP 404 correctos |
| Formato y documentación | Go formateado; scripts JS comprobados; enlaces locales y whitespace revisados |

El comando integrado es `node tooling/compatibility.mjs`. Su informe generado está en `built/typers/compatibility.json`. No se publica ese archivo como una promesa permanente: se vuelve a generar desde un consumidor limpio en cada ejecución. La CI del PR ofrece evidencia adicional de la plataforma del runner.

Se revisaron y actualizaron únicamente dos baselines existentes de ayuda del CLI: la opción nueva y el ancho de presentación asociado. Durante el desarrollo se corrigieron errores secundarios con posiciones sintéticas en operandos inválidos y se instaló la dependencia JS que una prueba upstream de navegación requiere. El resultado final de la suite es correcto; esos fallos intermedios no se ocultaron como éxitos.

### Cobertura y límites

| Hito | Estado efectivo |
| --- | --- |
| H0: build, paquete y consumidor CLI | Prototipo verificado localmente |
| H0/H5: sustitución de API clásica y Nest CLI | **Incompatible conocido; pendiente** |
| H1: Result/Option | Implementación experimental verificada |
| H2: if-let | Implementación experimental verificada en el alcance de ADR 0004 |
| API nativa JS `unstable/*` en el paquete propio | Todavía no distribuida |
| Oxlint/Oxfmt, editores y demás parsers con if-let | Pendientes de adaptación y validación |
| while-let, let-else, match, ?, adaptadores | Propuestas posteriores, no implementadas |
| Publicación npm, releases y compatibilidad universal | No realizadas ni demostradas |

Nest CLI 12.0.1 carga correctamente nuestro paquete bajo `typescript`, pero lo rechaza por no exponer `getParsedCommandLineOfConfigFile` y demás API clásicas. El harness exige que esa sonda identifique el problema esperado; no la cuenta como un build de Nest CLI correcto.

La aplicación consumidora utiliza Typers como único paquete compilador instalado bajo `typescript`. Las referencias oficiales de pruebas están en `tooling/` y en las dependencias de desarrollo upstream, fuera del consumidor. Eso no cambia la limitación de API.

Siguiente trabajo: priorizar la estrategia de compatibilidad de API y el soporte del entorno Oxc/editor antes de recomendar la sintaxis experimental en todos los proyectos zhenix-ai. Las extensiones posteriores siguen el orden y las puertas de la [hoja de ruta](roadmap.md).

El primer incremento se integró mediante [PR #2](https://github.com/rhuffus/Typers/pull/2), merge `bd9f5a85cd27629d2e00643ae2dc007045b7da90`. Su [CI en Linux](https://github.com/rhuffus/Typers/actions/runs/34961750907) terminó correctamente antes del merge.

## 2026-09-15 — API nativa distribuida y emisión programática

### Implementado

- Once subrutas `unstable/*` en el paquete local, con clientes ESM sync/async y declaraciones; conservada la entrada raíz de versión.
- Resolución del binario nativo dentro del propio paquete y build del cliente mediante Typers. Transporte vendorizado con su licencia, sin dependencias npm de ejecución adicionales.
- `project.typersEmitProject()` y RPC Go homónimo: diagnósticos y emisión real de la vista seleccionada, capturando JS, `.d.ts` y mapas en memoria.
- Respeto de noEmit/noEmitOnError/declaration-only; rechazo explícito de incremental, composite y referencias entre proyectos en esta operación.
- Ejemplo NestJS con `build:api` y `build:api:typers`; comparación de archivos y prueba HTTP sobre ambas compilaciones programáticas.
- Hashes ampliados a los árboles de código distribuidos del compilador, API y transporte; conservado el consumidor nuevo mediante npm ci y su lock externo.

El contrato y sus límites están en [API nativa](native-api.md) y [ADR 0005](decisions/0005-native-api-and-project-emission.md). No se ha añadido otra sintaxis en esta entrega.

### Verificación local completada

Entorno: macOS arm64, Node 24.20.0, npm 11.19.0 y Go 1.27.1. Base TypeScript 7.0.2, NestJS 12.0.3 y Nest CLI 12.0.1.

| Comprobación | Resultado |
| --- | --- |
| Suite nativa `go test ./...` | Correcta: 56 paquetes con tests y 43 sin tests, ningún fallo |
| RPC enfocado `go test ./internal/api -run TestTypersEmitProject -count=1` | Correcto |
| RPC con detección de carreras `go test -race ./internal/api -run TestTypersEmitProject -count=1` | Correcto |
| Runtime Result/Option | 13/13 tests correctos, conservados |
| Distribución instalada | Consumidor nuevo, 329 hashes comprobados, lock externo preservado |
| Once subrutas de API | Importación correcta desde el alias instalado `typescript` |
| Sync/async con binario predeterminado | Configuración, diagnósticos, AST, símbolos, tipos, printer y emisión correctos |
| Declaraciones de la API | Consumidor `.mts` comprobado por el compilador nativo instalado |
| Emisión en memoria | JS/declaraciones/mapas presentes; ninguna escritura de salida por la API |
| Errores y modos excluidos | noEmit/noEmitOnError, diagnóstico TS2322, errores de configuración/sintaxis/globales/declaraciones y rechazos explícitos cubiertos |
| Coherencia de vistas | Vistas antigua/nueva, vista liberada, cancelación y captura multifuente comprobadas |
| NestJS estándar y con if-let mediante API | Mismos archivos y bytes que el CLI, DI/metadata/HTTP 200 y 404 correctos |
| TS estándar contra upstream | Se mantiene la comparación de JS, declaraciones, mapas y diagnóstico TS2322 |

Comando integrado: `node tooling/compatibility.mjs`. El informe actual sigue en `built/typers/compatibility.json` y los logs locales en `built/typers/native-api-compatibility.log` y `tsc/built/typers-native-api-tests.log`. Son resultados generados, no archivos versionados ni una garantía para cualquier proyecto.

### Límites que siguen abiertos

`nest build` sin adaptación continúa fallando por la API clásica; su sonda negativa se conserva. La nueva emisión programática no proporciona transformadores clásicos, plugins Nest, aliases, assets o watch. El ejemplo es un consumidor de la API nativa, no una modificación encubierta de Nest CLI.

La inspección de Nest CLI 12.0.1 confirma que carga la configuración mediante la API clásica antes de seleccionar builder y no tiene un hook público de builder arbitrario. La siguiente integración debe cubrir ese flujo completo o definir una fachada con alcance suficiente.

Oxc/editor, otras sintaxis Rust, generación de adaptadores y publicación npm permanecen pendientes. H5 ha avanzado, pero no está cerrado. Los resultados de CI y el commit de merge de esta entrega se identifican en su PR.

La entrega de API se integró mediante [PR #3](https://github.com/rhuffus/Typers/pull/3), merge `697c74e768713f700b59ec0f208e26e03ddcb455`. Su [CI en Linux](https://github.com/rhuffus/Typers/actions/runs/34979399824) terminó correctamente antes del merge.

## 2026-09-15 — Adaptador explícito de build para NestJS

### Implementado

- Paquete local `@typers/nest@0.1.0-alpha.0`, comando `typers-nest build` y API ESM
  `buildNest(options)` con declaraciones públicas. Contrato en el
  [README del paquete](../../packages/nest/README.md) y [ADR 0006](decisions/0006-nest-build-adapter.md).
- Resolución del compilador instalado en el proyecto bajo `typescript` o
  `@typers/compiler`, con comprobación de identidad y uso de la API nativa.
- Lectura de configuración Nest, selección raíz o proyecto por nombre, herencia
  de propiedades, precedencias de tsconfig y sobrescrituras explícitas del CLI.
- Planificación de assets con patrones, directorios, exclusiones, archivos
  ocultos y bytes binarios; destinos relativos a rootDir, con outDir alternativo.
- Diagnósticos y emisión en memoria antes de limpiar o escribir; errores de
  compilación o validación previa y `noEmit` conservan las salidas existentes.
- Validación de destinos, symlinks y colisiones, incluyendo diferencias de
  mayúsculas/minúsculas en el filesystem local.
- `configFileNames` en la respuesta nativa: configuración seleccionada y cadena
  de `extends`. Protege configuraciones heredadas que puedan estar dentro de
  outDir, sin reimplementar el parser de tsconfig en JavaScript.
- Tercer tarball en el consumidor reproducible y nuevos scripts `build:nest` y
  `build:nest:typers`. Se conserva la comprobación de hashes y lock externo.

El adaptador no depende de Nest CLI ni incorpora un segundo compilador. Añade
`minimatch@10.2.6` y sus dos dependencias transitivas fijadas; el lock del ejemplo
mantiene las versiones de las dependencias externas que ya existían.

### Verificación local completada

Entorno: macOS arm64, Node 24.20.0, npm 11.19.0 y Go 1.27.1. Base TypeScript 7.0.2;
NestJS 12.0.3 y sonda de Nest CLI 12.0.1.

| Comprobación | Resultado |
| --- | --- |
| Suite nativa `go test ./...` | 56 paquetes con tests correctos y 43 sin tests; ningún fallo |
| RPC de emisión, enfocado y con `-race` | Correcto; incluye cadena de extends con arrays, duplicados y herencia transitiva, noEmit y errores |
| Runtime Result/Option | 13/13 tests correctos |
| Configuración, assets y rutas del adaptador | 12/12 tests correctos |
| Consumidor instalado | Tres tarballs, 336 hashes comprobados y lock externo preservado |
| Integración del adaptador | 7 grupos positivos y 17 rechazos que preservan salidas |
| Herencia de tsconfig dentro de outDir | Casos directo y transitivo rechazados sin modificar configuraciones ni build previo |
| NestJS estándar/if-let mediante adaptador | 9/12 archivos de emisión respectivamente, idénticos byte a byte al CLI; DI, metadata y HTTP 200/404 correctos |
| Tipos públicos del adaptador y API nativa | Consumidores comprobados con el compilador Typers instalado |
| API sync/async y comparación con upstream | Conservadas; verifican también la nueva metadata de configuración |
| JavaScript, documentación y whitespace | Sintaxis, enlaces locales mantenidos y diff comprobados |

Comandos: `node tooling/compatibility.mjs`, `go test ./...` desde `tsc/` y
`go test [-race] ./internal/api -run TestTypersEmitProject -count=1` por separado.
Informes generados: `built/typers/compatibility.json`,
`built/typers/nest-build-compatibility.log` y `tsc/built/typers-nest-native-tests.log`.
La CI del PR repite la suite nativa y el consumidor en Linux.

### Alcance y siguiente trabajo

Esta entrega cubre un build explícito de un proyecto por invocación. El comando
original `nest build` sigue siendo incompatible con la API clásica disponible;
su sonda negativa permanece visible. H5 continúa parcial.

Aliases, plugins y transformadores, incremental en la API, referencias entre
proyectos, watch y ejecución concurrente no están soportados por el adaptador.
La preparación previa no garantiza rollback ante fallos de IO. Oxc/editor,
otras sintaxis, adaptadores de librerías y publicación npm siguen pendientes.

Próximo paso recomendado: definir la reescritura nativa de aliases con pruebas de
JS, declaraciones, mapas y resolución NodeNext/ESM; después abordar un plugin
Nest representativo y el flujo Oxc/editor, según la [hoja de ruta](roadmap.md).
