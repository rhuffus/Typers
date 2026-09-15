# Hoja de ruta de implementación

## Cómo leer el orden

El orden prioriza aprendizaje y reducción de riesgo. La complejidad incluye parser, tipos, emisor, diagnóstico, runtime, editor y herramientas externas. No equivale a días de trabajo. Una API pequeña puede implementarse pronto; una sustitución universal de APIs históricas puede ser mucho más costosa que una construcción sintáctica.

Estado inicial de todos los hitos de código: **pendiente**. La documentación es la entrega previa. Los avances efectivos se registran en [estado](status.md).

Avance posterior: H0 CLI, H1 y H2 tienen un prototipo verificado. H5 incorpora clientes nativos distribuidos y emisión programática, según [ADR 0005](decisions/0005-native-api-and-project-emission.md), y el adaptador `typers-nest build`, según [ADR 0006](decisions/0006-nest-build-adapter.md). La API clásica/Nest CLI y Oxc/editor siguen abiertos; no se considera H5 terminado por disponer de estas integraciones.

## H0 — Base reproducible y paquete de compilador

**Complejidad:** media para CLI; alta o muy alta para compatibilidad de API histórica.

Entregables:

- Construir el compilador nativo desde `tsc/` y registrar procedencia y versión.
- Empaquetar un ejecutable local con sus bibliotecas estándar; exponer un comando Typers y el comando `tsc` para probar sustitución.
- Crear un consumidor fijado a versiones concretas, instalado desde tarball local, sin depender de un paquete npm Typers publicado.
- Comparar código TypeScript válido e inválido contra `typescript@7.0.2` como referencia de desarrollo.
- Comprobar qué carga realmente cada consumidor: no confundir un compilador instalado transitivamente con el fork.
- Probar el arranque de una aplicación NestJS compilada por el CLI nativo.
- Ejecutar la sonda de API que necesita Nest CLI y registrar incompatibilidad si existe.

Criterio de salida: build y paquete reproducibles, comparación básica sin regresiones, aplicación ejecutable y matriz honesta de compatibilidad. Una sonda que documente la ausencia de la API clásica no satisface el objetivo de sustitución de esa API: deja un subhito abierto y visible.

La compilación CLI y el runtime pueden avanzar aunque la API histórica continúe abierta, siempre que no se presente ese avance como sustitución completa de Nest CLI. Resolver una fachada de API o migrar una herramienta debe tener una decisión y pruebas propias.

## H1 — Runtime Result y Option

**Complejidad:** baja a media.

Entregables: uniones discriminadas `Result<T,E>` y `Option<T>`, constructores `Ok`, `Err`, `Some`, `None`, declaraciones públicas y pruebas de consumo ESM/CJS según los formatos soportados. `fromNullable` es una ampliación pequeña si se define que únicamente `null` y `undefined` producen ausencia.

Criterios:

- Inferencia y narrowing correctos; usos inválidos rechazados sin `any` introducido por la biblioteca.
- `Some(false)`, `Some(0)`, `Some("")` y `Some(undefined)` son presencia.
- Ausencia explícita, sin excepciones ocultas en constructores.
- JavaScript y `.d.ts` consumibles por TypeScript estándar.
- Uso desde un servicio NestJS con éxito, ausencia y error conocidos.
- Runtime independiente del compilador en instalaciones de producción.

No incluir todavía todos los métodos de Rust. Cada método nuevo amplía inferencia, documentación y mantenimiento. No introducir `unwrap()` que lanza sin documentarlo claramente.

## H2 — Primera extensión: if-let limitado

**Complejidad:** media a alta para el prototipo del compilador; alta al sumar todo el ecosistema y estabilizarlo.

Primera forma propuesta: `if let Some(nombre) = expresion { ... }`, con `else` opcional. El detalle de activación debe resolverse antes de exponerlo como estable. Soportar solo el Option oficial y una variable simple limita el problema sin fingir pattern matching general.

Criterios:

- Evaluación única del lado derecho; condición por discriminante, nunca por truthiness del valor.
- Binding correctamente tipado y disponible solo en la rama de éxito.
- Diagnósticos para patrones y operandos no soportados.
- Sin cambios de comportamiento para código TS estándar, incluyendo identificadores que se llamen `Some` o `match`.
- Salida JS ejecutable, `.d.ts` estándar y ubicaciones de errores razonables.
- Pruebas con efectos secundarios, funciones anidadas, `async`, ramas alternativas y recuperación del parser.
- Diferenciar explícitamente la compatibilidad de CLI de la de Oxc, SWC, editor y APIs que leen AST.

Una implementación experimental puede tener soporte limitado de herramientas. Ese límite debe estar documentado y probado como tal. No permitir que un formatter destruya silenciosamente el código.

## H3 — Construcciones de sentencia relacionadas

**Complejidad:** media a alta.

1. Ampliar `if let` a `Ok(nombre)` y, si se decide, variantes de error.
2. `while let`: definir reevaluación por iteración, ámbito por iteración y comportamiento de `break`, `continue` y cierres.
3. `let-else`: binding visible después de la sentencia y obligación de que la rama alternativa no continúe sin valor.

`while let` y `let-else` pueden intercambiarse según las necesidades reales. Comparten reconocimiento de variantes, pero exigen pruebas diferentes. Las primeras versiones pueden restringir patrones; no ampliar por accidente a destructuring arbitrario.

## H4 — match y propagación con ?

**Complejidad:** alta a muy alta. Son líneas de trabajo separadas; el orden definitivo depende de la evidencia de H2/H3.

`match` exige especificar si es expresión, inferencia de tipo común, evaluación única, exhaustividad, orden y alcance de patrones, guardas y ramas inalcanzables. Empezar por variantes conocidas antes de patrones anidados.

`?` exige distinguir el ternario y optional chaining existentes, devolver desde la función correcta, preservar evaluación y short-circuiting, resolver asignabilidad del error y distinguir `Result`, `Option`, `Promise<Result>` y resultados que contienen promesas. `try/finally` debe seguir ejecutando `finally` en salidas tempranas.

No implementarlo con reemplazos de texto ni con una IIFE que cambie el destino del `return`. No introducir conversiones implícitas de errores hasta tener un contrato explícito.

## H5 — Integración de herramientas y API

**Complejidad:** alta a muy alta; empieza como investigación en H0 y acompaña H2.

- Contrato de API para herramientas que necesitan AST, tipos, transformadores o emisión.
- Fachada compatible o adaptaciones por consumidor, con versiones y límites claros.
- Editor: diagnóstico, completado, navegación, renombrado, rangos y depuración.
- Oxlint/Oxfmt: parser y representación compatibles; reglas posteriores al parsing no añaden gramática.
- Plugins NestJS/Swagger/GraphQL, runners, loaders y builders evaluados individualmente.
- Prueba de bibliotecas externas consumiendo JavaScript y declaraciones emitidas.

No es necesario terminar toda esta superficie para experimentar; sí es necesario definirla antes de afirmar sustitución general o recomendar producción.

La primera entrega de esta línea permite consultas sync/async y emisión de un proyecto a memoria, con el mismo núcleo que el CLI. No admite todavía build incremental ni referencias entre proyectos en esa operación. La segunda incorpora un adaptador explícito para Nest: configuración, selección de un proyecto, limpieza de salida y assets. Conserva rechazos claros para plugins y aliases; no proporciona el comando original de Nest CLI. Ver [API nativa](native-api.md) y [adaptador Nest](../../packages/nest/README.md).

Siguiente orden recomendado dentro de H5:

1. Definir y probar una transformación nativa de aliases sobre JS, declaraciones y mapas. Concretar resolución NodeNext/ESM antes de habilitar `paths` en el adaptador.
2. Elegir un plugin Nest representativo y especificar la API de transformadores que necesita; medir el coste de una fachada clásica frente a una adaptación nativa.
3. Integrar el flujo real Oxlint/Oxfmt y editor antes de ampliar el uso de if-let a los proyectos zhenix-ai.

Estos pasos son investigación e implementación pendientes. No desbloquean por sí solos watch, proyectos referenciados o compatibilidad general con herramientas que importan la API clásica.

## H6 — Adaptadores de librerías

**Complejidad:** baja para wrappers manuales concretos; muy alta para generación general.

Orden: wrapper manual con contrato → helper explícito para capturar `unknown` → manifiesto de errores revisado → generación semiautomática → análisis estático asistido. Las firmas con throws no contienen una enumeración completa de errores; la ausencia de evidencia no significa ausencia de fallos.

Criterios: conservar `this`, overloads pertinentes, sincronía/asíncronía, cancelación y semántica de efectos; pruebas contra versiones fijadas; no modificar el paquete original ni atribuirle contratos que no garantiza. Ver [adaptadores](adapters.md).

## H7 — Estabilización y adopción

**Complejidad:** continua.

- Compatibilidad documentada por versión, CI y plataformas soportadas.
- Política de versiones y actualizaciones de upstream.
- Benchmarks de compilación y runtime frente a la base equivalente.
- Experimentos de desarrollo con agentes y métricas de coste/corrección.
- Guía de migración y vuelta a TS, casos reales zhenix-ai y decisión de publicación.
- Distribución firmada/verificada según la infraestructura elegida; no publicar automáticamente desde un prototipo.

## Dependencias y riesgos prioritarios

| Riesgo | Impacto | Mitigación / puerta |
| --- | --- | --- |
| API TS7 diferente de la clásica | Bloquea sustitución de Nest CLI y otras herramientas | Sonda H0 y decisión independiente; no ocultar un compilador antiguo |
| Parsers externos desconocen sintaxis | Lint, formato y loaders fallan | APIs TS normales primero; soporte por herramienta en H2/H5 |
| Nueva gramática cambia TS válido | Regresión del lenguaje | Activación definida, fixtures y suite upstream |
| Retornos y efectos mal transformados | Errores de negocio difíciles de detectar | Evaluación única y pruebas de flujo antes de `?` |
| Diagnósticos pierden ubicaciones | Menor productividad y confianza | Rangos, source maps y editor como criterios explícitos |
| Actualizaciones upstream frecuentes | Coste de mantenimiento | Diferencias pequeñas, commits temáticos, CI comparativa |
| Alias o dependencias usan otro compilador | Falso positivo en pruebas | Registrar resolución real y lockfile |
| Agentes generan sintaxis incorrecta | Más tokens y correcciones | Ejemplos pequeños, diagnósticos útiles y evaluación controlada |
| Inferir errores como exhaustivos | Contratos falsos | `unknown`, manifiestos y revisión humana |

## Qué no se hace para acelerar artificialmente

No se declara un hito completo porque compile un único ejemplo. No se omiten deliberadamente fallos de API del informe. No se cambia a un compilador legacy sin registrarlo. No se amplía el alcance de sintaxis a mitad de un PR sin actualizar pruebas y diseño. Las limitaciones pueden ser aceptables para un prototipo si están claramente identificadas.
