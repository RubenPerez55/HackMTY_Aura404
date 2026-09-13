// Cliente REST + SSE del BFF (mcp-agent/src/backend). Reemplaza los datos
// estáticos de mockData.js por llamadas reales al backend -- ver
// docs/03-arquitectura-tecnica/04-a2ui-generado-por-el-agente.md.
const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:4000").replace(/\/$/, "");

async function jsonOrThrow(res) {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.error || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body;
}

/** GET /api/data/users -- los 4 usuarios mock con su contexto bancario. */
export async function listUsers() {
  const res = await fetch(`${API_BASE}/api/data/users`);
  const body = await jsonOrThrow(res);
  return body.users;
}

/** GET /api/data/users/:usuario/transactions -- movimientos recientes reales. */
export async function listTransactions(usuario, limit = 5) {
  const res = await fetch(
    `${API_BASE}/api/data/users/${encodeURIComponent(usuario)}/transactions?limit=${limit}`,
  );
  const body = await jsonOrThrow(res);
  return body.transactions;
}

/**
 * GET /api/sessions?userId=... -- todas las sesiones activas de un
 * usuario (incluye las que el motor de detección real disparó por su
 * cuenta vía POST /api/triggers/impact).
 */
export async function listSessions(userId) {
  const res = await fetch(`${API_BASE}/api/sessions?userId=${encodeURIComponent(userId)}`);
  return jsonOrThrow(res);
}

/** POST /api/sessions -- abre una conversación nueva para un usuario. */
export async function createSession(userId, title) {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, title }),
  });
  return jsonOrThrow(res);
}

/** DELETE /api/sessions/:id -- cierra la conversación (limpieza tras el ciclo). */
export async function deleteSession(sessionId) {
  await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

/** POST /api/sessions/:id/messages -- continúa la conversación (turno N). */
export async function sendMessage(sessionId, text) {
  const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return jsonOrThrow(res);
}

/**
 * POST /api/triggers/impact -- simula al motor de detección de impacto
 * (todavía no existe ese motor real / server "impact"). Arranca sesión +
 * turno 1 en un solo paso.
 */
export async function triggerImpact({ userId, sessionId, event, message }) {
  const res = await fetch(`${API_BASE}/api/triggers/impact`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, sessionId, event, message }),
  });
  return jsonOrThrow(res);
}

/**
 * Se suscribe a GET /api/sessions/:id/events (SSE) y despacha cada evento
 * de turno a los handlers correspondientes. Regresa una función `close()`
 * para cancelar la suscripción (cerrar el EventSource).
 */
export function subscribeToSession(sessionId, handlers = {}) {
  const es = new EventSource(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/events`);

  const bind = (type, handler) => {
    if (!handler) return;
    es.addEventListener(type, (evt) => {
      try {
        handler(JSON.parse(evt.data));
      } catch {
        // evento malformado: lo ignoramos en vez de tronar la suscripción.
      }
    });
  };

  bind("turn.start", handlers.onTurnStart);
  bind("turn.end", handlers.onTurnEnd);
  bind("turn.error", handlers.onTurnError);
  bind("tool.use", handlers.onToolUse);
  bind("tool.result", handlers.onToolResult);

  es.onerror = (evt) => handlers.onConnectionError?.(evt);

  return () => es.close();
}

/**
 * POST /api/data/reset -- restablece los archivos CSV de datos al estado base
 * de git y purga la caché de memoria del backend.
 */
export async function resetData() {
  const res = await fetch(`${API_BASE}/api/data/reset`, {
    method: "POST",
  });
  return jsonOrThrow(res);
}
