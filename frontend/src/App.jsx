import { useState } from "react";
import Modal from "./components/Modal.jsx";
import AlertBanner from "./components/AlertBanner.jsx";
import TwoFactorModal from "./components/TwoFactorModal.jsx";
import ConfirmationReceipt from "./components/ConfirmationReceipt.jsx";
import { resolveComponent } from "./components/componentRegistry.js";
import { user, pendingTriggers as initialTriggers } from "./mockData.js";

// App.jsx es el "shell" de la app bancaria (ver frontend/README.md).
// Orquesta el ciclo: banner (UI base) -> modal con componente A2UI ->
// 2FA -> confirmación -> banner retirado. Esto simula, sin backend real,
// el flujo descrito en docs/03-arquitectura-tecnica/01-arquitectura-
// referencia.md y spec.md.
export default function App() {
  const [triggers, setTriggers] = useState(initialTriggers);
  const [activeTrigger, setActiveTrigger] = useState(null);
  const [step, setStep] = useState("solution"); // solution | 2fa | receipt
  const [actionSummary, setActionSummary] = useState("");

  const closeModal = () => {
    setActiveTrigger(null);
    setStep("solution");
  };

  const handleOpen = (trigger) => {
    setActiveTrigger(trigger);
    setStep("solution");
  };

  const handleConfirmSolution = ({ actionSummary }) => {
    setActionSummary(actionSummary);
    setStep("2fa");
  };

  const handle2faSubmit = () => {
    setStep("receipt");
  };

  const handleReceiptClose = () => {
    // RF-04.2: al concluir, la alerta original se retira del dashboard.
    setTriggers((prev) => prev.filter((t) => t.id !== activeTrigger.id));
    closeModal();
  };

  const SolutionComponent = activeTrigger
    ? resolveComponent(activeTrigger.uiHint)
    : null;

  return (
    <div className="min-h-screen flex justify-center items-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col h-[750px]">
        {/* Header / saldo */}
        <header className="bg-[#EB0029] text-white px-5 pt-8 pb-6 rounded-b-3xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-80">
                Hola de nuevo
              </p>
              <h1 className="text-xl font-bold">{user.name}</h1>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center relative">
              <i className="fa-regular fa-bell text-lg" />
              {triggers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-[#EB0029] text-[10px] font-bold rounded-full flex items-center justify-center">
                  {triggers.length}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white text-gray-800 rounded-2xl p-4 shadow-sm mt-2">
            <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
              <span>{user.accountLabel}</span>
              <span>{user.accountMask}</span>
            </div>
            <p className="text-2xl font-black text-gray-900 mb-2">
              ${user.balance.toLocaleString()}{" "}
              <span className="text-xs font-normal text-gray-500">MXN</span>
            </p>
            <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-2 text-gray-500">
              <span>Saldo disponible</span>
              <span className="text-[#EB0029] font-semibold cursor-pointer">
                Ver detalle →
              </span>
            </div>
          </div>
        </header>

        {/* Operaciones rápidas */}
        <section className="px-5 py-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Operaciones rápidas
          </h2>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              ["arrow-right-arrow-left", "Transferir"],
              ["money-bill-transfer", "Pagar"],
              ["qrcode", "CoDi"],
              ["hand-holding-dollar", "Retiro"],
            ].map(([icon, label]) => (
              <button key={label} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#EB0029] flex items-center justify-center shadow-sm">
                  <i className={`fa-solid fa-${icon}`} />
                </div>
                <span className="text-xs text-gray-600 mt-2">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Zona de alertas (hiperpersonalización) + movimientos */}
        <section className="px-5 py-2 flex-1 overflow-y-auto">
          {triggers.map((trigger) => (
            <AlertBanner key={trigger.id} trigger={trigger} onOpen={handleOpen} />
          ))}

          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">
            Movimientos recientes
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                  <i className="fa-solid fa-cart-shopping text-sm" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Supermercado
                  </p>
                  <p className="text-[10px] text-gray-400">Hoy, 14:30</p>
                </div>
              </div>
              <span className="text-sm font-bold text-gray-800">-$1,240.00</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <i className="fa-solid fa-arrow-down text-sm" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Depósito SPEI
                  </p>
                  <p className="text-[10px] text-gray-400">Ayer, 09:15</p>
                </div>
              </div>
              <span className="text-sm font-bold text-green-600">+$5,000.00</span>
            </div>
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
      </div>

      <Modal open={!!activeTrigger} onClose={closeModal}>
        {activeTrigger && step === "solution" && SolutionComponent && (
          <SolutionComponent
            data={activeTrigger.data}
            onConfirm={handleConfirmSolution}
          />
        )}
        {step === "2fa" && (
          <TwoFactorModal
            actionSummary={actionSummary}
            onSubmit={handle2faSubmit}
            onCancel={closeModal}
          />
        )}
        {step === "receipt" && (
          <ConfirmationReceipt
            folio={`BN-${Math.floor(100000 + Math.random() * 900000)}`}
            actionDescription={actionSummary}
            onClose={handleReceiptClose}
          />
        )}
      </Modal>
    </div>
  );
}
