import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/** Configuración de un transporte según el destino del servidor MCP. */
export type McpTransportConfig =
  | {
      kind: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
    }
  | {
      kind: "sse";
      url: string;
      token?: string;
    }
  | {
      kind: "streamable-http";
      url: string;
      token?: string;
    };

/** Variables de entorno que influyen en el transporte. */
export interface TransportEnv {
  MCP_TRANSPORT?: string;
  MCP_SERVER_URL?: string;
  MCP_TOKEN?: string;
  MCP_SERVER_COMMAND?: string;
  MCP_SERVER_ARGS?: string;
  MCP_SERVER_ENV?: string;
  MCP_SERVER_CWD?: string;
}

/**
 * Construye la instancia de transporte del SDK según la configuración.
 * El transporte se pasa a `McpClient`, que es agnóstico al medio.
 */
export function createTransport(config: McpTransportConfig): Transport {
  switch (config.kind) {
    case "stdio":
      return new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        env: config.env,
        cwd: config.cwd,
      });

    case "sse":
      return new SSEClientTransport(new URL(config.url), authHeaders(config.token));

    case "streamable-http":
      return new StreamableHTTPClientTransport(
        new URL(config.url),
        authHeaders(config.token),
      );
  }
}

/**
 * Deriva la configuración de transporte desde el entorno y una URL
 * opcional pasada como argumento (el transporte HTTP remoto se
 * auto-detecta por la URL).
 */
export function resolveTransportFromEnv(
  env: TransportEnv,
  positionalUrl?: string,
): McpTransportConfig {
  const url = positionalUrl?.trim() || env.MCP_SERVER_URL?.trim();

  if (url && /^https?:\/\//i.test(url)) {
    const kind =
      env.MCP_TRANSPORT === "sse" ||
      url.endsWith("/sse") ||
      env.MCP_TRANSPORT === "http-sse"
        ? "sse"
        : "streamable-http";
    return { kind, url, token: env.MCP_TOKEN || undefined };
  }

  return {
    kind: "stdio",
    command: env.MCP_SERVER_COMMAND ?? "node",
    args: env.MCP_SERVER_ARGS ? parseJsonOrWhitespaceArgs(env.MCP_SERVER_ARGS) : undefined,
    env: env.MCP_SERVER_ENV ? parseJsonEnv(env.MCP_SERVER_ENV) : undefined,
    cwd: env.MCP_SERVER_CWD || undefined,
  };
}

function authHeaders(token?: string):
  | { requestInit: { headers: Record<string, string> }; eventSourceInit: { fetch: typeof fetch } }
  | undefined {
  if (!token) return undefined;
  // `eventsource` v3 no permite headers en EventSourceInit; los inyectamos
  // mediante un `fetch` que añade Authorization a la conexión SSE.
  const headers = { Authorization: `Bearer ${token}` };
  return {
    requestInit: { headers },
    eventSourceInit: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: { ...(init?.headers as Record<string, string> | undefined), ...headers },
        }),
    },
  };
}

/** Acepta JSON (`["a","b"]`) o un string separado por espacios. */
export function parseJsonOrWhitespaceArgs(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(/\s+/).filter(Boolean);
  }
}

function parseJsonEnv(raw: string): Record<string, string> | undefined {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : undefined;
  } catch {
    return undefined;
  }
}