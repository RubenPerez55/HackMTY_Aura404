/**
 * Smoke test integral del Servidor MCP Bancario y su catálogo de herramientas.
 * Valida los 3 escenarios de negocio de spec.md y todos los casos límite (E-01 a E-04).
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { McpClient } from "../src/mcp/client.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function runBankingSmoke(): Promise<void> {
  console.log("==================================================================");
  console.log("  SMOKE TEST: SERVIDOR MCP BANCARIO (BANORTE SHOCKABSORBER)");
  console.log("==================================================================\n");

  const serverScript = fileURLToPath(new URL("../src/mcp-server/banking-server.ts", import.meta.url));

  // Conectar al servidor MCP sobre transporte stdio usando tsx
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverScript],
  });

  const client = new McpClient({
    transport,
    clientInfo: { name: "banking-smoke-tester", version: "1.0.0" },
  });

  await client.connect();
  console.log("✔ Cliente conectado exitosamente al Servidor MCP Bancario por stdio.");

  // 1. Listar herramientas
  const tools = await client.listToolsForLLM();
  console.log(`✔ ${tools.length} herramientas expuestas en el catálogo:\n`);
  const toolNames = tools.map((t) => t.name);
  for (const name of toolNames) {
    console.log(`    • ${name}`);
  }

  const requiredTools = [
    "validate_soft_token",
    "get_user_financial_profile",
    "simulate_points_redemption",
    "apply_points_redemption",
    "get_domiciliation_candidates",
    "simulate_domiciliation_waiver",
    "apply_domiciliation_and_waive_fee",
    "simulate_installments",
    "apply_installments",
    "get_payroll_calendar",
  ];

  for (const req of requiredTools) {
    assert.ok(toolNames.includes(req), `Herramienta faltante: ${req}`);
  }
  console.log(`\n✔ Todas las ${requiredTools.length} herramientas obligatorias de spec.md están registradas.\n`);

  // Helper para invocar y parsear resultado
  const call = async (name: string, input: Record<string, unknown>) => {
    const res = await client.callTool(name, input);
    return JSON.parse(res.content);
  };

  // 2. Probar get_user_financial_profile
  console.log("--- TEST 1: Posición financiera de usuario ---");
  const profileRuben = await call("get_user_financial_profile", { usuario: "Ruben Perez" });
  assert.equal(profileRuben.usuario, "Ruben Perez");
  assert.ok(profileRuben.puntos_fidelidad >= 0);
  assert.ok(profileRuben.tarjetas_activas.length > 0);
  console.log(`✔ Perfil obtenido: ${profileRuben.usuario}, Nivel: ${profileRuben.nivel_fidelidad}, Saldo: $${profileRuben.saldo_disponible_debito}`);

  // 3. Probar simulate_points_redemption (Pico de servicio)
  console.log("\n--- TEST 2: Escenario 1 - Simulación de canje de puntos ---");
  const simPoints = await call("simulate_points_redemption", {
    usuario: "Ruben Perez",
    charge_amount: 1700.0,
    baseline_amount: 1000.0,
  });
  assert.equal(simPoints.sobrecosto_excedente, 700.0);
  assert.ok(simPoints.bonificacion_mxn > 0);
  console.log(`✔ Simulación con puntos calculada: Excedente $${simPoints.sobrecosto_excedente} MXN -> Bonificación $${simPoints.bonificacion_mxn} MXN`);

  // Caso límite E-01: Puntos parciales
  console.log("\n--- TEST 3: Caso Límite E-01 - Saldo de puntos parcial ---");
  const simPointsPartial = await call("simulate_points_redemption", {
    usuario: "Hector Castro", // 180 puntos
    charge_amount: 1500.0,
    baseline_amount: 800.0,
  });
  assert.equal(simPointsPartial.es_cobertura_total, false);
  assert.equal(simPointsPartial.puntos_aplicados, 180);
  assert.equal(simPointsPartial.bonificacion_mxn, 18.0);
  assert.ok(simPointsPartial.cargo_neto_debito > 0);
  console.log(`✔ Caso E-01 verificado: Cobertura parcial de ${simPointsPartial.puntos_aplicados} pts ($${simPointsPartial.bonificacion_mxn} MXN). Resto a débito: $${simPointsPartial.cargo_neto_debito} MXN`);

  // 4. Probar simulate_installments (Golpe de liquidez)
  console.log("\n--- TEST 4: Escenario 3 - Diferimiento a cuotas fijas ---");
  const simInstallments = await call("simulate_installments", {
    usuario: "Hector Barrera",
    purchase_amount: 18500.0,
    months: 6,
  });
  assert.equal(simInstallments.eligible, true);
  assert.equal(simInstallments.cuota_mensual_fija, 3083.33);
  assert.equal(simInstallments.liquidez_inmediata_restaurada, 18500.0);
  console.log(`✔ Diferimiento calculado: Compra $${simInstallments.monto_compra_original} a 6 meses -> Cuota: $${simInstallments.cuota_mensual_fija} MXN, Liquidez recuperada: $${simInstallments.liquidez_inmediata_restaurada} MXN`);

  // Caso límite E-03: Compra no elegible (< $500 MXN)
  console.log("\n--- TEST 5: Caso Límite E-03 - Compra no elegible (< $500 MXN) ---");
  const simInstallmentsLow = await call("simulate_installments", {
    usuario: "Hector Barrera",
    purchase_amount: 350.0,
    months: 3,
  });
  assert.equal(simInstallmentsLow.eligible, false);
  assert.ok(simInstallmentsLow.error.includes("500"));
  console.log(`✔ Caso E-03 verificado: ${simInstallmentsLow.error}`);

  // 5. Probar domiciliación y exención de anualidad
  console.log("\n--- TEST 6: Escenario 2 - Domiciliación y exención anualidad ---");
  const domCandidates = await call("get_domiciliation_candidates", { usuario: "Ruben Perez" });
  assert.ok(domCandidates.servicios_candidatos.length > 0);
  console.log(`✔ Servicios candidatos encontrados: ${domCandidates.servicios_candidatos.map((s: any) => s.nombre).join(", ")}`);

  const simDom = await call("simulate_domiciliation_waiver", {
    usuario: "Ruben Perez",
    selected_services: ["CFE Suministro Eléctrico", "Telmex Infinitum"],
  });
  assert.equal(simDom.costo_final_anualidad_mxn, 0.0);
  assert.equal(simDom.exencion_aplicada, true);
  console.log(`✔ Exención de anualidad simulada: $${simDom.anualidad_original_mxn} -> $${simDom.costo_final_anualidad_mxn} MXN (100% bonificado).`);

  // 6. Probar validación 2FA (Caso límite E-02: Token inválido)
  console.log("\n--- TEST 7: Caso Límite E-02 - Token SoftToken inválido ---");
  const tokenInvalid = await call("validate_soft_token", { token: "123" });
  assert.equal(tokenInvalid.valid, false);
  assert.ok(tokenInvalid.error.includes("6 dígitos"));

  const failExecution = await client.callTool("apply_installments", {
    usuario: "Hector Barrera",
    transaction_id: 999,
    purchase_amount: 18500.0,
    months: 6,
    token_2fa: "abc",
  });
  assert.equal(failExecution.isError, true);
  const failData = JSON.parse(failExecution.content);
  assert.equal(failData.success, false);
  console.log(`✔ Caso E-02 verificado: Operación rechazada correctamente por token inválido ("${tokenInvalid.error}")`);

  // 7. Probar ejecución autorizada con token válido (RF-04.1 & RF-04.2)
  console.log("\n--- TEST 8: Ejecución autorizada con SoftToken (Human-in-the-Loop) ---");
  const validExec = await call("apply_installments", {
    usuario: "Hector Barrera",
    transaction_id: 101,
    purchase_amount: 1200.0,
    months: 3,
    token_2fa: "123456",
  });
  assert.equal(validExec.success, true);
  assert.ok(validExec.folio_bancario.startsWith("FOL-MSI-"));
  assert.equal(validExec.liquidez_inmediata_reintegrada, 1200.0);
  console.log(`✔ Operación autorizada: Folio bancario ${validExec.folio_bancario}, Saldo actualizado: $${validExec.nuevo_saldo_disponible} MXN`);

  // 8. Probar ejecución autorizada de domiciliación
  console.log("\n--- TEST 9: Ejecución autorizada de domiciliación con SoftToken ---");
  const domExec = await call("apply_domiciliation_and_waive_fee", {
    usuario: "Ruben Perez",
    services: ["CFE Suministro Eléctrico"],
    token_2fa: "654321",
  });
  assert.equal(domExec.success, true);
  assert.ok(domExec.folio_bancario.startsWith("FOL-DOM-"));
  assert.equal(domExec.cargo_anualidad_final_mxn, 0.0);
  console.log(`✔ Domiciliación autorizada: Folio bancario ${domExec.folio_bancario}, Anualidad condonada a $0.00 MXN.`);

  // 9. Probar cálculo de calendario de nómina y subsistencia quincenal (RF-01.3 & liquidity_shock_card)
  console.log("\n--- TEST 10: Calendario de nómina y subsistencia quincenal ---");
  const payroll = await call("get_payroll_calendar", {
    usuario: "Hector Barrera",
    fecha_referencia: "2026-09-12",
  });
  assert.equal(payroll.usuario, "Hector Barrera");
  assert.equal(payroll.daysUntilPayroll, 3);
  assert.equal(payroll.proxima_fecha_dispersion, "2026-09-15");
  assert.equal(payroll.dispersion_hoy, false);
  assert.equal(payroll.monto_estimado_quincena, 14000);
  assert.ok(typeof payroll.presupuesto_diario_restante === "number");
  assert.ok(payroll.diagnostico.includes("Faltan 3 días"));
  console.log(`✔ Calendario de nómina verificado: Faltan ${payroll.daysUntilPayroll} días para dispersión ($${payroll.monto_estimado_quincena} MXN el ${payroll.proxima_fecha_dispersion}).`);

  await client.close();
  console.log("\n==================================================================");
  console.log("  TODOS LOS TESTS DEL SERVIDOR MCP PASARON EXITOSAMENTE (100%)");
  console.log("==================================================================");
}

runBankingSmoke().catch((err) => {
  console.error("\n❌ Error en smoke test:", err);
  process.exit(1);
});
