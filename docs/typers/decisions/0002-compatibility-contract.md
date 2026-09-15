# 0002 — Compatibilidad como contrato verificable

Estado: **aceptado como objetivo y método de evaluación**; la implementación de la API histórica sigue abierta. Fecha: 2026-09-15.

## Contexto

El propietario quiere sustituir la dependencia TypeScript por Typers sin romper bibliotecas existentes y conservar toda la API estándar. Se consideró ofrecer recorridos diferentes para AST estándar y ampliado. La inspección de la base revela que TypeScript 7.0.2 ya difiere de la API clásica usada por Nest CLI.

## Decisión

- Mantener TypeScript estándar compatible con la versión base y verificar cada capa por separado.
- Diferenciar bibliotecas que solo ejecutan JavaScript de herramientas que importan el compilador, leen AST, transforman nodos o analizan texto con parsers propios.
- Identificar versión y configuración de cada herramienta probada.
- El alias `typescript` puede resolver el nombre; no crea APIs ausentes ni garantiza peerDependencies o resolución transitiva.
- No presentar la compilación de un ejemplo NestJS como prueba de sustitución de Nest CLI.
- Un AST dual es una posibilidad de diseño, no una solución universal aprobada. Deben evaluarse rangos, comentarios, identidad, flujo, checker, printer y consumidores que leen directamente el texto.
- Mantener `.d.ts` y JavaScript consumibles desde TS estándar para las superficies públicas soportadas.

## Alternativas y consecuencias

Imitar unas pocas funciones puede permitir una demo, pero no equivale a compatibilidad completa del compilador. Empaquetar un compilador legacy puede recuperar alguna API; constituye otra arquitectura, requiere pruebas propias y no debe ocultarse bajo una afirmación de compilación nativa.

H0 medirá la brecha real. La ausencia de la API clásica permanece como limitación abierta aunque CLI y runtime funcionen. Resolverla puede necesitar una fachada sustancial, adaptaciones de consumidores o una base futura con API adecuada.

## Evidencia y revisión

Consultar [compatibilidad](../compatibility.md) para fuentes fijadas y matriz de pruebas. Revisar con cada versión upstream y con cada integración nueva. No hay una afirmación de compatibilidad universal demostrada en este ADR.
