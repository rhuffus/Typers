# 0001 — Fundación y procedencia del proyecto

Estado: **aceptado**. Fecha: 2026-09-15.

## Contexto

zhenix-ai usará TypeScript y NestJS, con desarrollo asistido por agentes. Se quieren incorporar conceptos de Rust sin abandonar JavaScript y su ecosistema. Se discutieron biblioteca, transpilador a TypeScript y fork con emisión directa de JavaScript.

## Decisión

- Proyecto **Typers**, repositorio `rhuffus/Typers`.
- Fork de TypeScript `v7.0.2`, commit `1e4744d68260a7cb91b62b12edc3f6a2187faaf1`.
- Integrar extensiones en el compilador; salida final JS sin exigir un archivo TS intermedio ni ejecutar un segundo compilador TS como etapa obligatoria.
- Mantener historia upstream y la rama `main`; desarrollo en `typers-main`.
- Usar clon parcial para reducir descargas históricas. El filtro efectivo es `tree:0`; no se borra el código actual ni se usa un historial superficial.
- Mantener procedencia, licencias y correspondencia de versiones con TypeScript.

## Alternativas consideradas

Una biblioteca normal es suficiente para Result/Option y será parte del proyecto, pero no introduce gramática propia. Transpilar a TS permitiría reutilizar herramientas con otro coste de mapas de origen y pipeline; no es el camino elegido. Copiar un snapshot a un repositorio vacío reduciría historia a costa de trazabilidad y de la base común para merges. Un fork no obliga a dar soporte a versiones históricas.

## Consecuencias

El core elegido es nativo Go en `tsc/`. El compilador JS heredado en raíz no se convierte en TS7 por cambiar `package.json`. Las nuevas construcciones requieren entender parser, tipos, flujo y emisión, además de herramientas externas. Las actualizaciones upstream necesitan mantenimiento y validación continuos.

## Revisión

Reconsiderar arquitectura si la evidencia de compatibilidad o mantenimiento hace inviable el objetivo. Cualquier cambio de base o pipeline debe registrarse expresamente, conservando la trazabilidad de lo anterior.
