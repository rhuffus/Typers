# Registro de decisiones (ADR)

Un ADR registra contexto, decisión, consecuencias y criterios de revisión. No convierte una propuesta en una aprobación ni un objetivo en una garantía.

| ADR | Estado | Contenido |
| --- | --- | --- |
| [0001 — Fundación](0001-project-foundation.md) | Aceptado | Fork, base, nombre, historial y emisión |
| [0002 — Compatibilidad](0002-compatibility-contract.md) | Aceptado como objetivo; diseño parcial | Contratos por capa y evidencia |
| [0003 — Primer incremento](0003-first-increment.md) | Aceptado como orden de trabajo | Paquete, runtime, if-let |
| [0004 — Runtime e if-let experimental](0004-experimental-runtime-and-if-let.md) | Aceptado para prototipo | Representación, activación y semántica limitada |
| [0005 — API nativa y emisión](0005-native-api-and-project-emission.md) | Aceptado para prototipo | Distribución de clientes sync/async y emisión de proyectos en memoria |

## Decisiones futuras previstas

- Activación de sintaxis y tratamiento de archivos.
- Contrato e identidad del runtime y representación de variantes.
- Compatibilidad con la API clásica: alcance, arquitectura y coste.
- Versionado y distribución pública.
- Patrones, exhaustividad y propagación de errores.
- Integración Oxc/editor y tratamiento de mapas de origen.

## Plantilla

```markdown
# NNNN — Título

Estado: propuesto / aceptado / sustituido
Fecha:
Sustituye / sustituido por:

## Contexto
## Decisión
## Alternativas consideradas
## Consecuencias
## Pruebas y criterios de revisión
```

Conservar registros sustituidos y enlazar la decisión nueva. Cambios editoriales no necesitan un ADR; cambios en semántica pública, compatibilidad o distribución sí.
