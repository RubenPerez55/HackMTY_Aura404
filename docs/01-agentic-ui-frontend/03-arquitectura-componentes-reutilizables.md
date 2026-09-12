# 3. Arquitectura de componentes reutilizables (component registry)

Esta es la pieza central de "mi parte" del proyecto: un sistema donde,
dado el evento que llega del backend (ver `02-comunicacion-frontend-mcp.md`),
el frontend elige automáticamente qué componente reutilizable montar.

## Principio de diseño

> Cada componente de UI se registra una sola vez, declarando qué forma de
> datos espera. El "renderer" central solo hace un lookup por `uiHint` (o
> `toolName` como fallback) y delega. Ningún componente nuevo requiere
> tocar lógica de negocio ni el orquestador — solo agregarse al registro.

Esto es lo que hace que el sistema escale bien en un hackatón: cada quien
puede construir un componente nuevo (una tarjeta de simulación de crédito,
una tabla de movimientos, un gráfico) sin pisarse con el resto del equipo,
mientras respete el contrato de props.

## Piezas del sistema

1. **Contrato de evento** (ya definido en el doc anterior): `toolName`,
   `uiHint`, `data`.

2. **Component Registry**: un mapa `uiHint -> Componente`.

   ```ts
   // registry.ts
   import { LoanSimulationCard } from "./components/LoanSimulationCard";
   import { TransactionsTable } from "./components/TransactionsTable";
   import { GenericJsonView } from "./components/GenericJsonView"; // fallback

   export const componentRegistry: Record<string, React.ComponentType<any>> = {
     loan_simulation_card: LoanSimulationCard,
     transactions_table: TransactionsTable,
   };

   export function resolveComponent(uiHint?: string) {
     if (uiHint && componentRegistry[uiHint]) return componentRegistry[uiHint];
     return GenericJsonView; // nunca debe "romperse" si no reconoce el hint
   }
   ```

3. **Renderer / AgentMessage**: el componente que recibe cada evento del
   stream y decide qué montar.

   ```tsx
   function AgentToolResult({ event }: { event: ToolResultEvent }) {
     const Component = resolveComponent(event.uiHint);
     return <Component {...event.data} />;
   }
   ```

4. **Contrato de props por componente**: cada componente reutilizable debe
   validar/tipar sus props (con Zod o TypeScript types) según el
   `outputSchema` que el equipo de backend/MCP defina para esa tool. Esto
   evita que un cambio silencioso en el server rompa el frontend sin
   avisar.

5. **Fallback obligatorio**: siempre debe existir un componente genérico
   (ej. `GenericJsonView`, que solo pinta el JSON crudo o una lista
   key-value) para cualquier `uiHint`/`toolName` no reconocido. En un
   demo en vivo, esto evita pantallas rotas si el backend agrega una tool
   nueva a último momento y el frontend no le dio tiempo de construir su
   componente dedicado.

## Buenas prácticas para el hackatón específicamente

- **Diseña primero 3-5 "tipos de resultado" genéricos**, no un componente
  por tool. Ej.: `card` (una métrica destacada), `table` (datos
  tabulares), `chart` (serie de datos), `timeline` (eventos en el tiempo),
  `confirmation` (acción que requiere aprobación del usuario — muy
  relevante en banca, ej. confirmar una transferencia). La mayoría de las
  tools de Banorte probablemente van a caer en 3-4 de estos moldes.
- **Que el `uiHint` lo decida el backend/servidor MCP, no el frontend
  adivinando por el nombre de la tool.** Esto se debe acordar como
  contrato desde el día 1 con el equipo de backend.
- **Componentes controlados, sin estado global oculto**: reciben props,
  pintan, y si necesitan disparar una acción (ej. "confirmar
  transferencia"), emiten un evento hacia arriba (`onAction`) que el
  orquestador maneja — no llaman servicios directamente.
- **Streaming incremental**: si el LLM va mandando texto + eventually una
  tool_result, el UI de chat debe soportar mezclar burbujas de texto con
  componentes ricos en la misma conversación, en orden.
- **Loading / estados intermedios**: contempla un estado
  `tool_call_start` → mostrar un skeleton/loader del tipo de componente
  esperado (si ya sabemos el `uiHint` antes de tener los datos, se puede
  mostrar un esqueleto específico en vez de un spinner genérico).
