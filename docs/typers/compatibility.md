# Compatibilidad de Typers

[Índice de documentación](README.md) · [Arquitectura](architecture.md) · [Adaptadores](adapters.md)

## 1. Qué significa «100 % compatible»

**Aceptado como objetivo:** preservar TypeScript y añadir capacidades. **No demostrado:** compatibilidad universal con todas las versiones, paquetes y herramientas del ecosistema.

Una afirmación útil debe identificar: versión base, versión de Typers, plataforma, configuración, capa comprobada, herramientas concretas y evidencia. El resultado de una aplicación de muestra no demuestra todos los comportamientos del compilador.

Ejemplo de una afirmación admisible cuando existan las pruebas:

> «Esta revisión de Typers preserva los resultados del corpus X frente a TypeScript 7.0.2 con la configuración Y; la integración NestJS Z supera las pruebas enumeradas en el informe.»

Ejemplo que no debe publicarse sin un alcance verificable:

> «Cualquier biblioteca que requiera TypeScript funciona sin cambios con Typers.»

Esta precisión no rebaja el objetivo. Permite localizar y resolver incompatibilidades en vez de tratarlas como excepciones inesperadas a una promesa absoluta.

## 2. Capas independientes

| Capa | Pregunta de compatibilidad | Prueba representativa |
| --- | --- | --- |
| Sintaxis estándar | ¿Se aceptan y rechazan los mismos programas TypeScript de la base? | Corpus de parser y diagnóstico diferencial. |
| Semántica y tipos | ¿Coinciden resolución, inferencia, narrowing y errores? | Suites de comprobación de tipos con opciones fijadas. |
| Emisión JavaScript | ¿Se conserva el comportamiento observable y la emisión relevante? | Comparación de artefactos y ejecución de casos. |
| Declaraciones | ¿Puede TypeScript consumir las `.d.ts` generadas? | Proyecto consumidor compilado por upstream. |
| Paquete y CLI | ¿Los nombres, comandos, archivos y rutas resuelven correctamente? | Instalación del tarball en un directorio temporal. |
| API programática | ¿Existen las funciones y objetos que utiliza cada herramienta? | Consumidor real de la API con versión fijada. |
| AST y transformadores | ¿Funcionan visitantes, factories, nodos y checker juntos? | Plugin representativo que lee y transforma código. |
| Editor | ¿Funcionan diagnósticos, completado, navegación y renombrado? | Pruebas del servicio de lenguaje sobre código completo e incompleto. |
| Herramientas con parser propio | ¿Aceptan el lenguaje que reciben? | Formato, lint, cobertura y transformación de fuentes. |
| Framework y ejecución | ¿Se conservan decoradores, metadatos, DI y respuestas? | Aplicación NestJS con pruebas HTTP y arranque real. |
| Plataforma | ¿Funciona el binario distribuido en el entorno anunciado? | Matriz de sistemas y arquitecturas soportados. |

El éxito en una fila no implica el éxito en las demás. En particular, producir JavaScript válido no proporciona automáticamente la API de objetos que espera un plugin del compilador.

## 3. Compatibilidad con la base 7.0.2 y con APIs anteriores

### Hecho confirmado

El paquete fuente nativo del commit base exporta información de versión desde su entrada principal y sitúa APIs nuevas en rutas `unstable/*`. Esto es diferente del contrato programático histórico de TypeScript que muchas herramientas importan desde `typescript`. [Paquete nativo de la base](https://github.com/microsoft/TypeScript/blob/1e4744d68260a7cb91b62b12edc3f6a2187faaf1/tsc/_packages/native-preview/package.json), [entrada principal](https://github.com/microsoft/TypeScript/blob/1e4744d68260a7cb91b62b12edc3f6a2187faaf1/tsc/_packages/native-preview/lib/version.cjs).

En Nest CLI, la revisión `60dee9450c766a3b1088040be43266f2f1920cf0` resuelve `typescript` desde el entorno del proyecto y comprueba que exista `getParsedCommandLineOfConfigFile`. Su mensaje de error señala la ausencia de la API requerida en TypeScript 7.0. La comprobación es sobre capacidades; no consiste simplemente en comparar un número de versión. [Loader de Nest CLI](https://github.com/nestjs/nest-cli/blob/60dee9450c766a3b1088040be43266f2f1920cf0/lib/compiler/typescript-loader.ts), [diagnóstico de Nest CLI](https://github.com/nestjs/nest-cli/blob/60dee9450c766a3b1088040be43266f2f1920cf0/lib/ui/errors.ts).

### Consecuencia para el plan

Debemos distinguir dos líneas de validación:

1. **Equivalencia con TypeScript 7.0.2:** nuestro fork conserva el comportamiento y superficies que esa base realmente ofrece.
2. **Interoperabilidad con herramientas que esperan la API histórica:** Typers necesita una integración compatible, una capa de adaptación suficientemente completa o una versión futura de la herramienta que utilice una API soportada.

El segundo objetivo puede ser mucho más costoso que añadir `Result` y `Option`. No debe presentarse como una propiedad heredada automáticamente de la base.

El mensaje de una herramienta que anticipa una futura API no constituye una garantía de calendario ni de compatibilidad. Al actualizar la base se debe volver a inspeccionar la implementación real y fijar versiones.

### Opciones pendientes de evaluar

| Opción | Utilidad | Límite que debe hacerse explícito |
| --- | --- | --- |
| Ejecutar el compilador Typers directamente para construir una app NestJS. | Valida emisión, decoradores y ejecución del framework. | No demuestra `nest build`, plugins de transformadores ni consumo de la API histórica. |
| Crear una integración específica para una versión de Nest CLI. | Puede cubrir un conjunto acotado de capacidades. | Requiere mantener esa integración y medir sus diferencias. |
| Implementar una fachada de API histórica. | Acerca la sustitución de herramientas existentes. | Mismos nombres y firmas no bastan: objetos, identidad, sincronía y semántica también deben coincidir. |
| Aprovechar una base upstream posterior con API adecuada. | Puede reducir trabajo propio. | Necesita revalidación y no elimina por sí sola el soporte de la sintaxis Typers. |
| Usar el compilador histórico en paralelo como puente. | Puede servir para comparación o investigación. | Incumple el objetivo final de sustitución única si se convierte en requisito oculto del consumidor. |

No se elige aquí la fachada completa como compromiso de implementación inmediata. El primer hito debe producir un informe de capacidades que permita decidir con datos.

## 4. Sustitución como dependencia

### Nombre del paquete y nombre de resolución

Una dependencia llamada `typers` no hace que `require("typescript")` o `import ... from "typescript"` la encuentren. npm permite instalar un paquete usando un alias. La idea de distribución sería mantener `typescript` como nombre de resolución y hacer que apunte al paquete Typers. [Especificación de alias de npm](https://docs.npmjs.com/cli/v11/using-npm/package-spec/).

Ejemplo conceptual, no comando de instalación de un paquete ya publicado:

```json
{
  "devDependencies": {
    "typescript": "npm:<nombre-del-paquete-typers>@<version>"
  }
}
```

La sintaxis concreta debe sustituir los marcadores por un nombre y una versión reales. Durante el desarrollo se deben ensayar tarballs locales sin afirmar que un nombre está disponible en npm.

El alias resuelve una parte del problema. Todavía hay que probar:

- Campos `exports`, `main`, `types` y entradas CommonJS/ESM.
- Accesos a subrutas como archivos bajo `typescript/lib/`.
- Binarios `tsc` y las rutas de ejecutables que esperan las herramientas.
- Bibliotecas estándar `.d.ts` y archivos auxiliares incluidos en el paquete.
- Rangos de `peerDependencies`, versiones y validaciones propias de los consumidores.
- Árboles con varias copias instaladas, workspaces, enlaces y dependencias transitivas.
- Resolución desde el directorio de una herramienta, no solo desde la aplicación.
- Lockfile y gestor de paquetes utilizados en cada caso.

Los overrides o resolutions pueden ayudar a dirigir dependencias, pero no transforman contratos de API incompatibles ni garantizan que cada gestor trate aliases y peers de la misma forma. Las recetas de instalación deben proceder de pruebas del gestor y versión concretos.

### Una dependencia de compilación y un runtime pequeño

El objetivo del usuario es no necesitar instalar el TypeScript original como segundo compilador para construir la aplicación con Typers. El runtime de `Result`/`Option` es otra responsabilidad y puede instalarse como dependencia de ejecución sin contradecir ese objetivo.

Se permite utilizar upstream como herramienta de comparación en la infraestructura de pruebas de Typers. Esto debe distinguirse de introducirlo como dependencia oculta obligatoria del paquete distribuido.

La comprobación de sustitución debe inspeccionar el árbol instalado y la ruta efectiva de resolución. Un build que termina correctamente pero carga por accidente otra copia de TypeScript no valida Typers.

## 5. AST estándar y AST Typers

La propuesta original consiste en mantener un método estándar de recorrido y añadir otro que conozca nodos Typers. **Es posible diseñar vistas o APIs diferenciadas, pero no basta para asegurar compatibilidad de todos los consumidores.**

Un consumidor del compilador puede:

- Usar un visitante oficial o recorrer propiedades de nodos directamente.
- Hacer `switch` sobre clases de nodo y asumir un conjunto cerrado.
- Crear nodos con factories, clonarlos o conservarlos en cachés por identidad.
- Leer `parent`, `pos`, `end`, texto fuente y comentarios.
- Asociar símbolos y tipos a nodos a través del checker.
- Modificar nodos y pedir al printer que los emita.
- Volver a analizar el texto con otro parser.
- Serializar AST o transferirlo entre procesos.

Estas son superficies de compatibilidad propuestas para evaluación, no una afirmación de que todas formen un contrato estable en toda versión.

### Tres comportamientos posibles para un consumidor antiguo

| Estrategia | Qué recibe | Riesgo |
| --- | --- | --- |
| Exponer nodos nuevos. | AST fiel a Typers. | Puede ignorar, rechazar o procesar incorrectamente clases desconocidas. |
| Ocultar nodos nuevos. | Árbol incompleto o parcialmente recorrido. | Puede perder declaraciones, tipos, efectos y código necesario. |
| Exponer una vista normalizada. | Construcciones TypeScript equivalentes. | El texto y las posiciones originales pueden no coincidir; también cambian identidad, comentarios y estructura. |

La tercera es una dirección que merece un prototipo, pero debe especificar qué ve cada API. No basta con implementar `forEachChildTypers` si `getTypeAtLocation`, el printer y un plugin reciben nodos de vistas distintas.

**Propuesta de contrato inicial:** garantizar primero el comportamiento estándar sobre fuentes TypeScript estándar; marcar explícitamente qué APIs aceptan fuentes con extensiones. Una herramienta no adaptada debe recibir una limitación diagnosticable en vez de resultados silenciosamente incorrectos.

No se ha decidido numerar los nuevos tipos de nodo ni declarar estables sus valores numéricos. Cualquier modificación de enums, fábricas generadas o protocolos deberá revisar también los consumidores nativos y JavaScript del repositorio.

## 6. Herramientas que no utilizan nuestro parser

Oxc proporciona su propio conjunto de herramientas de análisis para JavaScript/TypeScript. Por ello, sustituir el paquete npm `typescript` no añade sintaxis al parser que utiliza Oxlint u Oxfmt. El build custom de Oxlint con un plugin NestJS del usuario forma parte de la integración que deberá validarse por separado. [Introducción oficial de Oxc](https://oxc.rs/docs/guide/introduction.html).

Para otras herramientas, el inventario debe registrar si analizan fuentes, llaman al compilador o consumen solamente JavaScript. SWC, Babel, herramientas de cobertura, runners y editores no deben clasificarse por su nombre: se inspeccionará el camino realmente configurado en el proyecto.

Antes de habilitar una sintaxis en el flujo zhenix-ai:

1. Determinar quién analiza cada archivo en build, lint, format, test y editor.
2. Probar con las versiones instaladas, incluyendo el build personalizado de Oxlint.
3. Definir cómo se formatea y representa la sintaxis nueva.
4. Comprobar que un formato repetido es estable y no elimina comentarios.
5. Evitar que reglas o plugins vuelvan a analizar el texto con un parser que no admite Typers.
6. Documentar las integraciones que aún no soportan fuentes extendidas.

Transformar una copia a TypeScript estándar antes de ejecutar una herramienta puede ser útil en una investigación, pero introduce correspondencia de ubicaciones y ediciones. No debe confundirse con soporte nativo de esa herramienta ni con la decisión aceptada de emisión directa de JavaScript.

## 7. NestJS: demostración mínima significativa

La primera aplicación de referencia debería contener un módulo, un controlador, un servicio y un repositorio en memoria, con un endpoint `GET /users/:id`.

El repositorio devuelve `Option<User>`, el servicio convierte ausencia en un `Result<User, UserNotFound>` y el controlador adapta los resultados al contrato HTTP. Una ausencia esperada debe producir la respuesta elegida por la aplicación. Las excepciones inesperadas siguen una ruta diferenciada.

No se sustituye silenciosamente el modelo de excepciones del framework. Lanzar una excepción HTTP de Nest en la frontera de transporte puede seguir siendo la integración apropiada aunque el dominio use resultados explícitos.

### Pruebas necesarias

| Área | Caso positivo | Caso negativo o de borde |
| --- | --- | --- |
| Arranque | Instancias resueltas por inyección. | Fallo claro si faltan metadatos o un proveedor. |
| HTTP | Usuario existente devuelve el resultado previsto. | Ausencia devuelve el estado HTTP elegido y no una respuesta accidental de éxito. |
| Runtime | `Some` y `Ok` conservan el valor. | `0`, `false` y cadena vacía no se convierten en ausencia. |
| Tipado | Inferencia del usuario y del error. | Acceso al payload de una variante sin narrowing produce error. |
| Emisión | Decoradores, imports y metadatos válidos. | `emitDecoratorMetadata` y `experimentalDecorators` según la configuración fijada. |
| Sintaxis propia | Bloque correcto e inferencia. | Evaluación única, ámbito y nombres temporales. |
| Herramientas | Build directo con Typers. | `nest build`, watch y plugins se prueban y reportan por separado. |
| Publicación | Un consumidor instala JS y `.d.ts` del runtime. | No requiere archivos fuente omitidos ni un compilador distinto oculto. |

Para una segunda etapa, añadir un plugin real de Nest que utilice transformadores, por ejemplo el de Swagger, con una versión y configuración fijadas. No incluirlo como requisito del primer ejemplo de runtime si la API necesaria sigue ausente.

## 8. Protocolo de pruebas diferenciales

Una prueba diferencial ejecuta el mismo programa con upstream y con Typers y compara lo que importa al consumidor.

### Entradas fijadas

- Commit upstream y commit Typers.
- Versiones de Go, Node, gestor de paquetes y sistema operativo.
- Archivos de configuración completos, incluidos targets y resolución de módulos.
- Dependencias exactas y lockfiles.
- Modo de compilación: único, incremental, watch o project references.

### Salidas a comparar

- Códigos de salida.
- Diagnósticos: categoría, código, texto, archivo y rango, con normalización limitada de rutas temporales.
- JavaScript y declaraciones, distinguiendo diferencias cosméticas de diferencias semánticas.
- Mapas de fuente y posiciones relevantes para depuración.
- Resolución de módulos y bibliotecas estándar utilizadas.
- Efectos y resultados de ejecución de los casos seleccionados.

Toda normalización debe estar justificada. Eliminar diagnósticos, reordenar efectos o ignorar grandes fragmentos de salida para conseguir igualdad ocultaría regresiones.

La versión upstream puede tener diferencias deliberadas frente a versiones anteriores; el punto de comparación es la base exacta. Typers no puede atribuirse compatibilidad con TypeScript 6 únicamente por reproducir TypeScript 7.

## 9. Matriz inicial y estados de reporte

Este documento define pruebas futuras. No registra resultados de ejecución que todavía no existen. El informe de cada implementación debe enlazar comandos, resultados y commits.

Estados permitidos:

- **Verificado:** caso ejecutado con éxito y evidencia identificada.
- **Incompatible conocido:** caso ejecutado o contrato inspeccionado que muestra una diferencia concreta.
- **Parcial:** funciona un subconjunto descrito.
- **Pendiente:** todavía no se ha comprobado.
- **Fuera de alcance:** excluido expresamente de esa versión, sin implicar que nunca se soporte.

| Objetivo de la primera etapa | Punto de partida documental |
| --- | --- |
| Binario Typers basado en 7.0.2 | Pendiente de construir y ensayar como artefacto propio. |
| CLI para TypeScript estándar | Pendiente de pruebas diferenciales. |
| Runtime consumible por TypeScript estándar | Pendiente de implementación y pruebas. |
| NestJS construido directamente con el compilador nativo | Pendiente de aplicación de referencia. |
| API histórica desde la entrada principal nativa sin cambios | Incompatible conocido con los consumidores que requieren funciones ausentes. |
| Sustitución mediante alias en un proyecto Nest completo | Pendiente; el alias por sí solo no elimina el bloqueo anterior. |
| `if let` | Pendiente de especificación final e implementación. |
| Oxlint/Oxfmt con `if let` | Pendiente de adaptación y pruebas. |

No convertir automáticamente las filas pendientes en compatibles después de que termine un comando general de build.

## 10. Criterio de salida de una versión

Para anunciar una versión utilizable:

1. Identificar el conjunto de plataformas y herramientas soportadas.
2. Ejecutar las pruebas pertinentes de upstream y las añadidas por Typers.
3. Instalar y probar los paquetes construidos fuera del workspace.
4. Ejecutar la aplicación de referencia y los consumidores de declaraciones.
5. Publicar limitaciones y diferencias conocidas junto a la evidencia.
6. Mantener una ruta de desactivación de extensiones o retorno al compilador base para proyectos que todavía usan solo TypeScript estándar.
7. Repetir la matriz al actualizar upstream o cambiar contratos de AST, runtime, emisión o distribución.

La compatibilidad es un resultado mantenido mediante pruebas y contratos. Añadir API sin borrar nombres existentes es una estrategia inicial, no una demostración suficiente.
