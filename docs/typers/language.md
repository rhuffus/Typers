# Diseño del lenguaje Typers

Este documento conserva el diseño inicial discutido para Typers y concreta las
preguntas que deben resolverse antes de ampliar el compilador. **Los ejemplos de
extensiones posteriores son propuestas; solo el subconjunto inicial de if-let
descrito en ADR 0004 pertenece al prototipo experimental.**
El estado ejecutable de cada funcionalidad debe comprobarse en el código, sus
pruebas y las notas de la versión correspondiente.

El catálogo y las prioridades se desarrollan en [features.md](features.md).
El primer contrato experimental de Result/Option e if-let se concreta en
[ADR 0004](decisions/0004-experimental-runtime-and-if-let.md). Ese registro resuelve
las alternativas iniciales de representación, activación y reconocimiento para el
prototipo; las demás extensiones de este documento siguen siendo propuestas.

## 1. Estados de las decisiones

Usamos estas etiquetas para separar intención y capacidad disponible:

- **Aceptado:** dirección acordada para el proyecto. No equivale a implementado.
- **Propuesto:** diseño recomendado que necesita validación antes de estabilizarse.
- **Abierto:** varias alternativas siguen siendo razonables.
- **Exploratorio:** idea que puede estudiarse, sin compromiso de implementación.
- **Fuera del alcance inicial:** no debe bloquear los primeros hitos.

### 1.1. Dirección aceptada

1. Typers es un fork de TypeScript, con base inicial en `v7.0.2`.
2. El producto final compila a JavaScript. El diseño no exige distribuir archivos
   TypeScript intermedios ni ejecutar dos compiladores en la aplicación del usuario.
3. Las nuevas capacidades se integrarán en el compilador; los valores `Result` y
   `Option` también necesitarán una biblioteca de ejecución pequeña.
4. El objetivo es conservar el comportamiento del TypeScript de referencia y
   añadir capacidades inspiradas en Rust de forma incremental.
5. La primera aplicación de referencia será un backend TypeScript + NestJS del
   contexto zhenix-ai, desarrollado y mantenido con ayuda de agentes de IA.
6. Se investigará la sustitución de la dependencia `typescript`, incluyendo
   herramientas que importan sus API. Esa sustitución requiere pruebas específicas;
   no se da por demostrada por compartir código con upstream.
7. El orden inicial recomendado es validar empaquetado y compatibilidad, incorporar
   `Result`/`Option` y después probar una primera sintaxis `if let` limitada.

### 1.2. Propuestas que aún necesitan una decisión técnica

- Estabilización de la representación pública y del paquete experimental `@typers/core`.
- Activación de las extensiones y extensión de los archivos fuente.
- Identidad de las variantes reconocidas por el compilador.
- Gramática exacta de patrones, `let-else`, `match` y propagación `?`.
- Reglas de mutabilidad de las variables introducidas por patrones.
- Versionado independiente del runtime y protocolo entre runtime y compilador.
- Qué API de herramientas heredadas se ofrecerán, con qué límites y coste.

### 1.3. Garantías que no debemos anunciar todavía

No está demostrada la compatibilidad universal con paquetes npm, plugins de
compilación, editores, transformadores, Oxlint u Oxfmt. Tampoco se ha demostrado
que Typers reduzca el uso de tokens, el tiempo de razonamiento o la tasa de errores
de los agentes. Son hipótesis evaluables, no propiedades automáticas del lenguaje.

## 2. Principios de diseño

### 2.1. Conservar el significado del código existente

Un programa válido en la versión TypeScript de referencia debe conservar su
comportamiento cuando no utiliza extensiones. La gramática nueva no debe cambiar
silenciosamente cómo se interpreta código existente.

Esto exige comprobar contextos donde ya aparece `?`: operador condicional,
encadenamiento opcional, parámetros y propiedades opcionales, tipos condicionales
y modificadores en tipos mapeados. Añadir un token o una rama al parser no basta
para garantizar esa propiedad.

La compatibilidad se juzga por programas y superficies concretas: diagnósticos,
tipos inferidos, archivos `.d.ts`, ejecución, mapas de fuentes y API públicas. La
igualdad exacta de los bytes JavaScript emitidos es una prueba útil cuando procede,
pero no sustituye la equivalencia observable ni se presupone para toda extensión.

### 2.2. Hacer explícitos los casos esperados

`Result<T, E>` representa éxito o error esperado; `Option<T>` representa presencia
o ausencia. No todos los errores de JavaScript pasan a ser valores por introducir
estos tipos. Una dependencia puede seguir lanzando una excepción, una promesa
puede rechazarse y un callback puede fallar.

La biblioteca no debe convertir cualquier excepción en un error de dominio sin
una política explícita. En particular, `Option` no debe borrar la causa de un
fallo: una consulta sin filas y una base de datos inaccesible son casos distintos.

### 2.3. Preferir mecanismos existentes antes de extender el lenguaje

TypeScript ya dispone de uniones discriminadas y estrechamiento de tipos según el
flujo de control. Son una base apropiada para el primer runtime, sin exigir una
jerarquía de clases ni un sistema de tipos paralelo. [Documentación de
estrechamiento de TypeScript](https://www.typescriptlang.org/docs/handbook/2/narrowing.html).

La sintaxis nueva debe justificar su coste con un beneficio observable que una
función normal no proporcione igual de bien. El retorno desde la función que
contiene `?`, por ejemplo, sí requiere una intervención en el lenguaje si se quiere
la forma postfix propuesta.

### 2.4. Preservar la semántica de JavaScript

Typers seguirá usando el modelo de objetos, referencias, recolección de basura,
promesas y excepciones de JavaScript. Una referencia extraída de `Some(objeto)` no
es una transferencia de propiedad y no clona el objeto.

`readonly` puede impedir ciertas escrituras durante la comprobación estática;
no congela automáticamente objetos en ejecución ni introduce préstamos o vidas
útiles de Rust. Las invariantes deben indicar si son estáticas o de ejecución.

### 2.5. Mantener un núcleo pequeño y comprensible para humanos y agentes

Cada extensión debe tener una especificación breve, ejemplos positivos y negativos,
diagnósticos claros y pruebas del código generado. Se evitarán conversiones
implícitas, nombres globales nuevos y convenciones que requieran adivinar el
contexto. La reducción de escritura no justifica por sí sola mayor ambigüedad.

## 3. Capas del diseño

| Capa | Responsabilidad | Primera entrega |
| --- | --- | --- |
| Runtime | Valores y funciones que existen en JavaScript | `Result`, `Option` y constructores |
| Compilador | Parser, tipos, control de flujo y emisión | `if let Some(binding)` limitado |
| Herramientas | Editor, formato, lint, mapas y declaración pública | Pruebas de integración por herramienta |
| Adaptadores | API adicionales para dependencias existentes | Funciones escritas y revisadas manualmente |
| Análisis/generación | Proponer o generar adaptadores con contratos comprobables | Exploración posterior |

En la base inicial, el compilador nativo se encuentra dentro de `tsc/`. Las rutas
relevantes incluyen `tsc/internal/parser`, `tsc/internal/ast`,
`tsc/internal/checker`, `tsc/internal/transformers`, `tsc/internal/printer` y
`tsc/internal/compiler/emitter.go`.
La existencia de fuentes del compilador anterior en la raíz no significa que la
API histórica de TypeScript esté disponible a través del compilador nativo.

La implementación puede usar una representación interna equivalente a construcciones
TypeScript existentes para simplificar el análisis o la emisión. Esa técnica
interna es compatible con producir JavaScript directamente; no obliga a publicar
un archivo `.ts` intermedio ni resuelve por sí sola la compatibilidad de herramientas.

## 4. Núcleo de valores: `Result` y `Option`

### 4.1. Contrato semántico propuesto

| Valor | Significado | Carga útil |
| --- | --- | --- |
| `Ok(value)` | La operación terminó con éxito | Un valor de tipo `T` |
| `Err(error)` | La operación devolvió un error esperado | Un valor de tipo `E` |
| `Some(value)` | Hay un valor | Un valor de tipo `T` |
| `None` | No hay un valor | Ninguna |

Proponemos objetos de unión discriminada con campos de solo lectura en el tipo.
El primer contrato experimental usa el paquete `@typers/core` y los discriminantes
`"ok"`, `"err"`, `"some"` y `"none"`. El paquete aún no se ha publicado; el formato
debe estabilizarse con sus pruebas antes de considerarse un contrato de versión estable:

```ts
// Contrato inicial experimental; revisar la versión pública del runtime.
type Result<T, E> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "err"; readonly error: E };

type Option<T> =
  | { readonly kind: "some"; readonly value: T }
  | { readonly kind: "none" };
```

Los constructores deben inferir la carga útil y evitar obligar al usuario a
escribir ambos parámetros de `Result` en cada llamada. `never` es una opción
natural para la rama no producida, aunque la firma final debe comprobarse en
retornos genéricos, uniones, callbacks y asignación contextual.

### 4.2. Invariantes que debe cubrir el runtime

- `Some(0)`, `Some(false)`, `Some("")`, `Some(null)` y `Some(undefined)` son valores
  presentes. La presencia depende de la variante, nunca de la veracidad del dato.
- `Ok(undefined)` sigue siendo éxito y `Err(undefined)` sigue siendo error.
- Construir `Ok`, `Err` o `Some` no ejecuta callbacks, no captura excepciones y no
  convierte o copia profundamente la carga útil.
- Una eventual función `fromNullable` sí convierte `null` y `undefined` en `None`,
  porque su nombre y contrato anuncian esa política.
- `Result<Option<T>, E>` debe poder distinguir error, ausencia y presencia. No se
  debe aplanar automáticamente a `Option<T>`.
- El runtime debe funcionar desde TypeScript y JavaScript estándar; no debe exigir
  instalar el compilador en producción.
- `readonly` no se debe documentar como inmutabilidad profunda.
- La comparación mediante identidad, como `option === None`, no será el contrato
  general de discriminación entre copias del paquete o valores serializados.

### 4.3. Superficie mínima y crecimiento

El primer núcleo incluye tipos y constructores. Después pueden añadirse funciones
como `isOk`, `isErr`, `isSome`, `isNone`, `map`, `mapErr`, `andThen`, `unwrapOr` y
conversiones explícitas. Antes de ampliar esa superficie deben decidirse funciones
libres frente a métodos y nombres separados para `Result`/`Option`.

No se incluye `unwrap` con comportamiento implícito de excepción en el núcleo
obligatorio. Si se ofrece más adelante, su comportamiento de fallo deberá estar
documentado y su uso podrá restringirse por lint. No será un sustituto habitual del
manejo de errores de dominio.

### 4.4. Identidad reconocida por la sintaxis

Se consideraron estas alternativas para reconocer `Option` y `Result`. El
prototipo de if-let selecciona el protocolo estructural de ADR 0004; las futuras
extensiones deben revisar si conservan ese contrato.

| Alternativa | Ventaja | Riesgo |
| --- | --- | --- |
| Forma estructural pública | Interoperabilidad con objetos y otras bibliotecas | Un objeto no relacionado puede coincidir accidentalmente |
| Marca de tipo asociada al runtime | Reconocimiento más explícito | Copias/versiones, declaraciones y serialización requieren diseño |
| Símbolo o protocolo en ejecución | Desambiguación de valores en ejecución | Coste, interoperabilidad y disponibilidad del runtime |
| Símbolo de declaración del paquete | Integración estrecha con el checker | Alias, reexportaciones, monorepos y duplicados del paquete |

No debe reconocerse una variante únicamente porque una función se llame `Some`.
Los alias de imports y el sombreado local deben tener una regla documentada. El
prototipo puede aceptar una única forma de importación si diagnostica las demás y
no anuncia soporte general que aún no tiene.

## 5. Primera sintaxis: `if let` limitado

### 5.1. Alcance recomendado

La referencia de Rust permite introducir variables cuando un patrón coincide.
Typers tomaría esa idea, con un alcance inicial mucho menor. [Referencia de `if`
en Rust](https://doc.rust-lang.org/reference/expressions/if-expr.html).

```text
// Sintaxis Typers propuesta; no es TypeScript estándar.
if let Some(user) = repository.findById(id) {
  sendWelcomeEmail(user);
} else {
  recordMissingUser(id);
}
```

Primer alcance propuesto:

- Una sentencia, no una expresión que produce un valor.
- Un único patrón `Some(binding)`, con un identificador simple.
- Un inicializador cuyo tipo sea el `Option<T>` admitido por el contrato.
- Bloque obligatorio para la rama coincidente.
- `else` opcional, inicialmente con bloque; ampliar a `else if` exige sus pruebas.
- Variable de tipo `T` disponible exclusivamente dentro de la rama coincidente.
- Sin patrones anidados, guardas, combinaciones con `&&`, extracción de propiedades,
  conversión automática de valores anulables ni variantes definidas por usuarios.

### 5.2. Semántica observable

1. Evaluar la expresión situada a la derecha de `=` exactamente una vez.
2. Examinar la variante del resultado, no su carga útil.
3. Si es `Some`, ligar el valor a `binding` y ejecutar el primer bloque.
4. Si es `None`, ejecutar `else` si existe.
5. Conservar excepciones, `return`, `break`, `continue` y `finally` de los bloques
   según el contexto JavaScript en el que se encuentren.

Una expansión conceptual posible, suponiendo el discriminante ilustrativo `kind`,
es la siguiente. **No especifica el formato exacto de salida ni el contrato final
del runtime.**

```ts
{
  const temporary = repository.findById(id);
  if (temporary.kind === "some") {
    const user = temporary.value;
    sendWelcomeEmail(user);
  } else {
    recordMissingUser(id);
  }
}
```

El nombre temporal real debe ser generado sin colisiones. Esta expansión sugiere
variables equivalentes a `const`; la mutabilidad final de los bindings es una
decisión pendiente que debe cerrarse antes de estabilizar sintaxis.

### 5.3. Diagnósticos iniciales

El compilador debe señalar, con ubicación en el código original:

- Inicializador que no es el `Option<T>` soportado.
- Patrón distinto del permitido en este hito.
- Uso de `binding` fuera de su bloque.
- Colisiones de declaración dentro del mismo ámbito.
- Patrón con argumentos ausentes o múltiples.
- Uso como expresión o encadenamiento no admitido.

Los casos con `any`, `unknown`, uniones de opciones y tipos genéricos deben tener
una política explícita. Para una primera implementación es preferible rechazar
con claridad lo no soportado que aceptar construcciones sin comprobación útil.

### 5.4. Asincronía

No hay espera implícita. Si el parser inicial admite una expresión `await` ordinaria,
la forma sería `if let Some(user) = await findUser(id) { ... }` dentro de una función
asíncrona. Su tipado y emisión requieren pruebas específicas. No se añadirá una
regla especial para tratar automáticamente `Promise<Option<T>>` como `Option<T>`.

Un rechazo de `findUser` mantiene su comportamiento de rechazo o excepción; no se
convierte en `None`. Esa conversión, si procede, pertenece a un adaptador explícito.

## 6. Ampliaciones del control de flujo

### 6.1. `let-else`

```text
// Sintaxis propuesta; firma y constructor existentes del runtime se omiten.
let Some(user) = repository.findById(id) else {
  return Err({ kind: "UserNotFound", id });
};

return Ok(user);
```

Su ventaja es mantener disponible `user` en el resto del ámbito sin anidar el caso
principal. Esa ventaja exige probar que la rama `else` no llega a la continuación
en la que `user` se usa. La referencia de Rust exige que dicha rama diverja; Typers
debe concretar la regla con el análisis de flujo de TypeScript. [Sentencias `let`
de Rust](https://doc.rust-lang.org/reference/statements.html#let-statements).

La primera versión puede limitar la salida a `return` y `throw` comprobables.
Aceptar llamadas de tipo `never`, bucles infinitos, `break` o `continue` necesita
reglas por contexto. Un `return` aparente dentro de un `try` no basta si un `finally`
lo sustituye con otra transferencia de control que permite continuar.

Debe conservar la evaluación única, definir ámbito y mutabilidad del binding y
producir un diagnóstico cuando exista cualquier camino admisible que continúe sin
valor. Este análisis es la razón de situarlo después de `if let`.

### 6.2. `while let`

```text
// Sintaxis propuesta.
while let Some(job) = queue.takeNext() {
  processJob(job);
}
```

La expresión se evalúa una vez por intento de iteración, incluida la evaluación
final que produce `None`. El binding es nuevo en cada iteración. `continue` debe
volver a evaluar la expresión; `break` termina el bucle. Closures capturadas en
iteraciones diferentes deben observar los bindings correspondientes.

Un bucle con `await` secuencial no introduce paralelismo. Deben especificarse los
destinos de etiquetas, los límites del ámbito y las interacciones con `try/finally`.
Puede avanzar después de `if let`, en paralelo conceptual con `let-else`; no tiene
por qué esperar a un sistema general de patrones.

### 6.3. `match`

```text
// Sintaxis ilustrativa, aún no acordada.
const response = match result {
  Ok(user) => ({ status: 200, user }),
  Err(error) => ({ status: 404, error }),
};
```

Proponemos comenzar con variantes cerradas de `Result`/`Option` y brazos sencillos,
antes de cubrir cualquier unión discriminada de TypeScript. Debe definirse:

- Evaluación única de la expresión examinada.
- Orden de selección y ejecución de un único brazo.
- Exhaustividad: todas las variantes posibles deben estar cubiertas o existir un
  caso por defecto permitido por la política del lenguaje.
- Inferencia del resultado del `match`, incluyendo contexto y brazos de tipo `never`.
- Ámbito de bindings por brazo y detección de patrones inalcanzables.
- Forma de los bloques con varias sentencias y de su valor final.
- Tratamiento de uniones abiertas, `any`, `unknown`, genéricos y evolución de tipos.
- Guardas y su relación con exhaustividad; una guarda puede fallar y no cubre por
  sí sola todos los valores de una variante.

La versión general añade patrones de objetos, tuplas, alternativas y anidamiento.
Su coste es mucho mayor que reconocer `Ok(x)` y `Err(e)`. El sistema de patrones
debe ser compartido con las otras construcciones para evitar reglas incompatibles.

### 6.4. Operador postfix `?`

```text
// Sintaxis propuesta; no es el operador condicional de TypeScript.
function loadUser(id: string): Result<User, LoadError> {
  const configuration = readConfiguration()?;
  const user = readUser(configuration, id)?;
  return Ok(user);
}
```

La intención es extraer la carga de `Ok` y retornar anticipadamente un `Err` desde
la función que contiene la expresión. La inspiración es la propagación de Rust,
pero Typers no promete sus traits ni conversiones. [Operador de propagación de
Rust](https://doc.rust-lang.org/reference/expressions/operator-expr.html#the-try-propagation-expression).

Primer alcance recomendado:

- Solo `Result<T, E>` en funciones síncronas declaradas con retorno `Result<U, F>`.
- Exigir que `E` sea asignable a `F`; usar conversión explícita cuando no lo sea.
- Empezar por posiciones controladas, como `const value = expression?;`, antes de
  aceptar el operador dentro de expresiones arbitrarias.
- No propagar fuera de la función léxicamente contenedora. Dentro de un callback,
  el retorno pertenece al callback.
- Rechazar contextos inicialmente no soportados: nivel superior, constructores,
  inicializadores de clase y generadores, entre otros.

La expansión de una declaración simple puede producir un temporal y un retorno.
No debe generalizarse mediante una función envolvente inmediata: su `return` no
saldría de la función que escribió el usuario y podría cambiar `this`, `arguments`,
`await`, `yield` o la pila de errores.

En una expresión como `send(first(), load()?, last())`, el compilador debe respetar
el orden observable: evaluar lo que JavaScript evaluaría antes de `load`, no
ejecutar `last` en el error, preservar el receptor `this` de las llamadas y evitar
repetir accesos con getters. `&&`, `||`, `??`, expresiones condicionales y parámetros
por defecto necesitan un tratamiento específico.

Un retorno generado ejecuta los `finally` que correspondan. Si ese `finally` lanza
o retorna otra cosa, se aplican las reglas normales de JavaScript. No se debe
prometer que el `Err` siempre será el resultado observable en esos casos.

Una fase posterior puede admitir `(await operation())?` en funciones que devuelven
`Promise<Result<T, E>>`. La espera debe seguir siendo explícita; un rechazo no se
convierte automáticamente en `Err`. El soporte para `Option` también es posterior
y debe impedir mezclas implícitas entre ausencia y error.

## 7. Errores, adaptadores y límites de inferencia

### 7.1. Tres categorías útiles

| Categoría | Ejemplo | Tratamiento recomendado |
| --- | --- | --- |
| Ausencia esperada | Búsqueda sin coincidencias | `Option<T>` |
| Error esperado de operación | Conflicto de versión o entrada inválida | `Result<T, E>` |
| Fallo no clasificado o defecto | Excepción inesperada de una dependencia | Política explícita en el límite de la aplicación |

Un resultado de dominio puede ser un objeto discriminado; no necesita heredar de
`Error`. Si se guarda la excepción original como causa, debe preservarse para
observabilidad cuando sea útil, sin exponer automáticamente información interna en
la respuesta HTTP.

### 7.2. Adaptador manual inicial

```ts
// TypeScript estándar; nombres del runtime ilustrativos.
type ReadFailure =
  | { readonly kind: "MissingFile"; readonly path: string }
  | { readonly kind: "UnknownReadFailure"; readonly cause: unknown };

async function readConfiguration(
  path: string,
): Promise<Result<string, ReadFailure>> {
  try {
    return Ok(await existingReadFile(path));
  } catch (cause: unknown) {
    if (isMissingFileError(cause)) {
      return Err({ kind: "MissingFile", path });
    }
    return Err({ kind: "UnknownReadFailure", cause });
  }
}
```

Este ejemplo propone una política: clasificar un caso conocido y conservar los
demás como desconocidos. Otra API puede optar por relanzar los casos no clasificados.
La elección debe ser parte del contrato, no una consecuencia accidental del
generador de adaptadores.

### 7.3. Qué puede prometer el análisis automático

Analizar fuentes y declaraciones puede descubrir puntos de `throw`, promesas y
convenciones documentadas, pero no demostrar de forma general todos los errores
posibles de una biblioteca JavaScript. Dependencias transitivas, callbacks,
reflexión, proxies y código nativo impiden deducir un conjunto cerrado completo.

Por ello, un futuro generador debe:

1. Conservar la API original de la biblioteca.
2. Generar una API adicional, inicialmente en un paquete adaptador separado.
3. Registrar la versión de origen y las reglas utilizadas.
4. Distinguir errores declarados/documentados, patrones inferidos y casos desconocidos.
5. Permitir revisar y corregir la clasificación.
6. Usar `unknown` o una variante explícita para incertidumbre; no emitir uniones
   cerradas que prometan exhaustividad sin evidencia.
7. Preservar `this`, sobrecargas, genéricos, parámetros opcionales, cancelación y
   características de streaming según el contrato de cada API.

No se debe envolver una clase completa indiscriminadamente: capturar una excepción
síncrona, el rechazo de una promesa, un evento `error` y el fallo posterior de un
iterador son operaciones diferentes.

## 8. Compatibilidad de herramientas y código distribuido

### 8.1. Fuente extendida y artefactos públicos

La aplicación puede usar sintaxis Typers si sus herramientas la comprenden. Una
biblioteca distribuida debe ofrecer JavaScript y declaraciones TypeScript estándar
para que consumidores normales no necesiten entender esa sintaxis. Sus `.d.ts`
pueden referenciar el runtime público mediante tipos exportados resolubles.

Preservar un método de visita de AST existente no basta para hacer invisible un
nodo nuevo. Una herramienta puede inspeccionar nodos directamente, usar casos
exhaustivos de clases de nodo o volver a analizar texto con su propio parser.
Una vista compatible del AST necesitaría contratos sobre ubicaciones, comentarios,
símbolos, identidades y edición; es un trabajo separado de añadir el parser nuevo.

### 8.2. Oxlint y Oxfmt

El usuario trabaja con Oxlint, Oxfmt y un build personalizado de Oxlint para NestJS.
Estas herramientas necesitan comprender el texto fuente extendido. Sustituir la
dependencia npm `typescript` no modifica automáticamente su parser.

Antes de considerar `if let` utilizable en zhenix-ai hay que elegir y probar una
integración: soporte en el parser de Oxc y las herramientas, o una fase temporal
explícita con limitaciones documentadas. Formatear únicamente JavaScript generado
no ofrece formato del código que mantiene el desarrollador.

### 8.3. Experiencia de edición

Cada sintaxis deberá contemplar resaltado, recuperación tras errores de parseo,
autocompletado, renombrado, ir a definición, formato y diagnósticos. El parser debe
soportar código incompleto durante la escritura. La compilación correcta de un
archivo terminado es solo una parte de la experiencia.

## 9. Decisiones pendientes antes de estabilizar la gramática

| Pregunta | Propuesta inicial | Evidencia necesaria |
| --- | --- | --- |
| ¿Extensión `.ts` o nueva extensión? | Resolver en un ADR antes del parser público | Resolución de módulos, herramientas, editor y adopción |
| ¿Cómo se activa la sintaxis? | Activación explícita durante la fase experimental | Que proyectos TypeScript sin opt-in mantienen su interpretación |
| ¿Bindings mutables? | Empezar con semántica equivalente a `const` | Casos de reasignación, expectativas de usuarios y agentes |
| ¿Qué variantes reconoce el compilador? | Solo las del contrato inicial | Alias, reexportaciones y duplicados del paquete |
| ¿Se aceptan valores estructuralmente similares? | No decidir por coincidencia de nombre | Compatibilidad, falsos positivos y serialización |
| ¿`match` es expresión desde el principio? | Estudiar coste de inferencia y emisión | Contextos con `await`, retornos y brazos de bloque |
| ¿`?` soporta conversiones de error? | Solo asignabilidad; conversión explícita | Diagnósticos e inferencia predecibles |
| ¿Se transforman excepciones automáticamente? | No; adaptadores con política explícita | Casos desconocidos y observabilidad |
| ¿Qué ocurre al ignorar un `Result`? | Regla de lint posterior | Tipos, exclusiones y tasa de falsos positivos |
| ¿Cómo se versiona el protocolo runtime? | Contrato pequeño, declarado y probado | Mezcla de paquetes y compiladores compatibles/incompatibles |

Una decisión debe registrar alternativas, razón, ejemplos rechazados y cómo se
comprobará. Los experimentos pueden cambiar; una funcionalidad publicada exige una
política de migración.

## 10. Criterios comunes de aceptación de una extensión

1. Existe una especificación de gramática y semántica, incluso para casos inválidos.
2. El código TypeScript de referencia no cambia de significado por habilitar Typers.
3. Los bindings tienen tipo y ámbito correctos; no se introduce `any` silencioso.
4. Efectos laterales, orden de evaluación y transferencias de control se preservan.
5. La emisión funciona con los targets y módulos explícitamente admitidos.
6. Los diagnósticos y mapas de fuentes apuntan al programa original.
7. Los `.d.ts` públicos son consumibles por el TypeScript de referencia.
8. La aplicación NestJS demuestra comportamiento correcto en sus límites HTTP.
9. Se declaran las herramientas compatibles y las limitaciones conocidas.
10. La documentación distingue claramente disponible, experimental y planificado.

## 11. Fuera del alcance inicial

Los enums algebraicos propios, traits, impls, macros, préstamos, ownership y vidas
útiles son exploratorios. No son requisitos para `Result`, `Option`, patrones
limitados o propagación de errores. Adoptarlos implicaría rediseñar áreas centrales
del lenguaje y del ecosistema, especialmente el modelo de referencias JavaScript.

Typers tampoco pretende eliminar `throw`, reemplazar NestJS, exigir adaptar todas
las dependencias, convertir automáticamente código Rust ni garantizar seguridad
de memoria o rendimiento equivalentes a Rust.
