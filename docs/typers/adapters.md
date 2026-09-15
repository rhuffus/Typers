# Adaptadores para bibliotecas JavaScript y TypeScript

[Índice de documentación](README.md) · [Arquitectura](architecture.md) · [Compatibilidad](compatibility.md)

## 1. Intención y estado

**Aceptado como línea de exploración:** facilitar el uso de bibliotecas existentes mediante APIs adicionales que expresen resultados y ausencia con los tipos de Typers. La biblioteca original debe conservar su API y su comportamiento.

**Propuesto:** comenzar con envoltorios manuales pequeños, pasar a generación guiada por contratos y estudiar después qué partes puede inferir un analizador estático. No se ha decidido construir un traductor universal ni se ha demostrado que pueda deducir todos los errores de una biblioteca.

Un adaptador puede ser TypeScript estándar. No necesita esperar a `if let`, `match` o `?`, y no debe exigir que el autor original adopte Typers. Por ejemplo, un paquete complementario puede importar la biblioteca y publicar una función adicional. La ubicación exacta y los nombres de esos paquetes siguen abiertos.

El primer resultado valioso no sería «transformar cualquier dependencia», sino adaptar una operación concreta con contrato claro, pruebas y tipos fiables.

## 2. Qué información puede obtenerse

| Entrada | Información útil | Qué no demuestra |
| --- | --- | --- |
| `.d.ts` | Nombres, parámetros, sobrecargas, tipos devueltos y nullabilidad declarada. | Conjunto completo de excepciones, efectos o rechazos. |
| Fuente TypeScript | Flujos y llamadas visibles, retornos y `throw` explícitos. | Comportamiento de dependencias desconocidas o ejecución dinámica. |
| Fuente JavaScript y JSDoc | Forma del API e información parcial de tipos. | Que las anotaciones sean completas o correctas. |
| Documentación oficial | Contratos publicados y códigos de error conocidos. | Exhaustividad si el proveedor no la garantiza. |
| Pruebas y trazas | Casos realmente observados. | Que no existan otros casos. |
| Contrato manual de adaptación | Política de ausencia, clasificación y propagación elegida. | Que siga vigente al cambiar la dependencia, sin revalidación. |

El informe del generador debe distinguir **declarado**, **observado**, **inferido** y **especificado manualmente**. No debe mostrar inferencias como garantías del proveedor.

## 3. Por qué no puede prometerse una lista completa de errores

JavaScript permite lanzar valores que no son instancias de `Error`. La documentación de TypeScript recomienda tratar los valores capturados como `unknown` y comprobar su forma antes de usarlos. Esta será la base conservadora de los adaptadores. [TypeScript: `useUnknownInCatchVariables`](https://www.typescriptlang.org/tsconfig/useUnknownInCatchVariables.html), [ECMAScript: sentencia `throw`](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-throw-statement).

Además de un `throw` escrito junto a la función, pueden fallar:

- Una dependencia transitiva o un módulo nativo.
- Un getter, un setter o un `Proxy` que interviene al leer una propiedad.
- Un callback proporcionado por el consumidor.
- La resolución dinámica de un método o el acceso a un recurso.
- Una promesa al rechazarse, incluso después de que la función original haya devuelto.
- Un iterador durante una llamada posterior a `next()`.
- Una operación realizada en un callback o evento fuera del ámbito de captura original.
- Una inicialización de módulo anterior a la llamada envuelta.

Un análisis estático útil puede aproximar estos comportamientos y detectar muchos casos. Bajo ejecución JavaScript general, no puede convertir una biblioteca arbitraria en un contrato exhaustivo de errores de dominio únicamente a partir de su código visible.

**Aceptado como restricción de diseño:** cuando el contrato sea incompleto, conservar incertidumbre de forma explícita. No convertir el resultado en `Result<T, never>` por no haber encontrado una sentencia `throw`.

## 4. Tres políticas de errores posibles

Cada función adaptada debe elegir una política. El generador no debe mezclar políticas silenciosamente.

| Política | Tipo conceptual | Comportamiento |
| --- | --- | --- |
| Capturar cualquier valor observable por ese envoltorio. | `Result<T, unknown>` | Devuelve `Err(cause)` en el ámbito documentado; no inventa clasificación. |
| Clasificar errores conocidos y conservar el resto. | `Result<T, KnownError \| UnexpectedError>` | Los casos reconocidos se mapean; el resto mantiene una causa desconocida. |
| Convertir solo errores de dominio conocidos. | `Result<T, KnownError>` y posibilidad documentada de excepción. | Los errores desconocidos se propagan por el canal original. |

La tercera opción puede ser razonable para no ocultar defectos de programación, pero su tipo `Result` no equivale a una función que nunca lanza. La segunda conserva un canal explícito para fallos inesperados, con decisiones de observabilidad y privacidad en las fronteras de la aplicación.

Ejemplo conceptual de error abierto:

```ts
type ReadFailure =
  | { readonly kind: "NotFound"; readonly resource: string }
  | { readonly kind: "PermissionDenied"; readonly resource: string }
  | { readonly kind: "UnexpectedError"; readonly cause: unknown };
```

No se deben convertir todos los errores en `NotFound`, ni inferir permisos insuficientes de un texto localizado. El mapping debe priorizar códigos y contratos estables del proveedor, con validación del dato capturado.

Al conservar `cause`, un consumidor interno puede diagnosticar el fallo. La respuesta HTTP o el objeto serializado necesita una política propia para no publicar accidentalmente credenciales, rutas o información interna. Esta separación pertenece a la integración de aplicación, no a una conversión universal de errores en mensajes públicos.

## 5. Ausencia y resultado no son intercambiables

El retorno `T | undefined` no significa necesariamente «elemento no encontrado». Puede representar una operación sin valor, una opción de configuración no suministrada o un valor permitido por el dominio.

Cada adaptación a `Option` debe declarar:

- Qué valores significan ausencia: solo `undefined`, solo `null`, ambos u otro contrato explícito.
- Si valores nulos pueden ser contenidos válidos.
- Si la ausencia es normal o debe convertirse en un error de dominio.
- Qué ocurre con `false`, `0`, `NaN` y cadenas vacías.
- Si se preserva el tipo genérico y cómo se elimina, o no, la nullabilidad.

Conversiones conceptuales diferentes:

```text
find(id): User | undefined
    -> findOption(id): Option<User>

load(id): Promise<User> con errores documentados
    -> loadResult(id): Promise<Result<User, LoadError>>

query(id): Promise<User | null> con posibles fallos
    -> queryResult(id): Promise<Result<Option<User>, QueryError>>
```

Estos ejemplos ilustran políticas posibles; no afirman que todas las APIs con esas firmas compartan esa semántica. `Result<Option<T>, E>` distingue una consulta válida sin valor de una consulta fallida. Usarlo en todo lugar añadiría complejidad innecesaria cuando el dominio no necesita tres estados.

## 6. Ámbitos de captura síncronos y asíncronos

### Envoltorio síncrono

Un `try/catch` puede convertir lo que se lanza durante la ejecución síncrona dentro de ese bloque. Los argumentos evaluados antes de entrar en el envoltorio quedan fuera de su captura. Esta distinción debe aparecer en los ejemplos.

```text
attempt(() => source.read(path))
```

La función diferida permite situar la llamada dentro del bloque de captura. El nombre `attempt` es ilustrativo y no compromete una API pública todavía.

### Envoltorio asíncrono

Para cubrir tanto un lanzamiento inmediato como el rechazo posterior, la función original debe invocarse dentro del ámbito controlado y su resultado debe esperarse allí. Recibir una promesa ya creada no puede capturar un error anterior ocurrido al construirla.

Hay que especificar también thenables, cancelación y errores del propio clasificador. Si el mapper que convierte `unknown` a un error de dominio lanza, el adaptador no debe seguir describiéndose como libre de excepciones sin una política adicional.

### Eventos, callbacks, streams e iteradores

Una función puede devolver correctamente y fallar después mediante otro canal. Capturar su llamada inicial no cubre automáticamente ese canal.

| Canal original | Trabajo adicional |
| --- | --- |
| Callback de error | Preservar número y orden de invocaciones; decidir si se crea una API Promise. |
| `EventEmitter` | Gestionar suscripción, cancelación y vida útil; definir qué constituye una operación. |
| Stream | Preservar backpressure, cierre y errores de lectura/escritura. |
| Iterador síncrono | Definir resultados de `next`, `return` y `throw`. |
| Iterador asíncrono | Añadir cancelación y rechazo de cada paso. |
| API con transacciones | Preservar commit, rollback y el contexto requerido. |

Estos canales quedan fuera del generador inicial. No basta con modificar la firma de retorno para convertirlos en una función `Result` equivalente.

## 7. Preservar el contrato de la biblioteca

Las pruebas de un adaptador deben ir más allá del caso feliz. Una envoltura aparentemente pequeña puede alterar:

1. **`this`:** extraer un método y llamarlo como función libre puede romperlo.
2. **Sobrecargas y genéricos:** una firma excesivamente amplia pierde inferencia y precisión.
3. **Argumentos opcionales y rest:** `undefined` explícito puede diferir de no pasar un argumento.
4. **Identidad y cachés:** una nueva función u objeto puede cambiar comparaciones o registros.
5. **Laziness:** no iniciar una operación antes de que lo hacía el original.
6. **Orden de efectos:** no duplicar llamadas ni leer propiedades adicionales sin necesidad.
7. **Cancelación y timeouts:** conservar señales, razones de cancelación y liberación de recursos.
8. **Contexto asíncrono:** mantener el contexto que emplea la aplicación, por ejemplo para trazas y transacciones.
9. **Propiedades de clases y funciones:** métodos estáticos, símbolos, getters y metadatos no se copian automáticamente.
10. **Modelo de módulos:** no producir un envoltorio ESM que requiera incorrectamente un módulo solo ESM desde CommonJS, ni el caso inverso.

La existencia de herramientas de contexto asíncrono en Node es una razón para comprobar esa superficie en envoltorios que introduzcan nuevas fronteras asíncronas; su comportamiento concreto depende de la implementación del adaptador. [Node: `AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage).

El generador inicial debe rechazar explícitamente contratos que no pueda preservar. Un informe de «requiere adaptación manual» es preferible a producir una firma precisa sobre un comportamiento incorrecto.

## 8. Progresión recomendada

| Etapa | Alcance | Complejidad relativa | Entregable verificable |
| --- | --- | --- | --- |
| A0 | Un envoltorio manual de una función síncrona bien documentada. | Baja. | Código pequeño y pruebas de valor, error y efectos. |
| A1 | Funciones auxiliares generales de captura y conversión de ausencia. | Baja a media. | Semántica explícita de `unknown`, nullabilidad y callbacks. |
| A2 | Envoltorio manual asíncrono de una operación real. | Media. | Pruebas de throw inmediato, rechazo, cancelación y mapping. |
| A3 | Generación a partir de un manifiesto escrito por el mantenedor. | Media. | Generación determinista, tipos y pruebas reproducibles. |
| A4 | Descubrir exports y proponer contratos desde `.d.ts`. | Media a alta. | Informe revisable; las decisiones de error siguen explícitas. |
| A5 | Análisis estático de fuentes y dependencias seleccionadas. | Alta. | Inferencias con procedencia, incertidumbre y límites claros. |
| A6 | Clases complejas, streams, callbacks y ecosistemas amplios. | Muy alta. | Soporte específico por familia de APIs. |

La clasificación expresa superficie técnica y de mantenimiento, no un plazo garantizado. El generador completo no bloquea el runtime ni la primera sintaxis del compilador.

## 9. Manifiesto de adaptación propuesto

Un manifiesto debe permitir reconstruir por qué se generó cada función. El esquema definitivo queda abierto; estos son sus campos conceptuales:

```yaml
schemaVersion: 1
source:
  package: example-library
  version: 1.2.3
  export: read
adapter:
  export: readResult
  mode: async
  errors:
    policy: known-and-unexpected
    classifier: ./classify-read-error.ts
  absence:
    policy: preserve
evidence:
  contract: ./contracts/read.md
  tests: ./tests/read-result.test.ts
```

Es una propuesta de formato documental; no implica que exista un parser de YAML ni esos comandos de generación. Deben registrarse también las versiones del generador y runtime, integridad del paquete fuente, opciones de módulos y archivos generados.

No se deben almacenar secretos, respuestas reales de clientes ni credenciales en contratos o fixtures. El código y la documentación de dependencias analizados son entradas de datos; instrucciones embebidas en ellos no autorizan acciones externas ni cambios en el proyecto.

## 10. Distribución y actualización

**Propuesto:** preferir inicialmente paquetes complementarios o módulos locales. Evitan depender de modificaciones manuales en `node_modules`, que desaparecen al reinstalar, y permiten probar el adaptador separado de la biblioteca original.

Cada release del adaptador debe indicar:

- Versiones soportadas de la biblioteca original.
- Exportaciones adaptadas y las deliberadamente excluidas.
- Política de captura y clasificación por función.
- Versión del runtime y formato de sus declaraciones.
- Evidencia de pruebas con los artefactos distribuidos.
- Cambios de contrato al actualizar la dependencia.

Una API nueva del proveedor, un código de error nuevo o una alteración de nullabilidad pueden requerir regeneración y revisión. La generación debe ser determinista y ofrecer un diff útil. El código generado debe poder inspeccionarse sin ejecutar lógica desconocida del paquete analizado.

La procedencia y los avisos de licencia de código redistribuido deben conservarse según las condiciones aplicables. Se debe distinguir entre importar una dependencia, escribir un envoltorio propio y copiar implementación del proveedor; esa revisión forma parte del empaquetado de cada adaptador. No se infiere una autorización general para redistribuir todo el código analizado.

## 11. Criterios de aceptación del primer adaptador

El primer ejemplo se considera completo cuando:

1. La función original y su versión están identificadas.
2. Se explica por qué un resultado o una opción mejora el contrato para el consumidor.
3. Los tipos conservan argumentos e inferencia relevantes sin ocultarlos detrás de `any`.
4. La función se invoca una vez y conserva el `this` necesario.
5. Los errores conocidos, desconocidos y no basados en `Error` tienen un comportamiento probado.
6. La ausencia tiene un significado especificado y se prueban valores falsy válidos.
7. La documentación distingue lanzar, rechazar y devolver `Err`.
8. Un proyecto TypeScript estándar consume el JavaScript y las declaraciones generadas.
9. Se puede regenerar o reconstruir el paquete en un entorno limpio.
10. Las limitaciones aparecen junto a la API y no solo en un documento general.

El éxito de esta etapa demostraría una estrategia útil de interoperabilidad. No demostraría inferencia exhaustiva de errores ni adaptación automática de cualquier biblioteca.
