# Documentación de Typers

Esta base registra la conversación de diseño y las decisiones iniciales. Permite que personas y agentes continúen con contexto suficiente, sin confundir intención, garantía y funcionalidad disponible.

## Guía de lectura

| Documento | Contenido |
| --- | --- |
| [Visión](vision.md) | Motivación, usuarios, objetivos y límites |
| [Estado](status.md) | Implementación y resultados verificados |
| [Primeros pasos](getting-started.md) | Construcción y ejecución del prototipo local |
| [Decisiones](decisions/README.md) | Acuerdos y preguntas abiertas |
| [Funcionalidades](features.md) | Catálogo, complejidad y dependencias |
| [Lenguaje](language.md) | Semántica y ejemplos |
| [Arquitectura](architecture.md) | Compilación, runtime, APIs y AST |
| [API nativa](native-api.md) | Cliente distribuido, snapshots, emisión programática y límites de Nest CLI |
| [Compatibilidad](compatibility.md) | Sustitución y herramientas por capa |
| [Adaptadores](adapters.md) | Conversión de APIs JS/TS a Result/Option |
| [Desarrollo con IA](ai-development.md) | Ergonomía y evaluación |
| [Hoja de ruta](roadmap.md) | Hitos y criterios de aceptación |
| [Validación](validation.md) | Pruebas y evidencia |
| [Mantenimiento](maintenance.md) | Build, Git, versiones y upstream |

Para implementar: leer visión, estado, ADR, hito y validación. Para diseñar sintaxis: añadir lenguaje, arquitectura y compatibilidad. Para adaptar librerías: leer adaptadores antes de inferir sus errores.

## Estados de las afirmaciones

- **Decidido:** dirección aprobada o requisito explícito.
- **Propuesto:** diseño recomendado pendiente de validación o ADR.
- **Verificado:** evidencia concreta con versión y procedimiento.
- **Pendiente:** trabajo o pregunta sin resolver.
- **Fuera del alcance inicial:** idea que no pertenece al primer incremento.

Los ejemplos de sintaxis son propuestas salvo evidencia en el registro de estado. Los nombres npm son provisionales: esta documentación no reserva nombres ni publica paquetes.

## Actualización

1. Describir el problema y el comportamiento observable.
2. Consultar ADR; crear uno si cambia una decisión estructural.
3. Precisar versiones y herramientas afectadas.
4. Añadir criterios de aceptación antes de implementar.
5. Registrar pruebas, resultados y límites en el PR.
6. Actualizar el estado conservando el contexto histórico.

Fecha del registro inicial: 15 de septiembre de 2026.
