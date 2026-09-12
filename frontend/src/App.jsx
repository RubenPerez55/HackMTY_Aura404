import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./components/Modal.jsx";
import AlertBanner from "./components/AlertBanner.jsx";
import FormattedChatMessage from "./components/FormattedChatMessage.jsx";
import A2uiSurfaceView from "./a2ui/A2uiSurfaceView.jsx";
import { createInitialState, applyA2uiMessages, listSurfaces } from "./a2ui/reducer.js";
import {
  listUsers,
  listTransactions,
  deleteSession,
  sendMessage,
  triggerImpact,
  subscribeToSession,
  resetData,
} from "./api.js";

// App.jsx es el "shell" de la app bancaria (ver frontend/README.md).
//
// Ya NO simula nada localmente: crea sesiones reales contra el backend
// (mcp-agent/src/backend), se suscribe a su SSE (`GET /api/sessions/:id
// /events`) y deja que el AGENTE decida, turno a turno, qué componentes
// A2UI mostrar y en qué orden (ver docs/03-arquitectura-tecnica/04-a2ui-
// generado-por-el-agente.md). El front nunca asume un flujo fijo
// ("después de la tarjeta viene el 2FA") -- simplemente renderiza lo que
// el LLM haya devuelto en `ui` (una pantalla compuesta de varios
// componentes, ver ComposedScreen.jsx).
//
// La pantalla del incidente NO desaparece si el usuario pregunta algo
// por chat ("¿de dónde viene ese cobro?"): un turno de solo texto se
// agrega al historial de chat de ese banner, sin tocar `surface`.
//
// "Simular estímulo" reemplaza al motor de detección de impacto (todavía
// no existe ese servicio real / server MCP "impact"): dispara
// POST /api/triggers/impact con el mismo payload que produciría ese
// motor. Cuando exista de verdad, esto se sustituye por su webhook.
const DEMO_TRIGGERS = {
  cfe_spike: {
    label: "Recibo de CFE alto",
    scenarioBadge: "Escenario 1 · RF-01.1",
    recommendedUser: "Ruben Perez",
    bannerTitle: "Tu recibo de CFE llegó más alto de lo normal",
    bannerSubtitle: "Detectamos un sobrecosto vs. tu promedio habitual",
    severity: "high",
    buildEvent: () => ({
      tipo: "SERVICE_SPIKE",
      usuario: "Ruben Perez",
      servicio: "CFE",
      monto_actual: 2450,
      promedio_historico: 950,
      porcentaje_incremento: 158,
      motivo: "temporada de calor",
    }),
  },
  annual_fee: {
    label: "Anualidad de Tarjeta por vencer",
    scenarioBadge: "Escenario 2 · RF-01.2",
    recommendedUser: "Ruben Perez",
    bannerTitle: "Cobro de anualidad próximo a vencer",
    bannerSubtitle: "Evita el cargo de $1,500 MXN en tu tarjeta Visa Platinum",
    severity: "medium",
    buildEvent: () => ({
      tipo: "ANNUAL_FEE_IMMINENT",
      usuario: "Ruben Perez",
      tarjeta: "Visa Platinum",
      monto_anualidad: 1500,
      dias_restantes: 4,
      fecha_cobro: "2026-09-16",
      motivo: "renovación anual programada",
    }),
  },
  liquidity_shock: {
    label: "Golpe de Liquidez (Urgencia Médica)",
    scenarioBadge: "Escenario 3 · RF-01.3",
    recommendedUser: "Hector Barrera",
    bannerTitle: "Gasto extraordinario detectado",
    bannerSubtitle: "Compra de $18,500 MXN en Hospital Ángeles reduce tu liquidez",
    severity: "critical",
    buildEvent: () => ({
      tipo: "LIQUIDITY_SHOCK",
      usuario: "Hector Barrera",
      comercio: "Hospital Ángeles",
      categoria: "Salud",
      monto_compra: 18500,
      transaction_id: 101,
      motivo: "emergencia médica",
    }),
  },
};

/** Convierte el `ui` (mensajes A2UI) de UN turno en la surface a mostrar. */
function resolveTurnSurface(ui) {
  if (!ui || ui.length === 0) return null;
  const state = applyA2uiMessages(createInitialState(), ui);
  return listSurfaces(state)[0] ?? null;
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [connectionError, setConnectionError] = useState(null);

  // Una entrada por cada estímulo disparado: { id (=sessionId), userId,
  // title, subtitle, severity, status: thinking|ready|error, surface
  // (persiste aunque lleguen turnos de solo texto), chatLog (historial
  // de preguntas libres), errorMessage }.
  const [banners, setBanners] = useState([]);
  const [openBannerId, setOpenBannerId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [resettingData, setResettingData] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const unsubscribersRef = useRef({});
  // Evita solicitudes duplicadas durante el intervalo entre el clic y la
  // respuesta del backend (cuando todavía no existe un banner en `banners`).
  const triggeringKeysRef = useRef(new Set());
  const selectedUserIdRef = useRef(selectedUserId);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
    if (selectedUserId) {
      listTransactions(selectedUserId, 5)
        .then((txs) => setTransactions(txs))
        .catch((err) => console.warn("Error al cargar transacciones:", err));
    }
  }, [selectedUserId]);

  const handleSelectUser = async (newUserId) => {
    setSelectedUserId(newUserId);
    setOpenBannerId(null);
    await refreshUserData(newUserId);
  };

  const refreshUserData = async (userId = selectedUserIdRef.current) => {
    try {
      const list = await listUsers();
      setUsers(list);
      const targetUser = userId ?? list[0]?.usuario;
      if (targetUser) {
        if (targetUser !== selectedUserIdRef.current) {
          setSelectedUserId(targetUser);
        }
        const txs = await listTransactions(targetUser, 5);
        setTransactions(txs);
      }
    } catch (err) {
      console.warn("Error al refrescar datos del usuario:", err);
    }
  };

  const handleResetData = async () => {
    try {
      setResettingData(true);
      setResetSuccess(false);
      // Cerrar suscripciones SSE y limpiar banners activos
      Object.values(unsubscribersRef.current).forEach((close) => close?.());
      unsubscribersRef.current = {};
      setBanners([]);
      setOpenBannerId(null);

      const res = await resetData();
      if (res.users) {
        setUsers(res.users);
      } else {
        const list = await listUsers();
        setUsers(list);
      }
      if (selectedUserId) {
        const txs = await listTransactions(selectedUserId, 5);
        setTransactions(txs);
      }
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (err) {
      setConnectionError(`Error al reiniciar CSVs: ${err.message}`);
    } finally {
      setResettingData(false);
    }
  };

  // Carga inicial: usuarios reales del backend (capa de datos CSV).
  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then((list) => {
        if (cancelled) return;
        setUsers(list);
        setSelectedUserId((prev) => prev ?? list[0]?.usuario ?? null);
      })
      .catch((err) => {
        if (!cancelled) setConnectionError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Movimientos recientes reales del usuario seleccionado.
  useEffect(() => {
    if (!selectedUserId) return;
    let cancelled = false;
    listTransactions(selectedUserId, 5)
      .then((list) => {
        if (!cancelled) setTransactions(list);
      })
      .catch(() => {
        if (!cancelled) setTransactions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  // Cierra todas las suscripciones SSE abiertas al desmontar.
  useEffect(() => {
    return () => {
      Object.values(unsubscribersRef.current).forEach((close) => close());
    };
  }, []);

  // Cada vez que se abre un banner distinto, el panel de dudas arranca cerrado.
  useEffect(() => {
    setChatOpen(false);
    setChatDraft("");
  }, [openBannerId]);

  const patchBanner = (sessionId, patch) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === sessionId ? { ...b, ...patch } : b)),
    );
  };

  const subscribe = (sessionId, targetUserId) => {
    const close = subscribeToSession(sessionId, {
      onTurnEnd: async (data) => {
        const surface = resolveTurnSurface(data.ui);
        // Si el agente emitió un comprobante de confirmación (acción ejecutada), actualizamos saldo y movimientos
        if (
          surface?.component === "confirmation_receipt" ||
          JSON.stringify(data.ui || "").includes("confirmation_receipt")
        ) {
          await refreshUserData(targetUserId || selectedUserIdRef.current);
        }
        setBanners((prev) =>
          prev.map((b) => {
            if (b.id !== sessionId) return b;
            if (surface) {
              // Llegó pantalla nueva/actualizada: reemplaza la anterior.
              return { ...b, status: "ready", surface, errorMessage: null };
            }
            // Turno de solo texto (p. ej. el usuario preguntó algo por
            // chat): NO se pierde la pantalla que ya estaba mostrando.
            return {
              ...b,
              status: "ready",
              errorMessage: null,
              chatLog: [...b.chatLog, { role: "agent", text: data.finalAnswer || "(sin respuesta)" }],
            };
          }),
        );
      },
      onTurnError: (data) => {
        patchBanner(sessionId, { status: "error", errorMessage: data.message });
      },
    });
    unsubscribersRef.current[sessionId] = close;
  };

  const closeSubscription = (sessionId) => {
    unsubscribersRef.current[sessionId]?.();
    delete unsubscribersRef.current[sessionId];
  };

  const fireDemoTrigger = async (key) => {
    const def = DEMO_TRIGGERS[key];
    if (!def) return;
    const targetUserId = def.recommendedUser || selectedUserId;
    if (!targetUserId) return;

    // Cambiar automáticamente al usuario relevante del escenario para que la posición bancaria coincida con spec.md
    if (def.recommendedUser && selectedUserId !== def.recommendedUser) {
      setSelectedUserId(def.recommendedUser);
      await refreshUserData(def.recommendedUser);
    }

    const alreadyActive = banners.some(
      (banner) => banner.triggerKey === key && banner.userId === targetUserId
    );
    if (alreadyActive || triggeringKeysRef.current.has(key)) return;
    triggeringKeysRef.current.add(key);
    try {
      const { sessionId } = await triggerImpact({
        userId: targetUserId,
        event: def.buildEvent(),
      });
      // Refrescar de inmediato los datos del usuario para reflejar el cargo y nuevo saldo en pantalla
      await refreshUserData(targetUserId);

      setBanners((prev) => [
        ...prev,
        {
          id: sessionId,
          triggerKey: key,
          userId: targetUserId,
          title: def.bannerTitle,
          subtitle: def.bannerSubtitle,
          severity: def.severity,
          status: "thinking",
          surface: null,
          chatLog: [],
          errorMessage: null,
        },
      ]);
      subscribe(sessionId, targetUserId);
    } catch (err) {
      setConnectionError(err.message);
    } finally {
      triggeringKeysRef.current.delete(key);
    }
  };

  // Solo mostrar banners correspondientes al usuario seleccionado en pantalla
  const userBanners = useMemo(() => {
    return banners.filter((b) => b.userId === selectedUserId);
  }, [banners, selectedUserId]);

  const openBanner = openBannerId
    ? userBanners.find((b) => b.id === openBannerId) ?? null
    : null;

  const closeModal = () => {
    setOpenBannerId(null);
  };

  const finishBanner = async (sessionId, targetUserId) => {
    closeSubscription(sessionId);
    setBanners((prev) => prev.filter((b) => b.id !== sessionId));
    setOpenBannerId(null);
    await refreshUserData(targetUserId || selectedUserIdRef.current);
    deleteSession(sessionId).catch(() => {
      // limpieza best-effort: si falla, no afecta la demo.
    });
  };

  // El agente decidió qué sigue (componente o texto); nosotros solo lo
  // mostramos y, si el usuario interactúa, mandamos el siguiente turno.
  const handleSurfaceConfirm = (banner, payload) => {
    if (banner.surface?.component === "confirmation_receipt") {
      finishBanner(banner.id, banner.userId);
      return;
    }
    patchBanner(banner.id, { status: "thinking" });
    const userPrefix = banner.userId ? `Cliente: ${banner.userId}. ` : "";
    const codeSuffix = payload?.code ? ` Código de autorización: ${payload.code}.` : "";
    const actionSuffix = payload?.action ? ` Acción solicitada: ${payload.action}.` : "";
    const valuesSuffix = payload?.values && Object.keys(payload.values).length > 0
      ? ` Valores: ${JSON.stringify(payload.values)}.`
      : "";
    const text = userPrefix + (payload?.actionSummary || "Confirmo, procede con la acción sugerida.")
      + actionSuffix + valuesSuffix + codeSuffix;
    sendMessage(banner.id, text).catch((err) =>
      patchBanner(banner.id, { status: "error", errorMessage: err.message }),
    );
  };

  const handleAskQuestion = () => {
    if (!openBanner || !chatDraft.trim()) return;
    const text = chatDraft.trim();
    setBanners((prev) =>
      prev.map((b) =>
        b.id === openBanner.id
          ? { ...b, status: "thinking", chatLog: [...b.chatLog, { role: "user", text }] }
          : b,
      ),
    );
    setChatDraft("");
    sendMessage(openBanner.id, text).catch((err) =>
      patchBanner(openBanner.id, { status: "error", errorMessage: err.message }),
    );
  };

  const selectedUser = users.find((u) => u.usuario === selectedUserId);
  const firstActiveCard = selectedUser?.tarjetas_activas?.[0];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row justify-center items-center gap-6 p-4">
      {/* Demo Controller: fuera del "teléfono" -- aquí viven los botones
          que simulan al motor de detección de impacto (todavía no existe
          ese servicio real corriendo). Cuando haya más casos de uso
          definidos (anualidad, etc.), cada uno agrega su propio botón
          aquí, agrupado por cliente/escenario. */}
      <aside className="w-full max-w-xs lg:w-64 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 order-2 lg:order-1">
        <h2 className="text-sm font-bold text-gray-900 mb-1">Demo Controller</h2>
        <p className="text-xs text-gray-400 mb-3">
          Simula los estímulos que en producción mandaría el motor de
          detección real.
        </p>
        <div className="flex flex-col gap-2.5">
          {Object.entries(DEMO_TRIGGERS).map(([key, def]) => {
            const targetUser = def.recommendedUser || selectedUserId;
            const isActive = banners.some(
              (banner) => banner.triggerKey === key && banner.userId === targetUser
            );
            return (
              <button
                key={key}
                onClick={() => fireDemoTrigger(key)}
                disabled={
                  triggeringKeysRef.current.has(key) || isActive
                }
                className="text-left text-xs bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all shadow-sm group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold tracking-wider text-red-400 uppercase">
                    {def.scenarioBadge}
                  </span>
                  {isActive && (
                    <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">
                      Activo
                    </span>
                  )}
                </div>
                <p className="font-semibold text-gray-100 group-hover:text-white leading-tight">
                  {def.label}
                </p>
                {def.recommendedUser && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Usuario: <span className="text-gray-300 font-medium">{def.recommendedUser}</span>
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={handleResetData}
            disabled={resettingData}
            className="w-full text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <i
              className={`fa-solid ${
                resettingData
                  ? "fa-circle-notch fa-spin"
                  : resetSuccess
                  ? "fa-check text-green-600"
                  : "fa-rotate-left text-gray-500"
              }`}
            />
            <span>
              {resettingData
                ? "Reiniciando..."
                : resetSuccess
                ? "¡Datos reiniciados!"
                : "Reiniciar datos (Reset CSV)"}
            </span>
          </button>
          <p className="text-[10px] text-gray-400 mt-1 text-center">
            Restaura saldos y transacciones a su estado base
          </p>
        </div>
      </aside>

      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col h-[750px] order-1 lg:order-2">
        {/* Header / saldo */}
        <header className="bg-[#EB0029] text-white px-5 pt-8 pb-6 rounded-b-3xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider opacity-80">
                Hola de nuevo
              </p>
              {users.length > 1 ? (
                <select
                  value={selectedUserId ?? ""}
                  onChange={(e) => handleSelectUser(e.target.value)}
                  className="bg-transparent text-xl font-bold text-white -ml-1 outline-none cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.usuario} value={u.usuario} className="text-gray-900">
                      {u.usuario}
                    </option>
                  ))}
                </select>
              ) : (
                <h1 className="text-xl font-bold">{selectedUser?.usuario ?? "..."}</h1>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center relative">
              <i className="fa-regular fa-bell text-lg" />
              {userBanners.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-[#EB0029] text-[10px] font-bold rounded-full flex items-center justify-center">
                  {userBanners.length}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white text-gray-800 rounded-2xl p-4 shadow-sm mt-2">
            <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
              <span>Nivel {selectedUser?.nivel_fidelidad || "—"}</span>
              <span>{firstActiveCard?.numero_enmascarado || "•••• ----"}</span>
            </div>
            <p className="text-2xl font-black text-gray-900 mb-2">
              ${(selectedUser?.saldo_ahorro ?? 0).toLocaleString()}{" "}
              <span className="text-xs font-normal text-gray-500">MXN</span>
            </p>
            <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-2 text-gray-500">
              <span>{selectedUser?.puntos_fidelidad ?? 0} pts Banorte</span>
              <span className="text-[#EB0029] font-semibold cursor-pointer">
                Ver detalle →
              </span>
            </div>
          </div>
        </header>

        {connectionError && (
          <div className="mx-5 mt-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded-xl p-3">
            No se pudo conectar al backend ({connectionError}). ¿Está corriendo
            npm run serve en mcp-agent?
          </div>
        )}

        {/* Zona de alertas (hiperpersonalización) + movimientos */}
        <section className="px-5 py-2 flex-1 overflow-y-auto">
          {userBanners.map((banner) => (
            <AlertBanner
              key={banner.id}
              trigger={{
                ...banner,
                subtitle:
                  banner.status === "thinking" && !banner.surface
                    ? "Analizando con el agente..."
                    : banner.status === "error"
                    ? `No se pudo procesar: ${banner.errorMessage ?? "error desconocido"}`
                    : banner.subtitle,
              }}
              onOpen={(t) => setOpenBannerId(t.id)}
            />
          ))}

          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">
            Movimientos recientes
          </h2>
          <div className="space-y-3">
            {transactions.length === 0 && (
              <p className="text-xs text-gray-400">Sin movimientos recientes.</p>
            )}
            {transactions.map((tx) => {
              const catLower = (tx.categoria || "").toLowerCase();
              const descLower = (tx.descripcion || "").toLowerCase();
              const isCredit =
                catLower.includes("bonificaci") ||
                catLower.includes("abono") ||
                catLower.includes("adelanto") ||
                catLower.includes("depósito") ||
                catLower.includes("deposito") ||
                descLower.includes("bonificaci");

              const icon = isCredit
                ? "fa-arrow-down text-emerald-600"
                : tx.categoria === "Servicios"
                ? "fa-bolt text-yellow-600"
                : tx.categoria === "Salud"
                ? "fa-heart-pulse text-red-600"
                : tx.categoria === "Comida"
                ? "fa-utensils text-orange-500"
                : tx.categoria === "Transporte"
                ? "fa-car text-blue-500"
                : "fa-bag-shopping text-gray-500";

              const iconBg = isCredit
                ? "bg-emerald-50"
                : tx.categoria === "Servicios"
                ? "bg-yellow-50"
                : tx.categoria === "Salud"
                ? "bg-red-50"
                : tx.categoria === "Comida"
                ? "bg-orange-50"
                : tx.categoria === "Transporte"
                ? "bg-blue-50"
                : "bg-gray-100";

              return (
                <div key={tx.id_transaccion} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center`}>
                      <i className={`fa-solid ${icon} text-sm`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {tx.descripcion ? tx.descripcion.split(" - ")[0] : tx.categoria}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(tx.fecha).toLocaleDateString("es-MX")} · {tx.categoria}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${isCredit ? "text-emerald-600" : "text-gray-800"}`}>
                    {isCredit ? "+" : "-"}${Number(tx.monto ?? 0).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Nav inferior */}
        <nav className="border-t border-gray-200 bg-white px-6 py-3 flex justify-between items-center text-gray-400">
          <button className="text-[#EB0029] flex flex-col items-center gap-1">
            <i className="fa-solid fa-house" />
            <span className="text-[10px] font-semibold">Inicio</span>
          </button>
          <button className="flex flex-col items-center gap-1 hover:text-gray-600">
            <i className="fa-solid fa-credit-card" />
            <span className="text-[10px]">Tarjetas</span>
          </button>
          <button className="flex flex-col items-center gap-1 hover:text-gray-600">
            <i className="fa-solid fa-chart-pie" />
            <span className="text-[10px]">Finanzas</span>
          </button>
          <button className="flex flex-col items-center gap-1 hover:text-gray-600">
            <i className="fa-solid fa-ellipsis" />
            <span className="text-[10px]">Más</span>
          </button>
        </nav>

        <Modal open={!!openBanner} onClose={closeModal}>
        {openBanner?.status === "thinking" && !openBanner.surface && (
          <div className="text-center py-8">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#EB0029]" />
            <p className="text-sm text-gray-500 mt-3">El agente está pensando...</p>
          </div>
        )}

        {openBanner?.status === "error" && !openBanner.surface && (
          <div className="text-center py-8">
            <p className="text-sm text-red-600 font-semibold mb-1">
              El agente no pudo responder
            </p>
            <p className="text-xs text-gray-500">{openBanner.errorMessage}</p>
          </div>
        )}

        {openBanner?.surface && (
          <div>
            <A2uiSurfaceView
              surface={openBanner.surface}
              userName={openBanner.userId}
              onConfirm={(payload) => handleSurfaceConfirm(openBanner, payload)}
              onCancel={closeModal}
            />
            {openBanner.status === "thinking" && (
              <p className="text-xs text-gray-400 text-center mt-3">
                <i className="fa-solid fa-circle-notch fa-spin mr-1" />
                Actualizando...
              </p>
            )}
            {openBanner.status === "error" && (
              <p className="text-xs text-red-500 text-center mt-3">
                No se pudo procesar tu última acción: {openBanner.errorMessage}
              </p>
            )}

            {/* Chat de dudas: discreto, no tapa las gráficas/botones. */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              {!chatOpen ? (
                <button
                  onClick={() => setChatOpen(true)}
                  className="w-full text-xs text-gray-500 font-semibold py-2"
                >
                  <i className="fa-regular fa-comment-dots mr-1" />
                  ¿Tienes dudas? Pregúntale al agente
                </button>
              ) : (
                <div>
                  {openBanner.chatLog.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-2 mb-2">
                      {openBanner.chatLog.map((entry, i) => (
                        <div
                          key={i}
                          className={`text-xs rounded-xl px-3 py-2 max-w-[85%] ${
                            entry.role === "user"
                              ? "bg-gray-900 text-white ml-auto"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <FormattedChatMessage text={entry.text} isUser={entry.role === "user"} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                      placeholder="Ej. ¿de dónde viene ese cobro?"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleAskQuestion}
                      className="bg-gray-900 text-white text-sm font-semibold px-4 rounded-xl"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {openBanner?.status === "ready" && !openBanner.surface && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Respuesta del agente
            </p>
            <div className="space-y-2 mb-3">
              {openBanner.chatLog.map((entry, i) => (
                <p
                  key={i}
                  className={`text-sm rounded-xl px-3 py-2 max-w-[90%] ${
                    entry.role === "user"
                      ? "bg-gray-900 text-white ml-auto"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {entry.text}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                placeholder="Responder al agente..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
              <button
                onClick={handleAskQuestion}
                className="bg-[#EB0029] text-white text-sm font-semibold px-4 rounded-xl"
              >
                Enviar
              </button>
            </div>
          </div>
        )}
        </Modal>
      </div>
    </div>
  );
}
