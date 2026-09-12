/**
 * Prueba de flujo de usuario con el Agente de IA y Servidor MCP Bancario.
 *
 * Simula el flujo completo de Banorte ShockAbsorber:
 *  1. Detección del shock financiero para un cliente de los CSV (ej. Hector Barrera o Ruben Perez).
 *  2. El Agente consulta el perfil y simula el amortiguamiento mediante tools MCP.
 *  3. El Agente genera el bloque A2UI para el frontend.
 *  4. El usuario autoriza con su SoftToken 2FA de 6 dígitos.
 */
import "dotenv/config";
import { buildServer } from "../src/backend/server.js";

async function runClientFlow(): Promise<void> {
  console.log("==================================================================");
  console.log("  SIMULACIÓN DE FLUJO DE USUARIO (BANORTE SHOCKABSORBER)");
  console.log("==================================================================\n");

  const clientName = process.argv[2] || "Hector Barrera";
  console.log(`👤 Cliente seleccionado: "${clientName}"\n`);

  const { deps, store } = await buildServer();
  const { bus, manager, orchestrator, registry, data } = deps;

  // 1. Verificar datos del cliente en CSV
  const userContext = data.getUserContext(clientName);
  if (!userContext) {
    console.error(`❌ El usuario "${clientName}" no existe en usuarios_bancario.csv`);
    process.exit(1);
  }

  console.log("📊 Datos actuales en CSV:");
  console.log(`   • Ingreso mensual   : $${userContext.ingreso_mensual?.toLocaleString()} MXN`);
  console.log(`   • Saldo en cuenta   : $${userContext.saldo_ahorro?.toLocaleString()} MXN`);
  console.log(`   • Deuda total       : $${userContext.deuda_total?.toLocaleString()} MXN`);
  console.log(`   • Puntos fidelidad  : ${userContext.puntos_fidelidad} (${userContext.nivel_fidelidad})`);
  console.log(`   • Tarjetas activas  : ${userContext.tarjetas_activas.length}\n`);

  // 2. Crear sesión
  const session = manager.create(clientName);
  console.log(`🆔 Sesión creada: ${session.id}\n`);

  // 3. Escuchar eventos del bus (SSE simulation)
  const turnPromise = new Promise<void>((resolve, reject) => {
    bus.subscribe(session.id, (event) => {
      if (event.type === "turn.start") {
        console.log(`\n💬 [Turno ${event.turn}] Usuario: "${event.text}"`);
      } else if (event.type === "tool.use") {
        console.log(`\n⚙️  [MCP TOOL CALL] -> ${event.name}`);
        console.log(`   Argumentos:`, JSON.stringify(event.input, null, 2));
      } else if (event.type === "tool.result") {
        console.log(`✅ [MCP TOOL RESULT] <- ${event.name} (ok: ${event.ok})`);
        try {
          const parsed = JSON.parse(event.content);
          console.log(`   Respuesta:`, JSON.stringify(parsed, null, 2));
        } catch {
          console.log(`   Respuesta:`, event.content);
        }
      } else if (event.type === "turn.end") {
        console.log(`\n🏁 [Turno completado en ${event.iterations} iteraciones]`);
        if (event.ui) {
          console.log(`🎨 [A2UI GENERADO PARA EL FRONTEND]:`);
          console.log(JSON.stringify(event.ui, null, 2));
        } else {
          console.log(`🤖 Respuesta Agente:\n${event.finalAnswer}`);
        }
        resolve();
      } else if (event.type === "turn.error") {
        console.error(`❌ [Error en turno]:`, event.message);
        reject(new Error(event.message));
      }
    });
  });

  // 4. Preparar estímulo según el cliente
  let stimulus = "";
  if (clientName === "Hector Barrera") {
    // Escenario 3: Golpe de liquidez (sin puntos, compra médica grande)
    stimulus =
      "Hola, soy Hector Barrera. Tuve una emergencia médica de $18,500 MXN en Hospital Ángeles que me dejó casi sin saldo disponible en mi cuenta de débito. Necesito estabilizar mi liquidez para llegar a la quincena. ¿Qué opciones de diferimiento a meses me ofrece Banorte?";
  } else if (clientName === "Ruben Perez") {
    // Escenario 1: Pico de servicio (tiene 4,350 puntos Oro)
    stimulus =
      "Hola, soy Ruben Perez. Llegó mi recibo de CFE por $1,700 MXN cuando habitualmente pago $1,000 MXN. Este sobrecosto de $700 me desbalancea el presupuesto del mes. ¿Puedo usar mis puntos de fidelidad Banorte para neutralizar el excedente?";
  } else {
    stimulus = `Hola, soy ${clientName}. ¿Cuál es mi situación financiera actual y qué me recomiendas para optimizar mis gastos?`;
  }

  // 5. Enviar mensaje al orquestador
  console.log("🚀 Enviando estímulo al Agente...");
  const queued = orchestrator.sendMessage(session.id, stimulus);
  console.log(`   Encolado: ${queued.queued}, procesando con LLM...\n`);

  // Esperar a que el turno termine
  await turnPromise;

  // 6. Turno 2: Autorización con SoftToken (Human-in-the-Loop)
  console.log("\n------------------------------------------------------------------");
  console.log("  TURNO 2: AUTORIZACIÓN HUMAN-IN-THE-LOOP (SOFTTOKEN 2FA)");
  console.log("------------------------------------------------------------------");

  let authorizationMsg = "";
  if (clientName === "Hector Barrera") {
    authorizationMsg = "Sí, autorizo diferir la compra a 6 meses. Mi SoftToken es 123456.";
  } else if (clientName === "Ruben Perez") {
    authorizationMsg = "Sí, autorizo aplicar mis puntos al cargo. Mi SoftToken es 654321.";
  } else {
    authorizationMsg = "Entendido, gracias.";
  }

  const turn2Promise = new Promise<void>((resolve, reject) => {
    bus.subscribe(session.id, (event) => {
      if (event.type === "turn.start" && event.turn === 2) {
        console.log(`\n💬 [Turno ${event.turn}] Usuario: "${event.text}"`);
      } else if (event.type === "tool.use") {
        console.log(`\n⚙️  [MCP TOOL CALL] -> ${event.name}`);
        console.log(`   Argumentos:`, JSON.stringify(event.input, null, 2));
      } else if (event.type === "tool.result") {
        console.log(`✅ [MCP TOOL RESULT] <- ${event.name} (ok: ${event.ok})`);
        try {
          const parsed = JSON.parse(event.content);
          console.log(`   Respuesta:`, JSON.stringify(parsed, null, 2));
        } catch {
          console.log(`   Respuesta:`, event.content);
        }
      } else if (event.type === "turn.end") {
        console.log(`\n🏁 [Turno 2 completado]`);
        if (event.ui) {
          console.log(`🎨 [A2UI GENERADO PARA EL FRONTEND]:`);
          console.log(JSON.stringify(event.ui, null, 2));
        } else {
          console.log(`🤖 Respuesta Agente:\n${event.finalAnswer}`);
        }
        resolve();
      } else if (event.type === "turn.error") {
        console.error(`❌ [Error en turno]:`, event.message);
        reject(new Error(event.message));
      }
    });
  });

  console.log("🚀 Enviando autorización del usuario...");
  orchestrator.sendMessage(session.id, authorizationMsg);
  await turn2Promise;

  // 7. Verificar estado final actualizado en CSV
  const finalContext = data.getUserContext(clientName);
  console.log("\n📊 Datos actualizados en CSV tras autorización:");
  console.log(`   • Saldo en cuenta   : $${finalContext?.saldo_ahorro?.toLocaleString()} MXN`);
  console.log(`   • Deuda total       : $${finalContext?.deuda_total?.toLocaleString()} MXN`);
  console.log(`   • Puntos fidelidad  : ${finalContext?.puntos_fidelidad} (${finalContext?.nivel_fidelidad})`);

  console.log("\n==================================================================");
  console.log("  FLUJO COMPLETADO");
  console.log("==================================================================");

  await deps.registry.closeAll();
  await store.flush();
  process.exit(0);
}

runClientFlow().catch((err) => {
  console.error("\n❌ Error ejecutando flujo:", err);
  process.exit(1);
});
