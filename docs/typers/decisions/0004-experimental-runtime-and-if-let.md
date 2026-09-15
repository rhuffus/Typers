# 0004 — Contrato experimental del runtime y de if-let

Estado: **aceptado para el prototipo**, pendiente de estabilización. Fecha: 2026-09-15.

## Contexto

El primer incremento necesita concretar las cuestiones abiertas que impiden implementar una prueba real. Se elige un contrato pequeño, estructural y opt-in, preservando el TypeScript estándar y sin prometer soporte universal del AST o editor.

## Runtime

- Paquete local `@typers/core@0.1.0-alpha.0`, privado y sin publicación npm.
- Objetos discriminados por `kind`: `some`/`none`, `ok`/`err`.
- `Some<T>` y `Ok<T>` contienen `value`; `Err<E>` contiene `error`; `None` no contiene payload.
- Campos `readonly` en tipos. `None` es un valor compartido congelado dentro de cada instancia del módulo; no se exige identidad de referencia entre copias o ESM/CJS.
- `Some(undefined)` es presencia. `fromNullable` convierte exclusivamente `null` y `undefined` a `None`.
- Las excepciones de código de usuario conservan el comportamiento de JavaScript. El runtime no las captura implícitamente.
- Formatos ESM y CJS con declaraciones correspondientes, sin dependencia del compilador en producción.

## Sintaxis experimental

Opción propia `experimentalTypersSyntax: true` en `compilerOptions`. Mantener `.ts` y `.tsx` sin exigir una extensión nueva. La opción debe participar en las decisiones de parsing y caché; desactivada, la gramática estándar continúa siendo la referencia.

Forma inicial: `if let Some(nombre) = expresion { ... }`, con bloque `else` opcional. `Some` en esta posición es parte contextual del patrón, no una llamada a una función importada. No necesita una importación de `Some` cuando el valor opcional procede de otra función. En expresiones TS normales, los identificadores conservan su resolución habitual.

El operando debe ser asignable al protocolo estructural `{ readonly kind: "some"; readonly value: unknown } | { readonly kind: "none" }`. También admite bibliotecas que implementen esa forma; no se pretende identidad nominal del paquete. `unknown` debe refinarse antes; `any` conserva el escape del sistema de tipos de TS y no adquiere garantías nuevas.

Binding equivalente a `const`, dentro del bloque coincidente, sin inmutabilidad profunda. No hay patrones anidados, constructores arbitrarios, propagación de errores, espera implícita ni transformación de excepciones. `await` explícito sigue las reglas de su función.

## Representación interna del prototipo

Parser nativo con normalización a nodos AST existentes antes del binder/checker. Se comprueba el protocolo con un `satisfies` interno y se conserva el tipo del valor. Se contempla un ensanchamiento de tipos sin efecto en ejecución para admitir operandos conocidos como `None` o `Some` y poder comprobar ambas ramas sin diagnósticos espurios.

Los temporales son higiénicos respecto de los identificadores del archivo, incluidos los escritos más adelante. El lado derecho se evalúa una vez. Los nodos sintéticos no deben tomar texto del usuario como si fuera su propio nombre. Los nodos originales y diagnósticos deben conservar rangos útiles.

Esta normalización emite JavaScript directamente: no crea un archivo TS intermedio, no usa sustituciones por regex y no llama a un segundo compilador. Puede añadir variables locales; no se promete coste cero ni un formato exacto de salida.

## Límites y criterios de revisión

- El AST normalizado no conserva una clase de nodo pública if-let. Las API de editor, printer de fuentes y herramientas sensibles al AST siguen pendientes.
- Los mapas de fuente requieren pruebas, pero la primera prueba de mapa no equivale a depuración completa certificada.
- Oxlint/Oxfmt y parsers externos necesitan adaptación propia.
- La API clásica del compilador sigue siendo una tarea separada.
- El registro de estado determinará cuándo está implementado y qué pruebas han pasado; este ADR por sí solo no acredita ejecución.

Reconsiderar un nodo AST dedicado si la normalización dificulta diagnósticos, inferencia, editor o mantenimiento. El contrato experimental puede cambiar antes de una versión estable con una decisión explícita y pruebas de migración.
