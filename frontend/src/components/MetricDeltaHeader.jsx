// Encabezado de anomalía: valor actual vs. línea base + status de color.
// Puramente presentacional -- no tiene interacción propia.
const STATUS_STYLES = {
  critical: { bg: "bg-red-50", text: "text-[#EB0029]", ring: "ring-red-200" },
  warning: { bg: "bg-orange-50", text: "text-orange-600", ring: "ring-orange-200" },
  success: { bg: "bg-green-50", text: "text-green-600", ring: "ring-green-200" },
};

export default function MetricDeltaHeader({ data }) {
  const style = STATUS_STYLES[data.status] || STATUS_STYLES.warning;

  return (
    <div className={`rounded-2xl p-4 ring-1 ${style.bg} ${style.ring}`}>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
        {data.title}
      </p>
      <div className="flex items-end justify-between">
        <span className={`text-2xl font-black ${style.text}`}>
          ${data.currentValue.toLocaleString()}
        </span>
        {data.baselineValue != null && (
          <span className="text-xs text-gray-400">
            vs. ${data.baselineValue.toLocaleString()} habitual
          </span>
        )}
      </div>
      {data.deltaText && (
        <p className={`text-xs font-semibold mt-1 ${style.text}`}>{data.deltaText}</p>
      )}
    </div>
  );
}
