# 3. Las piezas dentro de un Server MCP

Un Server MCP puede exponer hasta cuatro tipos de "primitivas". No todos
los servers implementan las cuatro — depende de qué necesite el caso de
uso.

## Del lado del Server (lo que expone)

### Tools (herramientas)
Funciones que el **modelo/agente decide invocar** (model-controlled). Cada
tool se describe con:
- `name`
- `description` (esto es lo que el LLM lee para decidir *cuándo* usarla —
  hay que escribirla pensando en el modelo, no en el humano)
- `inputSchema` (JSON Schema: qué parámetros recibe)

Ejemplo pensando en Banorte: `get_account_balance(account_id)`,
`simulate_loan(amount, term_months)`, `flag_suspicious_transaction(tx_id)`.

Las tools son las que típicamente **producen efectos** o hacen cómputo, y
son las que más nos interesan para el hackatón porque su resultado es lo
que el frontend va a tener que "renderizar" dinámicamente.

### Resources (recursos)
Datos de contexto que la aplicación (no necesariamente el modelo) puede
leer — son **application-controlled**. Se identifican con un URI
(`banorte://accounts/123/statements/2026-08`). Pueden ser estáticos o con
plantillas (resource templates). Piensa en ellos como "archivos o
registros" que el Host decide cuándo cargar como contexto.

### Prompts (plantillas de prompt)
Flujos o prompts reutilizables y parametrizables que expone el server,
pensados para que el **usuario** los invoque explícitamente (ej. un
"slash command"). Son **user-controlled**. Ejemplo: `/analizar-riesgo
cliente_id`.

## Del lado del Client/Host (lo que el server le puede pedir de vuelta)

### Sampling
Un Server puede pedirle al Client que corra una generación del LLM
("sampling") y le regrese el resultado. Esto permite que un server tenga
comportamiento "agéntico" propio sin necesitar su propia API key de LLM —
usa el modelo del Host. Es una pieza avanzada, poco común en demos de
hackatón pero vale la pena conocerla.

### Roots
Le dicen al Server cuáles son los límites/alcance donde puede operar (ej.
"solo puedes trabajar dentro de esta carpeta" o, en nuestro caso, "solo
puedes operar sobre las cuentas del usuario autenticado"). Es un mecanismo
de scoping/seguridad.

### Elicitation
Permite que un Server, a mitad de una operación, le pida al usuario (via
el Host) un dato adicional que le falta, de forma estructurada — sin tener
que romper el flujo. Útil en banca para, por ejemplo, pedir una
confirmación o un segundo factor a mitad de una tool call.

## Tabla resumen

| Primitiva   | ¿Quién la controla?     | ¿Qué es                              | Ejemplo Banorte                          |
|-------------|--------------------------|---------------------------------------|-------------------------------------------|
| Tool        | Modelo (LLM decide)      | Función invocable con efectos/cómputo | `simulate_loan(amount, term)`             |
| Resource    | Aplicación (Host)        | Dato/contexto direccionable por URI   | `banorte://accounts/123/movements`        |
| Prompt      | Usuario                  | Plantilla de flujo reutilizable       | `/revisar-portafolio cliente_id`          |
| Sampling    | Server (pide al Client)  | El server pide al LLM del Host generar algo | Un server que redacta un resumen        |
| Roots       | Host (configura límites) | Alcance/scoping del server            | Solo cuentas del usuario autenticado       |
| Elicitation | Server (pide al usuario) | Solicitud de dato faltante a mitad de flujo | Pedir confirmación de una transferencia |

Para el hackatón, lo más probable es que el 90% del proyecto gire
alrededor de **Tools** (el agente decide qué acción tomar) y, en menor
medida, **Resources** (contexto que se le da al agente). Sampling,
Roots y Elicitation son "avanzados" — buenos para mencionar que los
conocemos, pero no bloqueantes para un MVP.
