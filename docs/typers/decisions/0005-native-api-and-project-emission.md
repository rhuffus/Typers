# 0005 — API nativa distribuida y emisión de proyectos

Estado: **aceptado para el prototipo experimental**. Fecha: 2026-09-15.

## Contexto

El primer incremento distribuye el CLI y confirma que Nest CLI 12.0.1 no puede usar la API raíz de TypeScript 7.0.2. El código upstream contiene una API nativa en `unstable/*`, que aún no se incluía en nuestro paquete. Permite consultar proyectos, nodos, tipos y diagnósticos. Su `Emitter` solo imprime nodos: no proporciona emisión JS/declaraciones de un programa.

Nest CLI carga su proveedor clásico de tsconfig antes del selector de builder. Además, los builders admitidos por esa versión no incluyen una extensión pública arbitraria. Añadir alias de paquete, fingir algunas funciones o cambiar únicamente ese selector no implementa la sustitución solicitada.

## Decisión

1. Distribuir las once subrutas upstream de la API nativa, construidas desde las fuentes del fork con el propio binario Typers. Conservar la entrada raíz de versión y su contrato actual.
2. Resolver por defecto el proceso desde el binario de nuestro paquete, verificando plataforma/arquitectura. Mantener el transporte vendorizado y sus avisos de licencia.
3. Añadir `project.typersEmitProject()` en clientes sync/async y el RPC homónimo en Go. Usar el programa de la vista retenida, diagnósticos nativos y `Program.Emit`.
4. Devolver archivos en memoria, sin escrituras de salida. Respetar las opciones de emisión soportadas y rechazar incremental, composite y referencias entre proyectos hasta disponer de su implementación.
5. Demostrar el uso desde el ejemplo NestJS, comparando salida completa y comportamiento de la aplicación. Mantener la incompatibilidad de `nest build` como subhito abierto.
6. No introducir un compilador legacy de fallback, un monkeypatch de Nest CLI ni una fachada parcial presentada como API clásica compatible.

## Alternativas consideradas

- **Solo distribuir las APIs upstream:** aporta inspección, pero deja pendiente una operación esencial para herramientas de build. Se añade una ampliación pequeña y explícita en el núcleo.
- **Invocar el CLI desde un wrapper:** viable para un build de disco, pero no emite la misma vista que utiliza una herramienta que ya trabaja con snapshots/archivos virtuales. Sigue siendo una opción para un futuro adaptador específico.
- **Emular la API clásica en esta entrega:** implica contratos de AST, host, resolver, checker, transformadores y compilación incremental. No se equipara ese alcance con el del nuevo emisor.
- **Modificar Nest CLI sin una integración declarada:** introduce dependencia de sus internals y oculta una adaptación específica. Se conserva como problema separado, con decisión y aceptación propias.

## Consecuencias

Los consumidores que conozcan la API nativa pueden inspeccionar y emitir con Typers instalado bajo `typescript`. Las bibliotecas que exigen la API clásica siguen necesitando trabajo. ADR 0002 permanece vigente.

La captura en memoria tiene un coste que debe medirse. Los nombres `unstable/*` indican que aún puede cambiar el contrato. El prefijo Typers de la nueva operación facilita distinguirla de futuras ampliaciones upstream.

La herramienta de generación sync usa la dependencia legacy de desarrollo para transformar código de API; no se invoca durante el empaquetado y no participa en la compilación de la aplicación. Esta distinción se registra para que ninguna prueba aparente ser más nativa de lo que es.

## Pruebas y criterios de revisión

- Consumidor instalado desde tarball, ejecutable predeterminado de ese paquete y comprobación de hashes.
- Clientes sync/async, tipos publicados, AST, diagnósticos, printer y emisión real en memoria.
- `noEmit`, `noEmitOnError`, declaraciones/mapas, errores y vistas coherentes; rechazo explícito de los modos excluidos.
- Comparación API/CLI para el ejemplo NestJS estándar y Typers; arranque, metadata, DI y HTTP.
- Suite nativa completa antes de merge, además de tests enfocados y CI del PR.

Revisar cuando upstream incorpore emisión o una API clásica, cuando se añadan builders/plugins o cuando se planteen operaciones de build incremental. El contrato detallado está en [API nativa](../native-api.md).
