// AlertBanner: NO es un componente A2UI (ver docs/03-arquitectura-tecnica/
// 02-catalogo-componentes.md). Es UI base del dashboard. Su único trabajo
// es mostrar que hay un desbalance detectado y, al tocarlo, disparar el
// arranque del ciclo agente<->UI (onOpen).
export default function AlertBanner({ trigger, onOpen }) {
  if (!trigger) return null;

  const severityStyles = {
    high: "from-red-600 to-[#EB0029]",
    medium: "from-orange-500 to-red-500",
    low: "from-gray-500 to-gray-600",
  };

  return (
    <button
      onClick={() => onOpen(trigger)}
      className={`w-full text-left bg-gradient-to-r ${
        severityStyles[trigger.severity] || severityStyles.medium
      } text-white p-4 rounded-2xl shadow-sm mb-4 active:scale-[0.99] transition`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
          ALERTA FINANCIERA
        </span>
        <i className="fa-solid fa-triangle-exclamation text-xs" />
      </div>
      <p className="text-sm font-bold mt-2">{trigger.title}</p>
      <p className="text-xs text-red-100 mt-1">{trigger.subtitle}</p>
      <p className="text-[10px] text-white/80 mt-2">
        Toca para ver soluciones →
      </p>
    </button>
  );
}
