# 0006 — Adaptador explícito de build para NestJS

Estado: aceptado para prototipo experimental
Fecha: 2026-09-15
Complementa: [0005 — API nativa y emisión](0005-native-api-and-project-emission.md)

## Contexto

La emisión programática ya permite compilar una aplicación NestJS estándar o con
if-let mediante el núcleo nativo de Typers. El script de demostración no cubre la
configuración de Nest, selección de proyectos, assets ni limpieza de salida.

Nest CLI 12.0.1 utiliza la API clásica para cargar el tsconfig antes de seleccionar
builder. Su paquete depende de TypeScript `~6.0.2` y los builders inspeccionados
son tsc, SWC, webpack y rspack. No ofrece un punto de extensión público adecuado
para registrar este builder nativo sin modificar su implementación. Sustituir la
dependencia npm no resuelve ese contrato.

## Decisión

Crear el paquete experimental local `@typers/nest`, con el comando
`typers-nest build [project]` y la función ESM `buildNest(options)`. El adaptador
utiliza `typescript/unstable/async` y `project.typersEmitProject()`, resueltos desde
el proyecto consumidor. Comprueba que el paquete sea `@typers/compiler`; permite
seleccionar ese nombre explícitamente si se instala sin alias.

El paquete no instala el compilador por dependencia transitiva o peer, ni depende
de Nest CLI. `minimatch@10.2.6` proporciona los patrones de assets; su árbol está
fijado en los lockfiles. El runtime, el compilador y el adaptador conservan
responsabilidades y artefactos separados.

El contrato completo y los comandos están en el [README del paquete](../../../packages/nest/README.md).
La primera versión cubre un proyecto por ejecución, configuración JSON de Nest,
precedencias de tsconfig, assets, diagnósticos y `deleteOutDir`.

### Orden de efectos

1. Resolver configuración y compilador; obtener una vista nativa.
2. Obtener diagnósticos y emisión en memoria.
3. Ante errores o `emitSkipped`, devolver el informe sin alterar outputs o assets.
4. Leer los assets y validar todos los destinos y solapamientos.
5. Aplicar `deleteOutDir` únicamente al outDir del compilador, si está habilitado.
6. Escribir JS, declaraciones, mapas y assets; liberar vista y proceso.

Los errores de configuración y compilación terminan el CLI con código 1. Un
`noEmit` sin errores termina con código 0 y `emitSkipped: true`. Los informes
incluyen la identidad del compilador y los archivos escritos. La preparación en
memoria evita borrar un build válido por un error previsible; no constituye una
transacción con rollback ante fallos de IO o cambios concurrentes del filesystem.

### Límites explícitos

Se requieren salidas dentro del workspace y `outDir` explícito. Los assets
requieren `rootDir` explícito para que su ubicación sea determinista. Se rechazan
symlinks en rutas gestionadas, destinos protegidos y colisiones.

La emisión nativa amplía su resultado con `configFileNames`: configuración
seleccionada y cadena de `extends`, resueltas por el parser nativo. El adaptador
protege todas esas rutas. Esto impide que `deleteOutDir` borre una configuración
heredada alojada accidentalmente dentro de la salida. No se reimplementa la
resolución de JSONC, paquetes o herencia en JavaScript.

No se habilitan plugins, `paths` no vacío, incremental, composite, referencias
entre proyectos, watch, `--all` ni otros builders. Reescribir aliases mediante
reemplazos de texto podría romper imports, declaraciones o mapas: se necesita un
diseño de transformación nativa con sus pruebas antes de quitar ese rechazo.

`typers-nest` no registra ni reemplaza el comando `nest`. La sonda negativa de
Nest CLI sigue en el harness y H5 permanece parcial. El contrato experimental no
promete equivalencia de todas las opciones o modos de Nest CLI.

## Alternativas consideradas

| Alternativa | Evaluación |
| --- | --- |
| Implementar toda la API clásica antes del adaptador | Superficie extensa, especialmente AST, identidad y transformadores; requiere una decisión propia |
| Modificar o interceptar módulos internos de Nest CLI | Acoplamiento a detalles de versión y riesgo de cargar otro compilador; no aporta un contrato mantenible para esta entrega |
| Conservar únicamente el script de emisión de ejemplo | Útil como prueba de API, insuficiente para configuración y assets de una aplicación |
| Adaptador explícito sobre API nativa | Alcance verificable y útil ahora; requiere cambiar el comando de build y documentar opciones no soportadas |

## Verificación y criterios de revisión

- Pruebas unitarias de configuración, precedencias, globs, binarios y rutas.
- Instalar el tarball en un consumidor limpio junto al compilador Typers local;
  verificar hashes y conservar las versiones externas del lockfile.
- Comparar JS, declaraciones y mapas con el CLI en el mismo directorio de salida.
- Ejecutar DI, metadatos y HTTP 200/404 de NestJS, estándar y con if-let.
- Verificar tipos de la API pública con el compilador instalado.
- Comprobar que errores, opciones excluidas, colisiones y symlinks conservan las
  salidas previas; cubrir también `noEmit`.
- Mantener la comparación con upstream y la sonda negativa del comando original.

Revisar esta decisión cuando Nest ofrezca una extensión pública adecuada, se
defina una fachada clásica suficiente o se añadan transformadores nativos. Cada
capacidad nueva debe ampliar las pruebas y el contrato antes de aceptarse.
