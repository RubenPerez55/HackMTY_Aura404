import type { AgentChannel } from "./channel.js";
import { StdioChannel } from "./stdio-channel.js";

/**
 * Variables de entorno que influyen en la selección del canal.
 * Futuros canales (http, ws, ...) añaden su clave aquí.
 */
export interface ChannelEnv {
  AGENT_CHANNEL?: string;
}

/**
 * Factory de canales: el resto del código solo conoce `AgentChannel`.
 * El medio físico (terminal hoy, HTTP/WebSocket mañana) queda aislado aquí.
 */
export function createChannel(env: ChannelEnv): AgentChannel {
  const kind = env.AGENT_CHANNEL?.trim().toLowerCase() || "stdio";

  switch (kind) {
    case "stdio":
      return new StdioChannel();
    default:
      throw new Error(
        `Canal desconocido: "${kind}". Opciones soportadas: stdio`,
      );
  }
}