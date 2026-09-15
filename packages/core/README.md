# @typers/core

Runtime experimental de `Result` y `Option`, escrito en TypeScript estándar. La
versión `0.1.0-alpha.0` es un prototipo local y el paquete permanece `private`;
no se ha publicado ni se presupone disponibilidad de este nombre en npm.

No tiene dependencias de ejecución. El compilador Typers se utiliza únicamente
para construir sus archivos JavaScript y declaraciones de tipos.

## API

| API | Resultado |
| --- | --- |
| `Some(value)` | `{ kind: "some", value }` |
| `None` | Valor singleton `{ kind: "none" }`; no es una función. |
| `Ok(value)` | `{ kind: "ok", value }` |
| `Err(error)` | `{ kind: "err", error }`; no lanza el error. |
| `fromNullable(value)` | `None` para `null`/`undefined`; `Some(value)` para todo lo demás. |
| `Option<T>` | Unión `Some<T> \| None`. |
| `Result<T, E>` | Unión `Ok<T> \| Err<E>`. |

`Some<T>`, `None`, `Ok<T>` y `Err<E>` también son tipos exportados. TypeScript
permite que el tipo y el valor correspondiente compartan nombre.

```ts
import { Err, Ok, fromNullable, type Result } from "@typers/core";

type User = { id: string; name: string };
type UserNotFound = { kind: "UserNotFound"; id: string };

const users = new Map<string, User>();

function findUser(id: string): Result<User, UserNotFound> {
  const candidate = fromNullable(users.get(id));

  if (candidate.kind === "some") {
    return Ok(candidate.value);
  }

  return Err({ kind: "UserNotFound", id });
}
```

## Contrato y límites

- `Some(undefined)` es presencia; es distinto de `None`. También se conservan
  `false`, `0`, `NaN`, `""` y `null` cuando se pasan directamente a `Some`.
- `fromNullable` utiliza comparación con `null` y `undefined`, nunca truthiness.
  Su tipo devuelve `Option<NonNullable<T>>`.
- Todos los campos de variantes son `readonly` en TypeScript. Los payloads no
  se clonan ni se congelan y sus referencias se conservan.
- `None` está congelado para proteger el valor compartido de ausencia. El
  singleton pertenece a cada instancia del módulo; cargar ESM, CommonJS o dos
  copias del paquete puede crear instancias distintas. Identificar variantes
  mediante `kind`, sin depender de igualdad de objetos entre módulos.
- La representación es estructural y no valida datos externos. Un cast de
  TypeScript no comprueba que una respuesta HTTP tenga la forma de un `Option`.
- Una función que devuelve `Result` puede seguir lanzando excepciones por su
  implementación o sus dependencias. Este paquete no captura throws ni rechazos.
- No hay `unwrap`, métodos de encadenamiento ni conversiones implícitas de errores.
- No se necesita sintaxis Typers para utilizar este paquete. Este incremento del
  runtime no demuestra que el compilador implemente `if let`, `match` o `?`.

## Construcción y pruebas

Requisitos del prototipo: Node.js 20 o posterior y el binario nativo de Typers
con sus bibliotecas estándar disponibles. Desde la raíz del repositorio:

```sh
npm --prefix packages/core run build
npm --prefix packages/core test
```

El script busca `tsc/built/local/typers` dentro del repositorio. Para usar otro
binario, configurar `TYPERS_BIN` con su ruta absoluta antes de ejecutar el script.
No se instala ni se carga el paquete `typescript` como parte del runtime o del build.

Las pruebas de ejecución utilizan `node:test` para ESM y CommonJS. Las pruebas de
tipos compilan consumidores `.mts` y `.cts` mediante Typers; los casos inválidos
incluyen `@ts-expect-error`, por lo que fallan si el compilador deja de rechazarlos.
Las pruebas diferenciales frente al compilador oficial pertenecen a la validación
general del proyecto y no son una dependencia de este paquete.

## Artefactos e instalación local

El build produce:

```text
dist/esm/index.js
dist/esm/index.d.ts
dist/cjs/index.js
dist/cjs/index.d.ts
dist/cjs/package.json
```

Las condiciones `import` y `require` seleccionan tanto el JavaScript como las
declaraciones apropiadas. La distribución CommonJS contiene su propio límite
de paquete para que Node interprete correctamente los archivos `.js`.

Para preparar un tarball local desde la raíz:

```sh
npm pack ./packages/core --pack-destination ./packages/core
```

`prepack` reconstruye el paquete con Typers. El tarball contiene los artefactos y
la documentación; no incorpora el compilador ni depende de archivos de su árbol
fuente. Instalarlo desde un proyecto de prueba permite validar el contrato de
distribución. El nombre del archivo esperado es
`typers-core-0.1.0-alpha.0.tgz`.
