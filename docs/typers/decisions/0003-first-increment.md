# 0003 — Orden del primer incremento

Estado: **aceptado como orden de trabajo**; semántica detallada pendiente de implementación y validación. Fecha: 2026-09-15.

## Contexto

Se busca una primera prueba en NestJS que muestre funcionamiento real, sustitución posible y extensiones pequeñas. El propietario pidió documentar primero, hacer commit/push/merge y continuar con el orden recomendado.

## Decisión

1. Documentación de base, organización, decisiones y hoja de ruta, revisada e integrada antes del código nuevo.
2. Empaquetado y baseline: construir el core nativo, instalar paquete local y medir compilación y API por separado.
3. Runtime `Result<T,E>`, `Option<T>`, `Ok`, `Err`, `Some` y `None`.
4. Primera sintaxis propia `if let Some(binding) = expression { ... }`, inicialmente restringida.
5. Ampliar después según la [hoja de ruta](../roadmap.md) y evidencia del primer incremento.

## Rationale

Result/Option permiten probar tipos, distribución y aplicación sin introducir gramática. If-let añade una extensión real con binding dentro de un bloque y sin propagación de retornos. Let-else exige demostrar que su alternativa no continúa; `?` afecta flujo de expresiones; match completo amplía patrones y exhaustividad. No son la primera tarea elegida.

## Consecuencias

El runtime es un artefacto de ejecución separado del compilador de desarrollo. Su representación exacta, nombre npm y reconocimiento por el compilador se decidirán explícitamente. La primera demo no necesita generador de adaptadores ni infraestructura externa.

Una incompatibilidad identificada en H0 no puede esconderse en H1/H2. Se podrá experimentar con sintaxis y runtime manteniendo ese subhito abierto, pero no declarar alcanzado el objetivo de reemplazo completo.

## Aceptación

Aplicar [validación](../validation.md). Cada entrega registrará lo realizado y lo pendiente, sin publicación npm ni releases como efecto implícito de la autorización de desarrollo.
