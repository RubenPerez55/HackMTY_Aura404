import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { RouteDeps } from "./types.js";

const STATUSES = new Set(["Activa", "Vencida", "Cancelada"]);
const MAX_LIMIT = 200;

/**
 * Rutas de la capa de datos compartida (CSV) para exposiciones REST de solo
 * lectura. El frontend y el orquestador consultan aquí los 4 usuarios mock.
 */
export function registerDataRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { data } = deps;

  // GET /api/data/users → listado con contexto bancario completo
  app.get("/api/data/users", async (_request: FastifyRequest, reply: FastifyReply) => {
    const users = data.listNames().map((name) => data.getUserContext(name)!);
    return reply.send({ users, source: data.dirPath });
  });

  // GET /api/data/users/:usuario → perfil + tarjetas + transacciones
  app.get("/api/data/users/:usuario", async (request: FastifyRequest, reply: FastifyReply) => {
    const { usuario } = request.params as { usuario: string };
    const context = data.getUserContext(usuario);
    if (!context) return reply.code(404).send({ error: `Usuario "${usuario}" no existe.` });
    return reply.send(context);
  });

  // GET /api/data/users/:usuario/cards → tarjetas del usuario (filtro ?estatus=)
  app.get("/api/data/users/:usuario/cards", async (request: FastifyRequest, reply: FastifyReply) => {
    const { usuario } = request.params as { usuario: string };
    if (!data.getUser(usuario)) return reply.code(404).send({ error: `Usuario "${usuario}" no existe.` });

    const { estatus } = request.query as { estatus?: string };
    let cards = data.listCards(usuario);
    if (estatus) cards = cards.filter((c) => c.estatus === estatus);
    return reply.send({ cards });
  });

  // GET /api/data/users/:usuario/transactions → historial con filtros opcionales
  app.get(
    "/api/data/users/:usuario/transactions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { usuario } = request.params as { usuario: string };
      if (!data.getUser(usuario)) {
        return reply.code(404).send({ error: `Usuario "${usuario}" no existe.` });
      }
      const q = request.query as {
        categoria?: string;
        desde?: string;
        hasta?: string;
        limit?: string;
      };
      const limit = q.limit ? Number(q.limit) : undefined;
      const transactions = data.listTransactions({
        usuario,
        categoria: q.categoria,
        desde: q.desde,
        hasta: q.hasta,
        limit: clampLimit(limit),
      });
      return reply.send({ transactions, total: transactions.length });
    },
  );

  // GET /api/data/transactions → global (para el BFF y futuras tools del MCP)
  app.get("/api/data/transactions", async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as { categoria?: string; desde?: string; hasta?: string; limit?: string };
    const limit = q.limit ? Number(q.limit) : undefined;
    const transactions = data.listTransactions({
      categoria: q.categoria,
      desde: q.desde,
      hasta: q.hasta,
      limit: clampLimit(limit),
    });
    return reply.send({ transactions, total: transactions.length });
  });

  // GET /api/data/status → utilidad para saber qué hay cargado (diagnóstico)
  app.get("/api/data/status", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      source: data.dirPath,
      users: data.listNames(),
      userCount: data.listUsers().length,
      cardCount: data.listCards().length,
      transactionCount: data.listTransactions().length,
      cardStatus: [...STATUSES],
    });
  });
}

function clampLimit(limit: number | undefined): number | undefined {
  if (limit === undefined || Number.isNaN(limit)) return undefined;
  return Math.max(1, Math.min(limit, MAX_LIMIT));
}