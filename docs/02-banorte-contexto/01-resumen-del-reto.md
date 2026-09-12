# 1. Resumen del reto — "Interfaces que la IA construye en tiempo real"

Fuente: `Reto_UI_Generativa_Banorte_Tec.pdf` (Banorte × Tec de Monterrey).
Este documento es una transcripción/análisis estructurado del PDF para no
tener que releer el deck completo cada vez.

## El reto en una frase

> Que el modelo no solo conteste, sino que **arme la pantalla** que
> resuelve el problema financiero de quien pregunta.

No es un chatbot que responde texto: es un agente que, además, **genera la
interfaz** (componentes de UI reales, interactivos) apropiada para la
intención detectada, y esa interfaz es accionable (lo que el usuario toca
produce una acción real y regresa como contexto al agente).

## De qué se está alejando (el "antes")

| Hoy (asistente que responde)                         | Aquí (agente que construye la UI)                          |
|-------------------------------------------------------|-------------------------------------------------------------|
| Muro de texto que la persona interpreta                | La pantalla se arma según la intención detectada             |
| Misma pantalla para cualquier intención                | Componentes propios: simuladores, tablas, formularios        |
| Para actuar, la persona se va a otra app                | Lo que la persona toca en la UI regresa al modelo como contexto |

## Objetivo: una experiencia que se rediseña a sí misma

Tres pasos, en loop:

1. **Interpretar la intención** — el agente entiende qué quiere lograr la
   persona y con qué contexto llega.
2. **Generar la interfaz** — decide qué componentes mostrar y los
   transmite mediante **A2UI** o un protocolo equivalente.
3. **Ejecutar la acción** — la interacción con esa UI dispara nuevas
   acciones y vuelve a cambiar la experiencia.

> "El LLM es el centro de la experiencia, no un chat pegado a un lado."

## Dominio (territorio): libre dentro de servicios/productos financieros

El caso de uso es libre — **cada equipo elige su propio problema**, dentro
de alguna de estas áreas (no es una lista cerrada, son ejemplos):

- **Banca personal** — cuentas, movimientos, control de gasto
- **Inversiones** — perfilamiento, portafolios, simulación
- **Crédito** — precalificación, amortización, refinanciamiento
- **Pagos** — transferencias, cobros, conciliación
- **Seguros** — cotización, coberturas, siniestros
- **Educación financiera** — diagnóstico, metas, hábitos

> "Cada equipo define el problema concreto: no hay un enunciado único."

El mockup del propio deck usa como ejemplo: usuario dice *"Quiero pagar
menos intereses de mi tarjeta"* → el agente genera un componente
"Plan de pago" con 3 opciones de reestructura (12/18/24 meses, con CAT y
pago mensual) y un botón "Aplicar plan".

## Base técnica común (tres piezas no negociables)

Estas tres son obligatorias para todos los equipos; el resto del stack
(lenguaje, framework, modelo, proveedor de infraestructura) es libre:

1. **LLM al centro** — un LLM debe ser parte central de la experiencia:
   interpreta, decide y orquesta. No es un layer decorativo.
2. **MCP** — *Model Context Protocol*, para exponer al modelo los datos,
   las herramientas y las acciones que el equipo construyó. (Todo lo
   documentado en `docs/00-fundamentos-mcp/` aplica directo aquí.)
3. **A2UI** — *Agent-to-UI*, o un protocolo equivalente, para
   **representar y transmitir la interfaz que genera el agente**. Este es
   el nombre real que usa Banorte para lo que en `01-agentic-ui-frontend/`
   veníamos llamando de forma genérica "Agentic UI" / especulando como
   "MCP-UI". Hay que investigar A2UI a fondo — ver nota en
   `docs/01-agentic-ui-frontend/04-correcciones-y-notas.md`.

## Arquitectura de referencia (la que propone el propio Banorte)

```
Usuario ──▶ Agente/LLM ──▶ MCP ──▶ A2UI ──▶ Componentes
 (expresa    (interpreta    (datos,   (describe   (UI propia,
  necesidad)  intención y    tools y   la UI que   viva y
              contexto)      acciones) se renderiza) accionable)
   ▲                                                     │
   └─────────── la interacción regresa como contexto ────┘
```

> "El ciclo se cierra. No basta con generar una pantalla una vez: cada
> interacción con la UI generada debe volver al agente y producir nuevas
> acciones o una nueva interfaz."

Esto confirma lo que ya habíamos anticipado en los docs de fundamentos:
**MCP** conecta al agente con datos/herramientas; la generación visual es
una capa aparte (aquí, formalizada como **A2UI**) que va *después* de MCP
en el flujo, no es parte de MCP.

## Reglas: qué debe construir cada equipo

1. **Sus propios componentes** — no se entrega biblioteca de UI. El
   sistema de componentes que el agente invoca lo diseña y programa cada
   equipo. (Esto es exactamente el "component registry" que ya
   planteamos en `01-agentic-ui-frontend/03-arquitectura-componentes-reutilizables.md`.)
2. **Sus propios datos y APIs** — los datos/servicios se crean o integran
   por el equipo: sintéticos, simulados o de fuentes públicas. (No hay
   datos reales de Banorte.)
3. **Al menos un flujo accionable** — un flujo donde la persona interactúe
   con la UI generada y esa interacción produzca un cambio real (no solo
   una demo visual estática).
4. **Libertad de stack** — cualquier lenguaje, framework, modelo o
   proveedor de infraestructura adicional está permitido.

## Cómo se evalúa

| Criterio                                  | Peso |
|--------------------------------------------|------|
| Cumplimiento y utilidad para el usuario     | 25%  |
| Calidad y adaptabilidad de la UI generada   | 20%  |
| Calidad de la solución de IA                | 15%  |
| Arquitectura e ingeniería                   | 15%  |
| UX y diseño                                 | 10%  |
| Innovación                                  | 10%  |
| Presentación                                | 5%   |

Agrupado como lo resume el propio deck:
- **45%** = resolver algo útil + qué tan buena/adaptable es la UI generada
  (utilidad 25% + calidad/adaptabilidad de UI 20%).
- **30%** = la ingeniería: uso del LLM, del contexto, de MCP y de A2UI
  (calidad de la solución de IA 15% + arquitectura e ingeniería 15%).
- **20%** = UX/diseño (10%) + innovación (10%).
- **5%** = la presentación — "la demo importa, pero no salva una solución
  incompleta."

**Lectura para nuestro equipo:** el frontend/Agentic UI que estoy liderando
pesa fuerte en dos rubros directos (Calidad y adaptabilidad de la UI 20%,
UX y diseño 10% = 30% del total) y de forma indirecta en "Cumplimiento y
utilidad" (25%) porque la utilidad se demuestra a través de la interfaz.
No es un tema secundario del proyecto — es de los rubros con más peso.

## Entregables

1. **Demo** (corrida en vivo) — el flujo completo: intención → UI
   generada → interacción → la acción que dispara.
2. **Código** (repositorio) — componentes, servidor MCP y capa A2UI, con
   instrucciones para correrlo.
3. **Datos** (APIs y datasets) — los servicios creados por el equipo,
   aunque los datos sean sintéticos.
4. **Técnico** (decisiones) — diagrama de arquitectura y los trade-offs:
   modelo, protocolo, infraestructura.

> Consejo textual del deck: **"elijan un problema pequeño y resuélvanlo
> completo."** Un solo flujo financiero, con una UI que de verdad cambia y
> una acción que de verdad ocurre, vale más que cinco pantallas a medias.

## Lo que el deck deja abierto (por eso las preguntas a Banorte)

El deck es intencionalmente abierto en el "qué" (problema, usuario final,
tipo de estímulo) y estricto en el "cómo" (LLM + MCP + A2UI, ciclo
cerrado, componentes propios). Ver
`docs/02-banorte-contexto/02-preguntas-para-banorte.md` para las dudas
concretas que quedan antes de poder arrancar a diseñar.
