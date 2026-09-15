# Desarrollo con agentes y evaluación de Typers

[Índice de documentación](README.md) · [Arquitectura](architecture.md) · [Compatibilidad](compatibility.md) · [Adaptadores](adapters.md)

## 1. Motivación y distinción entre hipótesis y evidencia

El usuario ha elegido TypeScript y NestJS como stack de backend para zhenix-ai, con desarrollo realizado por agentes. Rust es su lenguaje preferido y motiva las funciones de resultados explícitos, ausencia y control de flujo que se quieren incorporar.

**Aceptado:** mantener el stack de aplicación y añadir pocas construcciones que ayuden a expresar esas ideas.

**Hipótesis por evaluar:** los agentes podrían producir código más claro y cometer menos errores cuando el contrato de éxito, ausencia y fallo está representado en tipos y construcciones limitadas.

**No demostrado:** que un lenguaje nuevo o un fork poco conocido consuma los mismos tokens, requiera el mismo tiempo de razonamiento o alcance la misma tasa de acierto que TypeScript/NestJS convencional. La familiaridad percibida de los agentes con TypeScript y Rust no prueba que conozcan la combinación exacta de Typers.

Tampoco se deduce popularidad comunitaria de la viabilidad técnica. La adopción dependerá de resultados, facilidad de instalación, mantenimiento y experiencia con las herramientas que utiliza cada proyecto.

## 2. Beneficios esperados que merece la pena medir

| Hipótesis | Mecanismo propuesto | Evidencia que la apoyaría |
| --- | --- | --- |
| Menos errores al tratar ausencia. | `Option` obliga a distinguir presencia y ausencia. | Menos fallos de casos nulos y falsy en pruebas no visibles al agente. |
| Errores de dominio más completos. | `Result` expone variantes en el tipo devuelto. | Mayor cobertura de errores esperados sin convertir todo a `unknown` o `any`. |
| Código más fácil de revisar. | Un conjunto pequeño de patrones consistentes. | Revisores encuentran y corrigen defectos con menos esfuerzo. |
| Menos reparación de errores de tipos. | Diagnósticos precisos y ejemplos canónicos. | Menos ciclos de edición/compilación para tareas comparables. |
| Menos texto repetitivo. | Una sintaxis breve expresa una semántica común. | Menos tokens totales por tarea correcta, incluyendo documentación y reparaciones. |

Son hipótesis de producto. No se convierten en afirmaciones públicas por observar un ejemplo especialmente favorable.

## 3. Costes que también deben medirse

Cada extensión introduce un vocabulario que el agente debe aprender o recuperar. Puede disminuir el código repetido y aumentar simultáneamente el coste de documentación, fallos de herramientas o incertidumbre sintáctica.

Riesgos específicos:

- Mezclar sintaxis de Rust que Typers no admite con la pequeña parte implementada.
- Inventar `match`, `?` o combinadores todavía ausentes porque aparecen en documentos de propuesta.
- Suponer que `Result` elimina cualquier `throw` y ocultar fallos inesperados.
- Utilizar operadores de escape de tipos para silenciar errores de una API nueva.
- Pasar un formatter que no comprende la sintaxis y entrar en un bucle de reparación.
- Modificar código generado en vez de sus fuentes.
- Confundir el compilador Go de `tsc/` con el árbol histórico escrito en TypeScript.
- Intentar resolver incompatibilidades instalando otro compilador sin reportarlo.
- Ampliar una tarea pequeña de parser a un sistema completo de patrones.

El diseño debe reducir estos riesgos con contratos breves, estado de funciones visible y diagnósticos útiles. No basta con pedir al agente que tenga cuidado.

## 4. Tres variantes para una comparación justa

El experimento inicial debe separar el valor del runtime del valor de cambiar la sintaxis.

| Variante | Entorno | Qué permite aislar |
| --- | --- | --- |
| A | TypeScript/NestJS convencional, con convenciones de errores claramente documentadas. | Referencia de trabajo habitual. |
| B | TypeScript/NestJS estándar con el runtime `Result`/`Option` de Typers. | Efecto de los contratos de datos sin un parser nuevo. |
| C | Typers/NestJS con el mismo runtime y solo las extensiones implementadas. | Efecto adicional de la sintaxis y su integración. |

Las tres variantes necesitan una tarea equivalente y pruebas de comportamiento comparables. No sería justo dar a Typers una especificación detallada y dejar a la referencia sin convenciones o sin documentación del dominio.

Una mejora de B frente a A no demuestra una mejora de C frente a B. Si el runtime aporta casi todo el beneficio y la sintaxis añade fricción, esa conclusión también es útil para priorizar.

## 5. Corpus inicial de tareas

Las tareas deben parecerse al trabajo que zhenix-ai realmente realizará, con casos que favorezcan y que no favorezcan las nuevas construcciones.

### Aplicación

- Crear un endpoint que devuelve un recurso o una ausencia esperada.
- Añadir validación de entrada y distinguir errores de dominio de errores de infraestructura.
- Componer dos operaciones síncronas y dos asíncronas sin duplicar efectos.
- Mantener una transacción al fallar una operación intermedia.
- Añadir un nuevo error a una unión y actualizar los consumidores pertinentes.
- Cambiar una política de ausencia sin alterar valores falsy válidos.

### Mantenimiento

- Localizar un fallo de ámbito o de narrowing en código existente.
- Reparar una regresión introducida en un adaptador.
- Actualizar una dependencia y detectar un cambio de contrato.
- Añadir una prueba que reproduzca un defecto sin cambiar comportamiento ajeno.
- Migrar un módulo pequeño entre la variante B y la C.
- Leer un diagnóstico y corregir el código con la modificación mínima.

### Herramientas y distribución

- Configurar un build en un proyecto limpio con versiones fijadas.
- Consumir una biblioteca a través de JS y `.d.ts`, sin acceso a sus fuentes.
- Identificar qué compilador está cargando una herramienta de Nest.
- Resolver un problema de formato o lint utilizando únicamente capacidades soportadas.

Las pruebas de aceptación deben existir antes de comparar resultados y contener casos no anticipados literalmente en el enunciado: falsy, efectos secundarios, throws no basados en `Error`, cancelación cuando corresponda y variantes adicionales.

## 6. Métricas

### Calidad y corrección primero

| Métrica | Qué mide | Precaución |
| --- | --- | --- |
| Tareas correctas al primer intento | Si la primera solución completa supera el criterio. | Definir dónde termina ese intento. |
| Tareas correctas al terminar | Resultado tras el presupuesto autorizado. | No contar una respuesta verbal como implementación. |
| Pruebas de comportamiento superadas | Corrección de casos públicos y reservados. | El número bruto de tests no mide dificultad. |
| Regresiones introducidas | Daños fuera del cambio solicitado. | Evaluar con un corpus estable. |
| Escapes del sistema de tipos | Uso injustificado de `any`, casts o supresiones. | Revisar contexto; no todo cast es un defecto. |
| Errores no tratados | Fallos de dominio ignorados o clasificación incorrecta. | Distinguir política legítima de propagación y omisión accidental. |

### Coste completo de la tarea

- Tokens de entrada y salida reportados por el sistema utilizado.
- Tokens de herramientas y documentación incluidos, si la medición los expone.
- Tokens de razonamiento cuando estén disponibles; marcar «no disponible» cuando no lo estén.
- Tiempo total de pared y tiempo de herramientas por separado.
- Número de intentos de build, fallos de formato y ciclos de reparación.
- Coste monetario con precios y fecha fijados, solo si se quiere tomar esa decisión económica.
- Tiempo de revisión humana y cambios solicitados por el revisor.

No usar líneas de código como sustituto de tokens, ni tokens observados como acceso al razonamiento interno del agente. Una construcción corta puede generar más investigación y reparaciones que una alternativa larga.

### Complejidad de la solución

Debe evaluarse tanto complejidad del programa como complejidad del entorno:

- Número de conceptos nuevos necesarios para entender la solución.
- Anidamiento y cantidad de ramas relevantes.
- Claridad de tipos públicos y de fronteras de error.
- Dependencias adicionales y configuración especial.
- Facilidad para depurar el JS emitido y volver al origen.
- Esfuerzo de actualizar una herramienta o una base upstream.

Ninguna de estas métricas debe optimizarse aisladamente sacrificando corrección.

## 7. Diseño del experimento

**Propuesta de protocolo:**

1. Fijar revisiones del repositorio y artefactos de las variantes A, B y C.
2. Fijar modelo, configuración de razonamiento, herramientas, presupuestos y versiones del entorno.
3. Preparar documentación equivalente y una referencia breve de funciones disponibles.
4. Ejecutar varias tareas y repeticiones en workspaces independientes, sin historial de intentos anteriores.
5. Variar el orden de las variantes para reducir el efecto del orden de ejecución.
6. Mantener pruebas reservadas fuera de los archivos que el agente puede modificar.
7. Evaluar resultados con criterios definidos antes de leer qué variante ganó.
8. Registrar errores y resultados incompletos, sin eliminarlos de la muestra.
9. Presentar medianas, dispersión y resultados por familia de tarea, no solo un promedio global.
10. Repetir después de cambios relevantes en el lenguaje, la documentación o el modelo.

El número de tareas y repeticiones depende de la variabilidad observada. Una prueba piloto sirve para mejorar el corpus y estimar esa variabilidad; no debe presentarse como evidencia concluyente de igualdad de eficiencia.

Cuando se quiera afirmar que el coste es equivalente, hay que definir por adelantado qué margen de diferencia se considera aceptable y con qué incertidumbre. Una diferencia observada pequeña en tres ejemplos no demuestra equivalencia general.

## 8. Documentación para agentes

El repositorio necesita dos niveles que se mantengan sincronizados:

1. **Referencia rápida:** qué existe hoy, cómo construir y probar, y ejemplos mínimos correctos.
2. **Documentación de diseño:** motivación, alternativas, propuestas futuras y limitaciones.

La referencia rápida debe separar de forma visible las funciones implementadas de las previstas. Un ejemplo de `match` en una hoja de ruta no debe parecer una instrucción de uso vigente.

Contenido mínimo de la referencia rápida cuando exista implementación:

- Versión del compilador, base upstream y versión del runtime.
- Lista cerrada de construcciones soportadas.
- Comandos reproducibles que se hayan ejecutado realmente.
- Una transformación de referencia para cada construcción nueva.
- Errores habituales y diagnóstico esperado.
- Modo de compilar, probar, formatear y ejecutar la app NestJS de referencia.
- Limitaciones conocidas, incluidas las de API del compilador y parsers externos.

**Propuesto:** preferir ejemplos canónicos sobre un catálogo de estilos equivalentes. En el runtime inicial, un agente no necesita elegir entre cinco bibliotecas de combinadores, tres formas de propagación y varios dialectos de patrones.

## 9. Contrato para implementar una funcionalidad

Una tarea de implementación debe especificar:

1. **Problema observable:** un ejemplo de código y la conducta que falta.
2. **Alcance:** gramática o API exacta y casos excluidos de esta revisión.
3. **Semántica:** tipos, ámbitos, orden de evaluación y comportamiento de error.
4. **Superficies afectadas:** parser, checker, emisor, editor, runtime y herramientas.
5. **Pruebas de aceptación:** casos positivos, negativos y de efectos.
6. **Compatibilidad:** corpus y consumidores que deben conservarse.
7. **Documentación:** estado y ejemplos que deben actualizarse.
8. **Resultado revisable:** diff y evidencia, con las limitaciones que quedan abiertas.

Las pruebas deben detectar fallos plausibles. Un test que repite el mismo algoritmo de la implementación en otra función ofrece poca protección. Para `if let`, comprobar evaluación única y ámbito es más útil que verificar solo que el texto emitido contiene la palabra `if`.

Los agentes pueden repartir investigación, pruebas y revisión por archivos o contratos claros. Las ediciones compartidas requieren coordinación de ownership, y las operaciones de Git se centralizan para evitar mezclar cambios o perder trabajo concurrente.

## 10. Diagnósticos como parte del producto

Un buen diagnóstico debe permitir corregir el código sin estudiar la implementación del compilador.

Para una extensión nueva, los mensajes deben:

- Nombrar la construcción que falló.
- Señalar el fragmento de fuente original.
- Describir el tipo o ámbito requerido y el encontrado.
- Distinguir un uso inválido de una capacidad aún no implementada.
- Sugerir una alternativa válida cuando sea concreta y no ambigua.

Ejemplo de intención de diagnóstico, no texto definitivo:

```text
El patrón Some(nombre) requiere Option<T>; esta expresión tiene tipo User | undefined.
```

Esto es más útil para un agente que un error del JavaScript temporal generado. Las ubicaciones correctas también reducen reparaciones accidentales de líneas cercanas.

Las sugerencias deben mantenerse con el lenguaje real. No recomendar `?` en un diagnóstico si esa versión solo implementa `if let`.

## 11. Adopción comunitaria: hipótesis y validación

La posibilidad de que Typers interese a la comunidad depende de ofrecer una mejora concreta que compense su coste de integración. No existe todavía evidencia de demanda o adopción de este proyecto.

Factores que merece la pena validar con ejemplos y usuarios reales:

| Hipótesis | Validación práctica |
| --- | --- |
| Resultados explícitos facilitan código de backend. | Mostrar un módulo pequeño antes/después con errores tratados. |
| El runtime tiene valor independiente del fork. | Consumirlo desde un proyecto TypeScript estándar sin configuración del compilador. |
| Una sintaxis pequeña es más fácil de adoptar. | Medir comprensión y mantenimiento con pocas construcciones estables. |
| Las herramientas existentes reducen fricción. | Publicar una matriz real de build, test, lint, formato y editor. |
| La distribución de JS y `.d.ts` evita obligar a todos los consumidores a migrar. | Probar una biblioteca Typers desde un consumidor TypeScript convencional. |
| Seguir upstream resulta sostenible. | Medir esfuerzo y regresiones durante actualizaciones sucesivas. |

La documentación, la estabilidad de releases y las limitaciones honestas son parte de esa evaluación. Stars, descargas o comentarios aislados no sustituyen el uso continuado en aplicaciones.

Las demostraciones públicas deberían centrarse en una mejora verificable. «Inspirado en Rust» describe la procedencia de las ideas; no debe implicar las mismas garantías de seguridad, memoria, rendimiento o tratamiento exhaustivo de errores.

## 12. Criterios para continuar, ajustar o detener una extensión

**Continuar** cuando mejora claridad o corrección, su integración está probada y el coste adicional cabe en el objetivo del proyecto.

**Ajustar** cuando la intención es útil pero los agentes confunden sintaxis, los diagnósticos no ayudan o las herramientas provocan demasiadas reparaciones. Las primeras mejoras pueden estar en contratos y documentación, sin añadir más funciones.

**Posponer** cuando la misma utilidad se obtiene con el runtime y una extensión todavía exige un coste elevado de mantenimiento o rompe el flujo de herramientas de referencia.

Estos criterios no cancelan la visión de Typers. Evitan que el orden de desarrollo dependa únicamente del atractivo de una característica de Rust.

## 13. Plantilla de informe de evaluación

Cada informe futuro debe incluir:

```text
Fecha y responsable:
Commit Typers y base TypeScript:
Versión del runtime:
Modelo y configuración:
Entorno y herramientas:
Variantes comparadas:
Tareas y número de repeticiones:
Criterio de corrección:
Resultados completos e incompletos:
Tokens y tiempos disponibles:
Errores más frecuentes:
Limitaciones de la muestra:
Conclusión y siguiente decisión:
Enlaces a artefactos y comandos reproducibles:
```

No hay resultados de un experimento de agentes en esta base documental. Este archivo define cómo obtenerlos sin confundir una intuición razonable con una conclusión demostrada.
