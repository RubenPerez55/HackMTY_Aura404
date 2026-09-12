/**
 * Smoke test: valida el ciclo MCP completo (connect -> listTools -> callTool)
 * y el AgentLoop con un stub de LlmProvider.
 *
 * Ejecuta:  npm run smoke
 */
import type { LlmContentBlock, LlmMessage, LlmTool, LlmToolResultBlock, LlmToolUseBlock, LlmTurn } from "../src/llm/types.js";
import type { LlmProvider } from "../src/llm/provider.js";
import { McpClient } from "../src/mcp/client.js";
import { createTransport } from "../src/mcp/transport.js";
import { AgentHarness } from "../src/agent/harness.js";
import { AgentLoop } from "../src/agent/loop.js";

/* ------------------------------------------------------------------ */
/*  Helper: LLM stub (sin red)                                         */
/*  Turno 1 -> emite dos tool_use; turno 2 -> respuesta final que       */
/*  incluye el contenido de los tool_result recibidos (verifica la      */
/*  inyección correcta en el historial).                                */
/* ------------------------------------------------------------------ */
function createStubLLM(): LlmProvider {
  let callCount = 0;
  return {
    id: "stub",
    complete: async (history: readonly LlmMessage[]): Promise<LlmTurn> => {
      callCount += 1;

      const hasToolResult = history.some((m) =>
        m.content.some((b) => b.type === "tool_result"),
      );

      if (hasToolResult) {
        const results = history
          .flatMap((m) => m.content)
          .filter((b): b is LlmToolResultBlock => b.type === "tool_result");
        return {
          content: [
            { type: "text", text: results.map((r) => r.content).join(" | ") },
          ],
          toolUses: [],
        };
      }

      const first: LlmToolUseBlock = {
        type: "tool_use", id: "tu_1", name: "echo", input: { text: "hello MCP" },
      };
      const second: LlmToolUseBlock = {
        type: "tool_use", id: "tu_2", name: "add", input: { a: 10, b: 20 },
      };
      const content: LlmContentBlock[] = [first, second];
      return { content, toolUses: [first, second] };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Test 1: Conexión + listTools + callTool                            */
/* ------------------------------------------------------------------ */
async function testMcpClient(): Promise<void> {
  console.log("== Test 1: McpClient ==");

  const mcp = new McpClient({
    transport: createTransport({
      kind: "stdio",
      command: process.execPath,
      args: ["--import", "tsx", "examples/echo-server.ts"],
    }),
  });

  try {
    await mcp.connect();
    const server = mcp.getServerInfo();
    console.log(`  Servidor: ${server?.name} v${server?.version}`);

    const tools = await mcp.listToolsForLLM();
    console.log("  Tools encontradas:", tools.map((t) => t.name).join(", "));
    console.assert(tools.length === 2, "Debería haber 2 herramientas");

    const echo = await mcp.callTool("echo", { text: "hola" });
    console.log('  echo("hola") =>', echo.content);
    console.assert(echo.content === "hola", "Debería devolver 'hola'");

    const sum = await mcp.callTool("add", { a: 2, b: 3 });
    console.log("  add(2, 3) =>", sum.content);
    console.assert(sum.content === "5", "Debería devolver '5'");
  } finally {
    await mcp.close();
  }
  console.log("  OK\n");
}

/* ------------------------------------------------------------------ */
/*  Test 2: AgentLoop completo                                         */
/* ------------------------------------------------------------------ */
async function testAgentLoop(): Promise<void> {
  console.log("== Test 2: AgentLoop ==");

  const mcp = new McpClient({
    transport: createTransport({
      kind: "stdio",
      command: process.execPath,
      args: ["--import", "tsx", "examples/echo-server.ts"],
    }),
  });
  await mcp.connect();

  const harness = new AgentHarness({
    policy: {
      model: "stub-model",
      maxTokens: 256,
      maxIterations: 5,
      systemPrompt: "Eres un asistente de prueba.",
    },
    task: "Saluda con echo y suma 10 + 20.",
  });

  const loop = new AgentLoop({ mcpClient: mcp, harness, llm: createStubLLM() });
  const result = await loop.run();

  console.log("  Respuesta:", result.finalAnswer);
  console.log("  Iteraciones:", result.iterations);
  console.assert(result.iterations === 2, "Debería ejecutar exactamente 2 iteraciones");
  console.assert(result.finalAnswer === "hello MCP | 30", "Inyección de tool_result incorrecta");
  console.assert(!result.stoppedDueToLimit, "No debería haber agotado el límite");

  await mcp.close();
  console.log("  OK\n");
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
await testMcpClient();
await testAgentLoop();
console.log("Todos los tests pasaron.");