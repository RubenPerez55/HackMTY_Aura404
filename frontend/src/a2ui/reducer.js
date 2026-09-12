// Runtime A2UI mínimo: interpreta los 3 mensajes que puede mandar el
// LLM (ver mcp-agent/src/agent/a2ui-contract.ts) y mantiene el estado de
// las "surfaces" activas.
//
// A propósito NO implementa el 100% de la spec de A2UI (funciones de
// renderer, catálogo Basic de Google, etc.) -- pero SÍ soporta un árbol
// real de componentes: createSurface + updateComponents (varios
// componentes, no solo la raíz) + updateDataModel (con paths anidados,
// no solo "/"). Eso es justo lo que necesita una pantalla COMPUESTA
// (ver resolveSurface más abajo): un nodo raíz `surface_root` con
// `children` listando, en orden, los componentes reales a mostrar.

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
            components: {
              [root.id]: { id: root.id, component: root.component, children: root.children },
            },
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

/** Aplica una lista de mensajes A2UI en orden (como llegan de un turno). */
export function applyA2uiMessages(state, messages) {
  return messages.reduce(applyA2uiMessage, state);
}

/**
 * Escribe `value` en `obj` en la ruta JSON Pointer `path` (RFC 6901,
 * subconjunto). `path === "/"` reemplaza el objeto completo (modo "un
 * solo componente"); `path === "/<id>"` escribe solo esa clave, dejando
 * las demás intactas (modo "pantalla compuesta", una clave por hijo).
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
 * Resuelve una surface a lo que el frontend necesita para pintarla.
 *
 * Dos formas, según si la raíz tiene `children`:
 *  - Pantalla COMPUESTA (`root.children` no vacío): regresa `children`,
 *    la lista ordenada de componentes reales ya resueltos (`id`,
 *    `component`, `data`) -- ver ComposedScreen.jsx, que los monta uno
 *    tras otro.
 *  - Un solo componente (compatibilidad hacia atrás, sin `children`):
 *    regresa `component`/`data` igual que el diseño original -- ver
 *    A2uiSurfaceView.jsx.
 *
 * Regresa `null` si la surface no existe.
 */
export function resolveSurface(state, surfaceId) {
  const surface = state.surfaces[surfaceId];
  if (!surface) return null;
  const root = surface.components[surface.rootId];
  if (!root) return null;

  if (root.children && root.children.length > 0) {
    const children = root.children
      .map((childId) => {
        const child = surface.components[childId];
        if (!child) return null; // updateComponents no llegó (todavía) para este id.
        return {
          id: childId,
          component: child.component,
          catalogId: child.catalogId,
          data: surface.dataModel[childId],
        };
      })
      .filter(Boolean);
    return { surfaceId, component: root.component, catalogId: root.catalogId, children };
  }

  return {
    surfaceId,
    component: root.component,
    catalogId: root.catalogId,
    data: surface.dataModel,
    children: null,
  };
}

/** Todas las surfaces activas, ya resueltas (útil para pintar una lista). */
export function listSurfaces(state) {
  return Object.keys(state.surfaces)
    .map((id) => resolveSurface(state, id))
    .filter(Boolean);
}
