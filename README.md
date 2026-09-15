# Typers

> Typers extends TypeScript with Rust-inspired syntax and explicit error handling, compiling to JavaScript.

Typers es un fork experimental de TypeScript para explorar resultados y valores opcionales, patrones y propagación explícita de errores en proyectos TypeScript y NestJS, especialmente en zhenix-ai.

**Estado:** fase inicial. La descripción expresa la dirección del proyecto; no significa que las extensiones estén implementadas ni que exista compatibilidad universal con herramientas TypeScript. Consulta la [hoja de ruta](docs/typers/roadmap.md) y el [registro de implementación](docs/typers/status.md).

## Documentación

- [Índice y guía de lectura](docs/typers/README.md).
- [Visión y alcance](docs/typers/vision.md).
- [Funcionalidades y complejidad](docs/typers/features.md).
- [Diseño del lenguaje](docs/typers/language.md).
- [Arquitectura](docs/typers/architecture.md) y [compatibilidad](docs/typers/compatibility.md).
- [Hoja de ruta](docs/typers/roadmap.md), [validación](docs/typers/validation.md) y [decisiones](docs/typers/decisions/README.md).
- [Desarrollo y mantenimiento](docs/typers/maintenance.md).

## Base y organización

| Elemento | Ubicación / valor |
| --- | --- |
| Repositorio | [rhuffus/Typers](https://github.com/rhuffus/Typers) |
| Rama principal | `typers-main` |
| Base inicial | TypeScript `v7.0.2` — `1e4744d68260a7cb91b62b12edc3f6a2187faaf1` |
| Compilador nativo Go | [`tsc/`](tsc/) |
| Infraestructura heredada del compilador JS | `src/`, `tests/` y scripts de raíz |

Todavía no hay una versión pública de Typers. El primer hito crea un paquete local y comprueba un consumidor NestJS, distinguiendo compatibilidad del ejecutable y compatibilidad de la API del compilador.

## Contribución y licencia

Lee [AGENTS.md](AGENTS.md) y la [guía de mantenimiento](docs/typers/maintenance.md). Las contribuciones a Typers se dirigen a este fork.

Basado en TypeScript de Microsoft, bajo [Apache-2.0](LICENSE.txt). Se conservan los avisos de terceros y la [documentación original](docs/typers/upstream/README.original.md). Typers es un proyecto independiente.
