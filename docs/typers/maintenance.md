# Organización, desarrollo y mantenimiento

## Procedencia del fork

- Upstream: `https://github.com/microsoft/TypeScript.git`.
- Fork: `https://github.com/rhuffus/Typers.git`.
- Base inicial: tag `v7.0.2`, commit `1e4744d68260a7cb91b62b12edc3f6a2187faaf1`.
- Rama del proyecto: `typers-main`. `main` heredada se conserva.
- Checkout inicial del propietario: `~/CodeHome/rhuffus/typers`.

El clon usa `--filter=tree:0 --single-branch --branch typers-main --no-tags`. Conserva los commits alcanzables; árboles y blobs históricos se obtienen bajo demanda. No es un clon superficial y no requiere renunciar al ancestro común con upstream. El estado inicial ocupó aproximadamente 96 MB en `.git` y 1,1 GB incluyendo todos los archivos actuales; el tamaño cambia con el trabajo y las descargas.

El filtro pertenece al clon local. GitHub conserva el fork y su historial. No confundir ahorro de historial con eliminación de las pruebas y archivos actuales. Evitar reiniciar el repositorio mediante una copia del snapshot: perdería la trazabilidad que facilita merges y auditorías.

## Mapa del repositorio

| Ruta | Responsabilidad |
| --- | --- |
| `tsc/cmd/tsgo/` | Entrada del compilador nativo |
| `tsc/internal/parser/`, `ast/`, `binder/`, `checker/` | Gramática, representación, ámbitos y tipos |
| `tsc/internal/transformers/`, `printer/` | Transformaciones y salida |
| `tsc/_packages/native-preview/` | Distribución y API JavaScript nativa heredadas |
| `tsc/Herebyfile.mjs` | Build, generación y empaquetado nativos |
| `tsc/testdata/` | Fixtures y baselines del compilador nativo |
| `src/`, `tests/`, scripts raíz | Código e infraestructura TypeScript legacy |
| `docs/typers/` | Diseño y estado propios |
| `docs/typers/upstream/` | Documentos originales de referencia |

H0 introduce `packages/compiler`, `packages/core`, `tooling/` y `examples/nestjs/`, separados del build legacy. La [guía de primeros pasos](getting-started.md) contiene los comandos efectivos. El nombre del módulo Go conserva el identificador upstream sin cambiar el destino de PRs ni la identidad del producto.

El build de `packages/compiler` también compila el cliente API desde `tsc/_packages/native-preview` con el binario nativo recién construido. Requiere las dependencias fijadas de `tsc/`, copia su transporte vendorizado y no ejecuta generadores upstream. Si se modifica la API async, mantener la contraparte sync mediante el generador upstream y revisar el diff; ese generador utiliza la API TypeScript legacy como herramienta de desarrollo, sin formar parte del consumidor distribuido. Ver [ADR 0005](decisions/0005-native-api-and-project-emission.md).

## Entorno inicial

El `go.mod` nativo exige Go 1.26 o posterior. El paquete nativo declara Node >=20.19; las herramientas concretas pueden elevar requisitos. Entorno observado al iniciar el trabajo: macOS arm64, Go 1.27.1, Node 24.20.0 y npm 11.19.0. Son datos de la máquina, no una matriz de plataformas soportadas.

No instalar dependencias de raíz suponiendo que construyen TS7. Trabajar desde `tsc/` para Go y desde el paquete específico para runtime o pruebas consumidoras. Fijar las dependencias nuevas y conservar sus lockfiles, aunque el `.gitignore` heredado ignore `package-lock.json` genéricamente.

## Corpus y submódulo

El árbol nativo contiene un gitlink `tsc/_submodules/TypeScript` fijado en `4d4f005c8541e0255a9d8791205fdce326e462bc`. Su `.gitmodules` heredado está dentro de `tsc/`, con una ruta relativa al antiguo repositorio separado. Por ello no se debe suponer que `git submodule update --init --recursive` desde la raíz resuelve esta disposición importada.

Antes de ejecutar la suite completa o regenerar código: verificar la raíz detectada por `tsc/internal/repo/paths.go`, preparar exactamente el corpus fijado y comprobar su commit. Una herramienta de preparación propia puede descargar ese snapshot explícitamente sin modificar el gitlink. No usar la última rama de TypeScript como sustituto del corpus esperado.

Un build mínimo puede no necesitar todo el corpus; verificar por separado la disponibilidad de bibliotecas estándar y los recursos embebidos. Documentar el procedimiento que efectivamente pase las pruebas, no copiar instrucciones del antiguo layout sin comprobarlas.

## Ramas y revisión

1. Partir de `typers-main` actualizada y comprobar el estado local.
2. Crear rama temática pequeña.
3. Actualizar código, tests, documentación y estado coherentemente.
4. Ejecutar validación del componente y revisar el diff completo.
5. Commit descriptivo, push al fork y PR dirigido explícitamente a `rhuffus/Typers:typers-main`.
6. Inspeccionar checks, resolver regresiones y hacer merge con autorización vigente del propietario.
7. Actualizar el checkout local de `typers-main` y verificar limpieza.

No enviar PRs a Microsoft por accidente. No usar force-push sobre ramas compartidas ni reescribir la base para simplificar una actualización. La autorización del propietario para esta fase incluye documentación, commit, push, merge y continuación con la implementación inicial; no equivale a publicar un paquete npm ni contactar terceros.

## Actualización de upstream

Por cada versión nueva: verificar etiqueta y commit oficiales, registrar cambios relevantes, integrar en una rama de actualización, resolver conflictos, ejecutar suite nativa y matriz de consumidores, revisar APIs nuevas y publicar el estado de compatibilidad de esa base. Conservar parches Typers pequeños y concentrados reduce conflictos, pero no garantiza merges automáticos.

No hace falta soportar versiones antiguas para conservar su historial. El alcance de soporte se declara por versión publicada y herramientas verificadas. No cambiar silenciosamente la base de una release existente.

## Versionado pendiente de fijar

Decidido: mostrar claramente la versión TypeScript correspondiente. Pendiente: esquema exacto para permitir varios arreglos Typers sobre la misma base.

Durante prototipos, una versión como `7.0.2-typers.0` comunica carácter preliminar y base, pero es prerelease y afecta rangos SemVer. El sufijo `+typers.1` es metadato de build: no ofrece por sí solo un orden de actualización SemVer. Una versión independiente con campo `upstreamVersion` también es posible. Registrar el esquema definitivo en un ADR antes de publicar.

La versión del runtime puede evolucionar independientemente; si el compilador reconoce su representación, necesitarán un protocolo o rango de compatibilidad explícito. No asumir que cualquier versión de Option es intercambiable.

## Licencia, distribución y procedencia

Conservar `LICENSE.txt`, licencias nativas y avisos de terceros pertinentes en distribuciones. Mantener identificadores de origen y separar la marca Typers de Microsoft. Un fork público no implica que el nombre npm esté disponible ni concede automáticamente control sobre un scope.

Preparar artefactos locales antes de decidir distribución: paquete del compilador y binarios por plataforma o estrategia equivalente, runtime pequeño, checks de contenido del tarball, instrucciones reproducibles y versión base. No descargar ni ejecutar binarios no verificados como sustituto silencioso del build propio.
