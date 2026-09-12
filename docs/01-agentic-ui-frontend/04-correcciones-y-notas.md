# 4. Correcciones y notas importantes (léelo antes del evento)

Notas puntuales sobre cosas que valía la pena aclarar del planteamiento
inicial, para tenerlas a la mano.

## 1. "El componente lo elige el MCP" → no exactamente

En el mensaje inicial se planteaba que el frontend se comunica con "las
otras partes del MCP" y que, dependiendo del evento, el agente "elige" el
componente. Hay que separar dos cosas que se estaban mezclando:

- **MCP** = el protocolo entre el orquestador/Host y los Servers (tools,
  resources, prompts). Ahí no hay ningún concepto de "componente visual".
- **La elección de componente** = una capa de aplicación que nosotros
  diseñamos (el "Agentic UI" / component registry, ver doc 03), que vive
  en el frontend (o en la frontera backend↔frontend, con el `uiHint`).

No es un error grave — es exactamente la línea de trabajo correcta — pero
conviene tener el lenguaje preciso para explicarlo en el pitch: "usamos
MCP para que el agente pueda invocar herramientas de forma estandarizada;
sobre esa base construimos una capa de Agentic UI que traduce cada
resultado de herramienta en un componente reutilizable."

## 2. El frontend probablemente no habla MCP directamente

Como se explica en el doc 02, lo normal es que MCP corra entre el
backend/orquestador y los servers, no entre el navegador y los servers.
Esto es bueno saberlo desde ya para no perder tiempo tratando de conectar
el frontend directo a un servidor MCP por stdio (eso ni siquiera es
posible desde un navegador) — el contrato del frontend es con el backend,
vía HTTP/SSE/WebSocket.

## 3. Falta decidir "quién define el uiHint"

Es una decisión de arquitectura, no solo de frontend: ¿el nombre del
componente a usar lo decide el LLM/orquestador (parte del prompt del
sistema le dice "cuando uses esta tool, sugiere uiHint=X"), lo hardcodea
el backend por tool, o lo infiere el frontend? Recomendación: que sea
explícito y lo mande el backend (más predecible, menos "alucinable"). Hay
que validarlo en cuanto se arme el equipo completo.

## 4. ACTUALIZACIÓN (con el reto ya en mano): el protocolo se llama A2UI

Esto ya no es especulación — **el reto de Banorte lo confirma
explícitamente**: la tercera pieza "no negociable" del stack, junto con
LLM y MCP, es **A2UI (Agent-to-UI)**, "o un protocolo equivalente, para
representar y transmitir la interfaz que genera el agente". Ver
`docs/02-banorte-contexto/01-resumen-del-reto.md`.

Es decir: la propuesta comunitaria "MCP-UI" que se mencionaba antes aquí
como opcional/avanzada resulta ser, con otro nombre (A2UI), **parte
obligatoria del reto**, no un extra. Esto cambia la prioridad de
investigación: hay que meterle tiempo real a entender A2UI (si existe una
spec formal publicada, qué forma tiene el mensaje que describe una UI,
cómo se relaciona con MCP) antes de diseñar el component registry del doc
03 — el registry probablemente sea, en la práctica, **el lado cliente que
interpreta lo que A2UI transmite**.

Queda como pregunta abierta para Banorte (ver pregunta 6 en
`docs/02-banorte-contexto/02-preguntas-para-banorte.md`) si A2UI tiene una
librería/spec concreta a seguir o si "protocolo equivalente" nos da
libertad de definir nuestro propio contrato.

## 5. Seguridad / alcance (relevante por ser banca)

Aunque el enfoque de "mi parte" es frontend, vale la pena tener presente
para la arquitectura general del reto:

- Las tools que toquen dinero real o datos sensibles deberían pasar por
  algún tipo de confirmación explícita del usuario (ver **Elicitation** en
  `00-fundamentos-mcp/03-componentes-mcp.md`, o simplemente un componente
  de tipo `confirmation` en el propio Agentic UI).
- **Roots** (el mecanismo de scoping de MCP) es un buen argumento técnico
  para el pitch: "cada agente/servidor solo puede operar sobre las cuentas
  del usuario autenticado", como mitigación de riesgo.

## 6. El contexto de Banorte ya llegó

El reto oficial ya se analizó a fondo en
`docs/02-banorte-contexto/01-resumen-del-reto.md`, y las dudas que quedan
abiertas (incluyendo varias de las que se listaban aquí) están organizadas
y priorizadas en `docs/02-banorte-contexto/02-preguntas-para-banorte.md`.
Ya sabemos, por ejemplo: los datos son sintéticos/simulados/públicos (no
hay datos reales de Banorte), el caso de uso es libre dentro de servicios
financieros, y se espera un solo flujo accionable bien resuelto en vez de
muchas pantallas a medias. Lo que sigue abierto (usuario final, tipo de
estímulo, si A2UI tiene spec formal) está en el doc de preguntas.
