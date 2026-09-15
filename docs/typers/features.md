# Catálogo de funcionalidades y complejidad

Este catálogo reúne las capacidades comentadas para Typers y otras extensiones
relacionadas que conviene evaluar sin comprometer su implementación. El diseño
semántico inicial está en [language.md](language.md).

**Una prioridad en esta tabla no significa que una funcionalidad esté implementada.**
Las decisiones sobre detalles sintácticos siguen abiertas salvo donde se indica
explícitamente lo contrario. El objetivo es elegir incrementos verificables y
evitar que una demostración pequeña se convierta en un rediseño completo del lenguaje.

## 1. Cómo interpretar la complejidad

Las estimaciones son relativas, no promesas de calendario. La experiencia previa
con el compilador, la evolución upstream y el alcance de herramientas pueden
cambiar mucho el esfuerzo.

| Nivel | Interpretación |
| --- | --- |
| Baja | Biblioteca pequeña o contrato acotado, sin modificar gramática ni flujo de control |
| Media | Varias decisiones de API, inferencia o integración, con comportamiento acotable |
| Alta | Cambios coordinados en parser, tipos, flujo, emisión o varias herramientas |
| Muy alta | Semántica extensa, interacción transversal o compatibilidad con arquitecturas diferentes |
| Investigación | No hay aún un diseño ni una promesa de cobertura suficientemente delimitados |

Separamos **núcleo** y **ecosistema**: una sintaxis puede ser breve de reconocer en
el parser y costosa de mantener en editor, formatter, linter y plugins. Una prueba
de concepto no tiene el mismo coste que una capacidad estable para todos los
proyectos zhenix-ai.

Estados:

- **Dirección aceptada:** parte del objetivo del proyecto; detalles pendientes.
- **Primer incremento recomendado:** candidato para el comienzo de implementación.
- **Propuesta posterior:** útil tras completar sus dependencias.
- **Exploratorio:** no comprometido.
- **Fuera del alcance inicial:** no bloquea el primer producto utilizable.

## 2. Vista de conjunto

| ID | Funcionalidad | Estado | Núcleo | Ecosistema | Dependencia principal |
| --- | --- | --- | --- | --- | --- |
| C00 | Empaquetar y ejecutar el compilador base | Primer incremento recomendado | Media | Media | Build reproducible de upstream |
| C01 | Sustituir `typescript` en herramientas seleccionadas | Dirección aceptada; cobertura abierta | Muy alta | Muy alta | Inventario de API y versiones reales |
| R01 | `Result<T, E>`, `Ok`, `Err` | Primer incremento recomendado | Baja | Baja | Contrato runtime |
| R02 | `Option<T>`, `Some`, `None` | Primer incremento recomendado | Baja | Baja | Contrato runtime |
| R03 | Predicados y conversiones explícitas | Propuesta posterior | Baja | Baja | R01 y R02 |
| R04 | Composición: `map`, `mapErr`, `andThen` | Propuesta posterior | Media | Baja | Invariantes y firmas de R01/R02 |
| R05 | Adaptación manual de excepciones/rechazos | Propuesta posterior | Media | Media | Política de errores desconocidos |
| S01 | `if let Some(binding)` limitado | Primera sintaxis recomendada | Alta | Alta | R02 e identidad del runtime |
| S02 | `if let` con `Ok`/`Err` y `None` | Propuesta posterior | Media adicional | Media adicional | S01 y patrones consistentes |
| S03 | `while let` limitado | Propuesta posterior | Media/alta | Alta | S01, ámbitos por iteración |
| S04 | `let-else` limitado | Propuesta posterior | Alta | Alta | S01, análisis de continuación |
| S05 | `match` de variantes cerradas | Propuesta posterior | Alta | Alta | Patrones, exhaustividad e inferencia |
| S06 | `?` síncrono en posiciones limitadas | Propuesta posterior | Alta | Alta | R01, gramática y retornos anticipados |
| S07 | `?` en expresiones generales y funciones async | Propuesta posterior | Muy alta | Alta | S06 y preservación de evaluación |
| S08 | Patrones anidados, guardas y alternativas | Propuesta posterior | Muy alta | Alta | Sistema de patrones común |
| E01 | Regla `must_use` para resultados ignorados | Propuesta posterior | Media | Alta | Información de tipos en lint |
| E02 | Contratos de errores declarados | Exploratorio | Alta/muy alta | Alta | Política ante excepciones externas |
| A01 | Adaptadores publicados para bibliotecas concretas | Propuesta posterior | Media | Media/alta | R05 y contratos por biblioteca |
| A02 | Generador de adaptadores dirigido por manifiestos | Exploratorio con alcance viable | Alta | Alta | A01, manifiesto y revisión |
| A03 | Inferir automáticamente todos los errores de cualquier biblioteca | Fuera del alcance como garantía | Investigación | Investigación | No hay inferencia general completa prometible |
| T01 | Declaraciones estándar y mapas de fuentes para sintaxis nueva | Obligatorio para estabilizar sintaxis | Alta | Alta | Primera extensión de compilador |
| T02 | Oxlint, Oxfmt y editor con sintaxis Typers | Obligatorio para adopción en zhenix-ai | Alta | Muy alta | Parser y soporte por herramienta |
| T03 | Vista AST compatible para herramientas heredadas | Exploratorio | Muy alta | Muy alta | Contrato de posiciones, nodos y API |
| X01 | Enums algebraicos propios | Exploratorio | Muy alta | Muy alta | Diseño de tipos, runtime y declaraciones |
| X02 | Traits e `impl` | Exploratorio | Muy alta | Muy alta | Coherencia, resolución y modelo de tipos |
| X03 | Ownership, préstamos y vidas útiles | Fuera del alcance inicial | Investigación | Investigación | Rediseño del modelo de referencias |
| X04 | Macros o metaprogramación sintáctica | Exploratorio | Muy alta | Muy alta | Higiene, herramientas y seguridad de expansión |
| X05 | Adaptación de conceptos `using`/gestión de recursos | Exploratorio | Alta | Alta | Evaluar primero capacidades TypeScript existentes |

La complejidad de C01 no debe ocultarse detrás de R01: una biblioteca `Result` es
pequeña, mientras que reproducir API antiguas sobre un compilador nativo puede
convertirse en una línea de producto independiente. La compatibilidad debe
acotarse por herramientas, versiones y API observadas.

## 3. Bloque de fundamento: C00 y C01

### Objetivo

Demostrar primero qué puede ejecutar el fork sin sintaxis propia. Tener un paquete
llamado `typers` no hace que una dependencia que importa `typescript` lo encuentre.
Una instalación bajo el nombre esperado resuelve la búsqueda del paquete, pero
no implementa funciones ausentes ni satisface automáticamente todos los rangos de
dependencias.

### Alcance inicial

- Build del compilador correspondiente a la base fijada y comprobación de versión.
- Empaquetado local reproducible e instalación en una aplicación de prueba aislada.
- Compilación de TypeScript estándar y ejecución del JavaScript producido.
- Inventario de herramientas NestJS que importan la API de TypeScript, separado de
  las que solo ejecutan un binario o consumen JavaScript.
- Prueba con versiones fijadas de Nest CLI y plugins seleccionados.
- Inspección del árbol de dependencias para detectar otra copia de TypeScript.

### Criterios de salida

La documentación debe poder indicar exactamente qué comando y qué herramienta
funcionan, qué API faltan y qué tarea pendiente impide ampliar la cobertura. Un
fallo de `nest build` no invalida una prueba de ejecución NestJS mediante JavaScript
emitido; tampoco permite anunciar la sustitución completa de TypeScript.

No se debe resolver una incompatibilidad ocultando silenciosamente el compilador
original bajo el paquete nuevo. Si se necesita un puente que dependa de componentes
heredados, su arquitectura, tamaño y relación con el objetivo de sustitución deben
documentarse.

## 4. Núcleo runtime: R01 y R02

### Beneficio

Hacer visibles los casos de éxito, fallo y ausencia sin introducir sintaxis aún.
Este núcleo se puede usar en una aplicación TypeScript normal y permite validar
el estilo de servicios que posteriormente usará Typers.

### Alcance mínimo

- Uniones discriminadas `Result<T, E>` y `Option<T>`.
- Constructores `Ok`, `Err`, `Some` y valor `None`.
- Campos de solo lectura en el contrato de tipos.
- Artefactos JavaScript y declaraciones consumibles sin el compilador Typers.
- Inferencia en usos sencillos, retornos genéricos y ramas distintas.

### Riesgos y decisiones

- Elegir discriminantes y representación antes de que el compilador dependa de ellos.
- Evitar contratos basados exclusivamente en identidad de una única instancia.
- No confundir `Some(undefined)` con `None`.
- No prometer inmutabilidad profunda por usar `readonly`.
- Decidir formatos de módulos soportados y rutas públicas sin multiplicar puntos
  de entrada innecesariamente.
- No introducir dependencias del compilador en la instalación de producción.

### Aceptación

Pruebas de ejecución de todas las variantes y valores falsy; comprobaciones de
tipos válidos e inválidos; consumo de los artefactos empaquetados desde un proyecto
independiente; demostración de éxito, ausencia y error en un servicio NestJS.

## 5. Utilidades runtime: R03 y R04

### Candidatas

| Familia | Ejemplos de API propuestos | Decisión necesaria |
| --- | --- | --- |
| Predicados | `isOk`, `isErr`, `isSome`, `isNone` | Tipo predicado y nombres exportados |
| Conversión de anulables | `fromNullable` | `null` y `undefined`; ningún otro valor |
| Conversión entre contenedores | `okOr`, `toOption` | Pérdida o creación de información explícita |
| Transformación | `map`, `mapErr` | Funciones libres, métodos o módulos separados |
| Encadenamiento | `andThen` | Unión de tipos de error y evaluación perezosa |
| Valor alternativo | `unwrapOr`, `unwrapOrElse` | Evaluación eager frente a lazy |
| Colecciones | `collect`, `sequence` | Primer error, acumulación y orden |
| Combinaciones anidadas | `transpose`, `flatten` | Casos precisos y complejidad de inferencia |

Las primeras utilidades pueden ser pequeñas, pero no es necesario copiarlas todas
de Rust. Se incorporarán cuando un caso real las justifique y el nombre describa
su efecto de forma clara.

### Aceptación

Cada función ejecuta su callback solo en la variante adecuada y el número previsto
de veces; conserva tipos de error; no usa `any` para ocultar problemas de inferencia;
documenta si una excepción de un callback se propaga. Las variantes asíncronas
requieren contrato propio de espera, concurrencia y rechazo.

## 6. Primera extensión: S01 y S02

### Beneficio

Extraer un valor opcional en una rama sin repetir acceso al discriminante ni añadir
un sistema general de pattern matching desde el primer día.

### Alcance de S01

`if let Some(binding) = expression { ... }` con `else` opcional, un identificador,
un `Option<T>` reconocido y semántica de sentencia. Los ejemplos completos y las
preguntas abiertas están en [language.md](language.md).

### Trabajo necesario

1. Fijar activación, gramática e identidad del tipo/variante.
2. Incorporar nodos o una representación interna adecuada.
3. Analizar binding, tipo y ámbito.
4. Integrar control de flujo y emisión con evaluación única.
5. Mantener posiciones y recuperación de errores.
6. Probar TypeScript sin extensiones.
7. Dar soporte en herramientas antes de declarar uso general.

### Aceptación

Se admiten los casos positivos documentados, se rechazan patrones no soportados,
`0` y `false` no se tratan como ausencia, el inicializador se evalúa una vez y el
binding no escapa de su bloque. Deben probarse sombreado, nombres temporales,
`return`, `break`, `continue` y `finally` en contextos legales.

### Incremento S02

Añadir `Ok(binding)`, `Err(binding)` y patrones sin carga exige reutilizar el modelo
de patrones y cerrar la semántica de variantes/imports. Es menor que S01 una vez
existe esa base, pero sigue requiriendo tipos, diagnósticos y herramientas propios.

## 7. Guardas y bucles: S03 y S04

### `while let`: S03

El patrón se intenta al comienzo de cada iteración. La expresión se vuelve a
evaluar tras `continue`, los bindings se crean por iteración y el bucle termina en
la primera variante no coincidente.

**Riesgo principal:** una transformación que reutilice el mismo binding en todas
las iteraciones puede cambiar el comportamiento de closures; una transformación
que evalúe la condición una sola vez es incorrecta.

**Aceptación:** cero, una y varias iteraciones; evaluación final fallida; capturas
por closure; salidas con etiquetas; excepciones y `finally`; asincronía solo si está
explícitamente soportada.

### `let-else`: S04

El binding está disponible después de la sentencia. Por tanto, el compilador debe
probar que la rama alternativa no permite alcanzar esa continuación sin binding.

**Riesgo principal:** confundir presencia sintáctica de `return` con imposibilidad
semántica de continuar, especialmente con bloques anidados y `finally`.

**Aceptación:** rechazar cualquier rama `else` soportada que pueda continuar;
conservar el tipo fuera del guard; comprobar ámbitos y uso antes de declaración;
documentar qué transferencias de control admite la primera versión.

## 8. Selección y propagación: S05, S06 y S07

### `match` cerrado: S05

Inicialmente puede limitarse a `Option` y `Result`, cubriendo todas sus variantes.
Es necesario diseñar exhaustividad e inferencia del valor de los brazos. Esa
inversión proporciona una base reutilizable para futuras uniones y patrones.

**No requiere** implementar primero el operador `?`: ambos pueden utilizar una
infraestructura común sin depender de la sintaxis pública del otro.

**Aceptación:** evaluación única; un solo brazo ejecutado; error por variantes sin
cubrir; inferencia de tipos de retorno; bindings por brazo; resultados falsy; brazos
inalcanzables y emisión de declaraciones estándar.

### Propagación limitada: S06

Empezar con `const value = expression?;` en funciones síncronas con retorno
`Result<U, E>`. Exigir que el error sea asignable al retorno. No añadir conversiones
implícitas ni tratar cualquier objeto con un campo `error` como `Result`.

**Riesgo principal:** el símbolo `?` ya tiene varios papeles en TypeScript y el
retorno afecta a la función contenedora. El esfuerzo no está solo en imprimir un
`if` en JavaScript.

**Aceptación:** retorno temprano correcto; ningún paso posterior se ejecuta al
fallar; rechazo de retorno incompatible; límites de callbacks claros; gramática
TypeScript preexistente intacta; comportamiento de `finally` conservado.

### Expresiones generales y async: S07

Extender S06 a argumentos, inicializadores anidados, expresiones lógicas y
operaciones asíncronas exige preservar orden de evaluación, cortocircuitos,
receptores de llamadas, getters, `await` y temporales sin colisión.

**Aceptación:** pruebas con efectos laterales antes y después del operador,
rechazos de promesas, `Promise<Result<T, E>>`, retornos desde callbacks, módulos y
targets admitidos. No usar una función envolvente como sustituto general del
retorno desde la función original.

### Orden recomendado entre S05 y S06

No se ha acordado un orden inamovible. La ruta por defecto tras `let-else` puede
abordar `match` cerrado para consolidar patrones e inferencia y después `?`
limitado. Si el beneficio principal medido es la propagación, puede adelantarse
S06 una vez cerradas su gramática y sus restricciones. La decisión debe depender
de una prueba técnica, no de que un operador tenga un solo carácter.

## 9. Patrones generales: S08

Después del núcleo se pueden investigar patrones de objetos, tuplas, variantes
anidadas, alternativas y guardas. Deben compartir reglas entre `if let`,
`let-else`, `while let` y `match`.

Preguntas necesarias:

- ¿Qué lecturas de propiedades se realizan y cuántas veces?
- ¿Cómo se comportan getters, proxies y valores ausentes?
- ¿Qué nombres deben introducir todas las alternativas de un patrón?
- ¿Una guarda que modifica el valor invalida el estrechamiento de tipos?
- ¿Cómo se evita una comprobación de exhaustividad costosa en uniones grandes?
- ¿Qué ocurre al ampliar una unión exportada en una nueva versión de una dependencia?

Los primeros hitos no necesitan resolver este sistema general. Rechazar un patrón
anidado con un diagnóstico preciso es preferible a soportarlo parcialmente sin
semántica estable.

## 10. Disciplina de errores: E01 y E02

### Regla `must_use`: E01

La idea es detectar un `Result` que se descarta sin manejarlo. La primera entrega
puede ser una regla de lint, sin añadir atributos al lenguaje ni cambiar la
validez de todo TypeScript.

Debe distinguir expresiones realmente ignoradas de valores retornados,
almacenados, encadenados o descartados con una intención explícita permitida por
la política del proyecto. `Promise<Result<...>>` cruza esta regla con la de promesas
no esperadas; no basta con buscar el nombre textual `Result`.

**Aceptación:** fixtures positivos y negativos con alias, genéricos y funciones
externas; configuración de severidad y exclusiones; justificación de supresiones;
tasa aceptable de falsos positivos en una aplicación real.

### Contratos de errores: E02

Una futura anotación podría documentar errores esperados o restringir el uso de
excepciones en módulos propios. No puede convertir automáticamente todos los
errores posibles de JavaScript en una unión cerrada conocida.

El primer paso recomendado es usar tipos de retorno y adaptadores explícitos.
Un sistema de efectos o excepciones comprobadas sería una extensión separada,
con coste en inferencia, funciones de orden superior, interoperabilidad y adopción.

## 11. Adaptadores: A01, A02 y A03

### API adicional manual: A01

Elegir una biblioteca pequeña y una operación concreta permite definir y probar:

- Error esperado, ausencia y fallo no clasificado.
- Excepción síncrona frente a rechazo asíncrono.
- Conservación de genéricos, sobrecargas, `this` y parámetros.
- Cancelación, recursos y efectos laterales.
- Política de relanzamiento o variante de error desconocido.

La API original permanece disponible. Un paquete adaptador externo es un punto
de partida que no requiere controlar ni modificar repositorios de terceros.

### Generación guiada: A02

Un manifiesto revisable puede declarar métodos, variantes de resultado, códigos de
error conocidos y política de desconocidos. El generador produce código y pruebas
que se revisan como cualquier otra contribución.

**Aceptación:** salida determinista; versión de dependencia registrada; cambios
detectables cuando cambian declaraciones; pruebas de contratos; ninguna pérdida
silenciosa de sobrecargas; incertidumbre representada en tipos y documentación.

### Inferencia universal: A03

No se promete un generador que descubra todos los errores de cualquier biblioteca
arbitraria y publique una API exhaustiva sin revisión. El análisis puede sugerir
adaptadores y ayudar a mantenerlos, pero debe reconocer sus límites en código
dinámico, dependencias transitivas, callbacks y extensiones nativas.

## 12. Herramientas: T01, T02 y T03

### T01: artefactos y depuración

El JavaScript debe conservar semántica y los `.d.ts` deben ser TypeScript estándar.
Los mapas de fuentes deben apuntar a expresiones y bindings originales. Las
pruebas deben consumir paquetes generados, no solo fuentes dentro del monorepo.

### T02: Oxc y editor

Oxlint, Oxfmt y otras herramientas con parser propio necesitan soporte explícito.
La integración debe probar tanto código válido como código incompleto en edición,
comentarios y formato estable. Los agentes deben recibir diagnósticos y comandos
que correspondan a lo realmente soportado.

### T03: vista AST compatible

Una API adicional de recorrido del árbol Typers es posible como diseño, pero
conservar el nombre del método antiguo no demuestra que cualquier herramienta
acepte los nodos nuevos. Una representación normalizada debe resolver posiciones,
identidades, comentarios y vínculo con símbolos y tipos, además del recorrido.

Tratar esta capacidad como exploración evita comprometer un puente universal sin
inventariar las herramientas concretas que lo necesitan.

## 13. Extensiones exploratorias: X01–X05

| Propuesta | Beneficio potencial | Razón para posponer |
| --- | --- | --- |
| Enums algebraicos | Declarar variantes con cargas de forma concisa | Result/Option y uniones actuales permiten validar el valor sin gramática nueva |
| Traits e `impl` | Compartir comportamiento mediante contratos explícitos | Resolución, coherencia e interacción con tipos estructurales requieren diseño amplio |
| Ownership/préstamos | Restringir aliasing y ciertas mutaciones | JavaScript conserva referencias compartidas, GC y bibliotecas que no siguen ese modelo |
| Macros | Reducir repetición o generar construcciones | Higiene de nombres, diagnósticos, editor y mantenimiento aumentan mucho la superficie |
| Recursos | Manejar limpieza de forma explícita | Evaluar primero las capacidades de gestión de recursos ya disponibles en TypeScript |

No se copiarán características de Rust solo por completar una lista. Cada propuesta
debe mostrar qué problema de zhenix-ai resuelve, qué alternativa TypeScript existe
y qué coste adicional supone para herramientas y agentes.

## 14. Ruta de implementación de menor a mayor alcance

Este orden organiza dependencias y aprendizaje; no es un compromiso de publicar
todas las funcionalidades.

1. **Fundamento verificable:** C00, inventario C01 y aplicación TypeScript/NestJS
   de referencia. Resolver bloqueos de empaquetado y declarar límites conocidos.
2. **Valores explícitos:** R01 y R02, pruebas de tipos y ejecución, ejemplo NestJS
   con éxito, ausencia y error. Validar paquetes desde un consumidor independiente.
3. **Ergonomía sin sintaxis:** las utilidades R03 necesarias y un adaptador manual
   pequeño. Evitar construir una biblioteca extensa antes de probar su uso real.
4. **Primer recorrido del compilador:** S01, con herramientas T01/T02 suficientes
   para experimentar y una comparación con la versión TypeScript equivalente.
5. **Patrones acotados:** S02, S04 y S03 según beneficio; compartir infraestructura
   y conservar ámbitos y control de flujo.
6. **Selección y propagación:** S05 y S06 con alcances limitados y decisiones
   explícitas sobre orden; después S07 cuando se justifique su coste.
7. **Disciplina y adopción:** E01, adaptadores A01/A02 y ampliación de compatibilidad
   C01 sobre herramientas reales, con mediciones de experiencia de agentes.
8. **Generalización solo con evidencia:** S08, T03 y propuestas exploratorias.

La compatibilidad, las pruebas de regresión y la actualización upstream son tareas
continuas de todos los pasos. No deben acumularse como una fase final después de
implementar la sintaxis.

## 15. Condiciones para promover o detener una funcionalidad

Una propuesta pasa a implementación cuando tiene un caso real, un alcance mínimo,
una semántica escrita, pruebas identificadas y una forma de integración viable.
Pasa a estable cuando se validan sus garantías y se publica su compatibilidad.

Debe reducirse o posponerse si:

- Exige modificar silenciosamente semántica TypeScript existente.
- Su principal ventaja ya se obtiene con una API pequeña y clara.
- Depende de un puente universal de herramientas aún no diseñado.
- Introduce inferencia engañosa de errores o conversiones implícitas difíciles de prever.
- Los agentes cometen más errores persistentes que con la alternativa estándar.
- El mantenimiento de parches dificulta incorporar correcciones upstream.

La popularidad futura no es un criterio verificable por anticipado. Sí lo son la
facilidad de instalación, los diagnósticos, la calidad de documentación, la
interoperabilidad demostrada, la estabilidad y el coste real de usar y mantener
Typers.
