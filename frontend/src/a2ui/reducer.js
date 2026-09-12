// Runtime A2UI mínimo: interpreta los 3 mensajes que produce
// `render_component` en el backend (ver mcp-agent/src/mcp-servers/
// ui-server.ts) y mantiene el estado de las "surfaces" activas.
//
// A propósito NO implementa el 100% de la spec de A2UI (JSON Pointer
// completo, funciones de renderer, catálogo Basic de Google, etc.) --
// para el hackatón basta con lo que su propio server realmente emite:
// createSurface + updateComponents (un solo componente raíz) +
// updateDataModel (siempre con path "/", reemplazo completo). Si más
// adelante el server manda paths anidados, `setAtPointer` ya los soporta.

/** Estado inicial: sin surfaces activas. */
export function createInitialState() {
  return { surfaces: {} };
}

/** Aplica UN mensaje A2UI sobre el estado y regresa el nuevo estado (inmutable). */
export function applyA2uiMessage(state, message) {
  switch (message.type) {
    case "createSurface": {
      const { surfaceId, root } = message;
      return {
        ...state,
        surfaces: {
          ...state.surfaces,
          [surfaceId]: {
            surfaceId,
            rootId: root.id,
            components: { [root.id]: { id: root.id, component: root.component } },
            dataModel: {},
          },
        },
      };
    }

    case "updateComponents": {
      const surface = state.surfaces[message.surfaceId];
      if (!surface) return state; // mensaje fuera de orden: se ignora, no se rompe.
      const components = { ...surface.components };
      for (const component of message.components) {
        components[component.id] = component;
      }
      return {
        ...state,
        surfaces: { ...state.surfaces, [message.surfaceId]: { ...surface, components } },
      };
    }

    case "updateDataModel": {
      const surface = state.surfaces[message.surfaceId];
      if (!surface) return state;
      const dataModel = setAtPointer(surface.dataModel, message.path, message.value);
      return {
        ...state,
        surfaces: { ...state.surfaces, [message.surfaceId]: { ...surface, dataModel } },
      };
    }

    case "deleteSurface": {
      const { [message.surfaceId]: _removed, ...rest } = state.surfaces;
      return { ...state, surfaces: rest };
    }

    default:
      // callRendererFunction / agentFunctionResponse: fuera de alcance
      // para el hackatón (ver docs/03-arquitectura-tecnica). Se ignoran
      // en vez de tronar, para no romper la demo si el backend manda algo
      // que todavía no soportamos.
      return state;
  }
}

/** Aplica una lista de mensajes A2UI en orden (como llegan del tool.result). */
export function applyA2uiMessages(state, messages) {
  return messages.reduce(applyA2uiMessage, state);
}

/**
 * Escribe `value` en `obj` en la ruta JSON Pointer `path` (RFC 6901,
 * subconjunto). `path === "/"` reemplaza el objeto completo.
 */
export function setAtPointer(obj, path, value) {
  if (path === "/" || path === "") return value;

  const segments = path.split("/").filter(Boolean);
  const root = { ...obj };
  let cursor = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    cursor[key] = { ...(cursor[key] ?? {}) };
    cursor = cursor[key];
  }
  cursor[segments[segments.length - 1]] = value;
  return root;
}

/**
 * Resuelve una surface a lo que el component registry necesita:
 * qué componente montar (`component`/`catalogId`) y con qué datos
 * (`dataModel`). Devuelve `null` si la surface no existe.
 */
export function resolveSurface(state, surfaceId) {
  const surface = state.surfaces[surfaceId];
  if (!surface) return null;
  const root = surface.components[surface.rootId];
  if (!root) return null;
  return {
    surfaceId,
    component: root.component,
    catalogId: root.catalogId,
    data: surface.dataModel,
  };
}

/** Todas las surfaces activas, ya resueltas (útil para pintar una lista). */
export function listSurfaces(state) {
  return Object.keys(state.surfaces)
    .map((id) => resolveSurface(state, id))
    .filter(Boolean);
}
