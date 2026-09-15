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
