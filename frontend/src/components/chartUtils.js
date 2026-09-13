export const CHART_COLORS = ["#EB0029", "#374151", "#F59E0B", "#9CA3AF", "#FB7185", "#64748B"];
export function formatValue(value, format = "number", currency = "MXN") {
  if (value == null) return "—";
  if (format === "date") {
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("es-MX");
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return typeof value === "object" ? JSON.stringify(value) : String(value);
  if (format === "percent") return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)}%`;
  try {
    return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2, ...(format === "currency" ? { style: "currency", currency } : {}) }).format(value);
  } catch { return String(value); }
}
export function chartDomain(values) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  return [min, max === min ? min + 1 : max];
}
