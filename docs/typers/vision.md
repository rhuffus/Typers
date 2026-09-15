# Visión, alcance y contexto

## Motivación

El propietario de zhenix-ai prefiere Rust por sus herramientas para representar ausencia, resultados y errores explícitamente. El backend previsto para sus proyectos es TypeScript con NestJS: se busca aprovechar un lenguaje y framework ampliamente presentes en los ejemplos y herramientas de los agentes de IA.

Esa elección convive con el deseo de recuperar `Result`, `Option`, patrones, `match`, propagación con `?`, `if let`, `while let` y `let-else`. Typers explora esos conceptos sin abandonar el ecosistema JavaScript.

El propietario prepara sus estándares con Oxlint y Oxfmt, incluyendo un build personalizado de Oxlint para un plugin NestJS. Esa integración es parte del entorno deseado, no evidencia de soporte automático de sintaxis nueva.

## Dirección decidida

- Nombre: **Typers**. Se consideró TypeRS; el repositorio fija el nombre elegido.
- Fork integrado en TypeScript con salida final JavaScript.
- Base `v7.0.2`; cada versión futura debe declarar su correspondencia con upstream.
- Objetivo: instalar Typers como sustituto del compilador TypeScript, sin exigir dos compiladores independientes al consumidor en el camino soportado.
- Conservar el comportamiento de TypeScript estándar y añadir extensiones controladas.
- Mantener historial Git para integrar upstream; conservar versiones antiguas en Git no obliga a soportarlas.
- Documentar antes de implementar y avanzar por incrementos comprobables.

Descripción elegida:

> Typers extends TypeScript with Rust-inspired syntax and explicit error handling, compiling to JavaScript.

La descripción expresa la intención. El estado efectivo lo determina el registro de implementación.

## Qué se toma de Rust

Se trasladan conceptos seleccionados, no todo Rust. TypeScript sigue siendo estructural y gradual; JavaScript conserva referencias, garbage collection, excepciones, event loop y ejecución asíncrona.

`Result` no impide que una dependencia lance. `Option` no sustituye automáticamente `null` y `undefined`. `readonly` no impone inmutabilidad profunda en ejecución. Los patrones no incorporan borrow checker ni las garantías de memoria de Rust.

## Objetivos medibles

1. Compilar y ejecutar una aplicación NestJS.
2. Mantener comportamiento y diagnósticos de TypeScript para una base y configuración fijadas.
3. Proporcionar APIs pequeñas para resultados y ausencia.
4. Validar una extensión real de parser, checker y emisor.
5. Verificar consumidores que importan la API del compilador.
6. Emitir JavaScript y `.d.ts` consumibles desde TypeScript estándar.
7. Medir productividad de agentes sin asumir mejoras por preferencia lingüística.

## Límites de producto

La compatibilidad completa es una dirección, no un estado demostrado para toda versión histórica de toda herramienta. Debe evaluarse por lenguaje, salida, resolución npm, API, editores y parsers independientes.

La popularidad no puede predecirse desde la idea. Dependerá de utilidad, coste de migración, documentación, distribución, sincronización con upstream e integración. Primero se validará en zhenix-ai; una adopción general requiere evidencia adicional.

Quedan fuera del primer incremento: ownership, borrow checker, lifetimes, macros arbitrarias, reemplazar el modelo de objetos JS, conversión infalible de excepciones y pattern matching completo de Rust.

## Preguntas abiertas

- Versionado definitivo del compilador y runtime; nombres npm y plataformas.
- Compatibilidad con APIs históricas del compilador.
- Activación y extensión de archivo de la sintaxis nueva.
- Contrato para reconocer Result/Option sin depender de nombres locales.
- Representación de variantes, serialización y patrones extensibles.
- Integración inicial del editor, Oxc y plugins NestJS.
- Mantenimiento y contratos de los adaptadores de terceros.

Estas preguntas se resuelven con pruebas y ADR.
