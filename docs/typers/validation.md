# Estrategia de validación

## Principio

Una prueba responde a una pregunta concreta. Compilar una aplicación no valida una API de transformación. Un alias npm no prueba identidad del compilador. Ejecutar código TS válido no demuestra soporte de sintaxis nueva. Los resultados deben indicar base upstream, versión Typers, herramientas, configuración y plataforma.

## Capas y evidencias

| Capa | Prueba positiva | Prueba negativa / límite |
| --- | --- | --- |
| CLI | `--version`, ayuda, compilación, código de salida | Error de configuración y tipos |
| TypeScript estándar | Comparación de diagnósticos y artefactos | Fixtures de ambigüedades y regresiones |
| Runtime | Variantes y composición real | Falsy, ausencia, tipos incorrectos |
| NestJS | Arranque, DI, metadata y HTTP | Error conocido y ausencia de recurso |
| API clásica | Resolver paquete y llamar funciones reales | Reportar funciones ausentes, sin mocks que oculten carencias |
| API nueva | Cliente real, AST, tipos y emisión soportada | Operaciones no soportadas explícitas |
| Librerías consumidoras | Compilar con TS estándar contra `.d.ts` emitidos | Ninguna sintaxis Typers en declaraciones públicas |
| Oxc y builders | Parsear, lint, formato y build con versiones fijadas | Sintaxis nueva rechazada cuando no hay soporte |
| Editor | Diagnósticos, renombrado, navegación | Ubicaciones y alcance correctos |

## Proyecto NestJS de aceptación

Un repositorio en memoria evita infraestructura externa. Un servicio busca un usuario mediante `Option<User>` y devuelve `Result<User, UserNotFound>`. El controlador traduce el resultado a HTTP según un contrato explícito. Probar usuario presente y ausente, DI de una clase concreta, metadata de decoradores y cierre de la aplicación después de la prueba.

Separar comandos de compilación CLI de `nest build`. El primero puede funcionar aunque el segundo requiera una API no disponible. Probar un plugin real como Swagger cuando se trabaje en la compatibilidad de transformadores. Fijar versiones en el lockfile; registrar la ruta resuelta de `typescript` y la procedencia del paquete.

## Comparación contra upstream

- Usar `typescript@7.0.2` como referencia equivalente inicial, en un entorno de pruebas separado del consumidor Typers.
- Comparar diagnósticos de programas válidos e inválidos, códigos de salida, JS y declaraciones. Normalizar únicamente diferencias justificadas, por ejemplo rutas absolutas del entorno; no borrar diagnósticos distintos.
- Cubrir `strict`, módulos ESM/CJS según soporte upstream, decoradores legacy y metadata usados por NestJS, genéricos, narrowing, imports, declaraciones y source maps.
- Una dependencia oficial en el entorno de comparación no equivale a exigirla en la aplicación consumidor; mantener clara esa separación.

## Pruebas del runtime

- Inferencia de valores y errores, narrowing de cada variante y propiedades ilegales rechazadas.
- `Some(undefined)` diferente de `None`; `0`, `false` y cadena vacía siguen presentes.
- `fromNullable` conserva valores no nulos y elimina únicamente `null | undefined`.
- ESM/CJS si se publican ambos; instalación desde tarball para detectar exports o archivos omitidos.
- La aplicación de producción no debe cargar el compilador para construir un `Ok`.

## Pruebas de sintaxis

Para if-let: `Some`, `None`, tipos correctos, operandos incorrectos, patrones no soportados, shadowing, bindings fuera de ámbito, efectos secundarios y anidamiento. El lado derecho se evalúa una vez y únicamente se ejecuta la rama correspondiente. El test debe ejecutar el JS emitido, además de comprobar el parser.

Para extensiones posteriores: reevaluación y capturas por iteración en while-let; divergencia de else en let-else; exhaustividad y guardas en match; short-circuiting, `await`, `finally`, retornos anidados y propagación de errores en `?`.

También probar errores de sintaxis y recuperación: un archivo incompleto durante la edición no debe provocar un panic ni diagnósticos incoherentes en el resto del archivo.

## Comandos y alcance

La infraestructura nativa está en `tsc/`. Con dependencias y corpus preparados, ejecutar allí:

```sh
go build -o built/local/typers ./cmd/tsgo
go test ./internal/parser ./internal/ast ./internal/checker
go test ./...
```

Son comandos de referencia del código base, no un registro de pruebas ya realizadas. Algunos tests usan el corpus fijado en `tsc/_submodules/TypeScript`; ver [mantenimiento](maintenance.md). El build de distribución debe incluir las bibliotecas estándar según su mecanismo real, que se verificará en H0. Un binario que arranca sin encontrar `lib.d.ts` no pasa aceptación.

Para cambios de código Go: ejecutar `gofmt` sobre los archivos modificados, tests enfocados y la suite nativa antes de fusionar cambios del compilador. Los linters y generadores específicos de upstream pueden requerir `npm ci` y tareas de `tsc/Herebyfile.mjs`; revisar sus entradas antes de ejecutar una regeneración general.

Los comandos de la raíz (`npx hereby runtests-parallel`, `npx hereby lint`, `npx hereby format`) pertenecen al compilador legacy. Aplican cuando se modifica ese código; no reemplazan las pruebas del compilador nativo.

Para documentación: comprobar enlaces locales nuevos y `git diff --check`. Los documentos originales archivados conservan enlaces relativos históricos y se consideran referencia inalterada.

## CI y revisión

Crear trabajos de CI específicos de Typers con versiones fijadas y permisos mínimos. La CI heredada puede apuntar a infraestructura, ramas o servicios de Microsoft y no constituye por sí sola validación nativa. No habilitar publicación automática como efecto secundario de una prueba.

Cada PR registra pruebas pasadas, fallidas y no ejecutadas, diferenciando errores nuevos de limitaciones conocidas de upstream. Un fallo esperado solo puede tratarse como resultado de una sonda cuando su contrato lo indique expresamente; no convertir silenciosamente errores generales en éxito.

Una suite externa imposible de ejecutar no permite afirmar compatibilidad completa. Registrar causa y alcance pendiente; conservar tests automatizados para reproducirlo después.

## Rendimiento y agentes

Comparar compiladores sobre el mismo proyecto y configuración: tiempo en frío/caliente, memoria y tamaño de salida. Para runtime, medir asignaciones y caminos reales antes de optimizar la representación.

Para agentes, seguir [el protocolo de evaluación](ai-development.md): tareas equivalentes, versiones y modelos fijados, repetición, corrección, tokens, latencia y número de reparaciones. No inferir eficiencia por la brevedad de un ejemplo.
