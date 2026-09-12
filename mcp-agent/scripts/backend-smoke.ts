import assert from "node:assert/strict";

import { buildServer } from "../src/backend/server.js";
import type { LlmProvider } from "../src/llm/provider.js";
import type { LlmMessage } from "../src/llm/types.js";
import { textFromBlocks } from "../src/llm/types.js";

/**
 * Smoke test end-to-end del BFF orquestador con un LLM fake:
 * ejercita REST (health/sessions/messages/triggers), la cola por sesión
 * y el stream SSE, sin tocar red MCP ni LLM reales.
 *
 * Uso: npm run smoke:backend
 */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fakeLlm: LlmProvider = {
  id: "fake",
  async complete(history: readonly LlmMessage[]) {
    await delay(150);
    const lastUser =
      [...history]
        .reverse()
        .find((m) => m.role === "user" && textFromBlocks(m.content).length > 0) ?? null;
    const text = lastUser ? textFromBlocks(lastUser.content) : "(sin estimulo)";
    return { toolUses: [], content: [{ type: "text", text: `echo: ${text}` }] };
  },
};

async function main(): Promise<void> {
  const { app, deps, store } = await buildServer({
    llm: fakeLlm,
    policy: { model: "fake", maxTokens: 128, maxIterations: 3, systemPrompt: "smoke-test" },
    host: "127.0.0.1",
    port: 0,
  });
  await app.listen({ host: "127.0.0.1", port: 0 });

  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;

  const json = async <T>(res: Response): Promise<T> => (await res.json()) as T;

  try {
    // 1. health
    const health = await json<{ status: string }>(await fetch(`${base}/api/health`));
    assert.equal(health.status, "ok");

    // 1b. capa de datos compartida (4 usuarios mock)
    const dstatus = await json<{
      users: string[];
      userCount: number;
      cardCount: number;
      transactionCount: number;
    }>(await fetch(`${base}/api/data/status`));
    assert.equal(dstatus.userCount, 4, "deben existir los 4 usuarios mock");
    assert.ok(dstatus.users.includes("Hector Barrera"));
    assert.ok(dstatus.transactionCount > 0, "debe haber historial de transacciones");

    const ctxRuben = await json<{ usuario: string; nivel_fidelidad: string; tarjetas_activas: unknown[] }>(
      await fetch(`${base}/api/data/users/${encodeURIComponent("Ruben Perez")}`),
    );
    assert.equal(ctxRuben.usuario, "Ruben Perez");
    assert.equal(ctxRuben.nivel_fidelidad, "Oro");
    assert.ok(ctxRuben.tarjetas_activas.length >= 1, "Ruben tiene tarjetas activas");

    const txJavier = await json<{ transactions: Array<{ monto: number | null }>; total: number }>(
      await fetch(`${base}/api/data/users/${encodeURIComponent("Javier Ortiz")}/transactions?limit=5`),
    );
    assert.equal(txJavier.total, 5);
    assert.ok(txJavier.transactions.every((t) => typeof t.monto === "number"));

    const cardsHector = await json<{ cards: Array<{ estatus: string }> }>(
      await fetch(`${base}/api/data/users/${encodeURIComponent("Hector Barrera")}/cards?estatus=Activa`),
    );
    assert.equal(cardsHector.cards.length, 2, "Hector Barrera tiene 2 tarjetas activas");

    const missingUser = await fetch(`${base}/api/data/users/${encodeURIComponent("Fulano")}`);
    assert.equal(missingUser.status, 404);

    // 2. crear sesión
    const created = await json<{ id: string; userId: string; title: string; history: unknown[] }>(
      await fetch(`${base}/api/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "u-1", title: "demo" }),
      }),
    );
    assert.ok(created.id, "debe devolver un id de sesión");
    assert.equal(created.userId, "u-1");
    assert.deepEqual(created.history, []);
    const sessionId = created.id;

    // 3. SSE handshake (se mantiene abierta)
    const sse = await fetch(`${base}/api/sessions/${sessionId}/events`);
    assert.equal(sse.status, 200);
    const reader = sse.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.ok(first.includes("retry"), "handshake SSE esperado");
    // la cancelamos; cuando venga el turno nos suscribimos de nuevo
    await reader.cancel();

    // 4. enviar mensaje
    const accepted = await json<{ sessionId: string; queued: boolean }>(
      await fetch(`${base}/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "hola agente" }),
      }),
    );
    assert.equal(accepted.sessionId, sessionId);
    assert.equal(accepted.queued, false);

    // 5. cola por sesión: el segundo mensaje llega mientras corre el primero
    const second = await json<{ queued: boolean }>(
      await fetch(`${base}/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "segundo estimulo" }),
      }),
    );
    assert.equal(second.queued, true, "el segundo mensaje debe encolarse");

    // 6. el historial debe persistir ambos turnos
    await delay(600);
    const fresh = await json<{ turns: number; status: string; history: Array<{ role: string }> }>(
      await fetch(`${base}/api/sessions/${sessionId}`),
    );
    assert.equal(fresh.turns, 2);
    assert.equal(fresh.status, "idle");
    const roles = fresh.history.map((m) => m.role);
    assert.ok(roles.some((r) => r === "user"), "debe haber mensajes de usuario");
    assert.ok(roles.some((r) => r === "assistant"), "debe haber respuestas del asistente");

    // 7. trigger del motor de impacto (detonante)
    const trg = await json<{ sessionId: string; queued: boolean }>(
      await fetch(`${base}/api/triggers/impact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "u-2", event: { impacto: "gasto_sospechoso" } }),
      }),
    );
    assert.ok(trg.sessionId, "el trigger debe abrir una sesión nueva");

    // 8. detección de sesión inexistente
    const missing = await fetch(`${base}/api/sessions/no-existe`);
    assert.equal(missing.status, 404);

    console.log("SMOKE BACKEND OK");
    console.log("  - health                   ✔");
    console.log("  - capa de datos CSV         ✔ (4 usuarios, tarjetas, transacciones)");
    console.log("  - creación de sesión       ✔");
    console.log("  - SSE handshake            ✔");
    console.log("  - mensaje -> turno          ✔");
    console.log("  - cola por sesión           ✔");
    console.log("  - historial persistido      ✔");
    console.log("  - trigger de impacto        ✔");
  } finally {
    await deps.registry.closeAll();
    await store.flush();
    await app.close();
  }
}

main().catch((error) => {
  console.error("SMOKE BACKEND FAILED:", error);
  process.exitCode = 1;
});