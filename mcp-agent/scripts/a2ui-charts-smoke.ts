import assert from "node:assert/strict";
import { ComponentDataSchemas, parseA2uiAnswer } from "../src/agent/a2ui-contract.js";
// @ts-ignore Frontend fixtures are plain JavaScript.
import { SAMPLE_CHART_MESSAGES } from "../../frontend/src/a2ui/sampleMessages.js";
assert.equal(parseA2uiAnswer(JSON.stringify(SAMPLE_CHART_MESSAGES)).ok, true);
const series = { title: "Saldo", labels: ["Enero", "Febrero"], series: [{ label: "Real", values: [-100, null] }] };
for (const name of ["line_chart", "bar_chart"] as const) {
  assert.equal(ComponentDataSchemas[name].safeParse(series).success, true);
  assert.equal(ComponentDataSchemas[name].safeParse({ ...series, labels: ["Enero"] }).success, false);
  assert.equal(ComponentDataSchemas[name].safeParse({ ...series, series: [{ label: "Real", values: [Infinity, 1] }] }).success, false);
  assert.equal(ComponentDataSchemas[name].safeParse({ ...series, labels: [], series: [{ label: "Vacía", values: [] }] }).success, true);
}
assert.equal(ComponentDataSchemas.donut_chart.safeParse({ title: "Cero", categories: [{ label: "A", amount: 0 }] }).success, true);
assert.equal(ComponentDataSchemas.donut_chart.safeParse({ title: "Negativo", categories: [{ label: "A", amount: -1 }] }).success, false);
assert.equal(ComponentDataSchemas.data_table.safeParse({ title: "Legacy", columns: [{ key: "a", label: "A" }], rows: [{ a: "$100" }] }).success, true);
const invalid = structuredClone(SAMPLE_CHART_MESSAGES);
invalid.find((m: any) => m.path === "/distribution").value.categories[0].amount = -1;
assert.equal(parseA2uiAnswer(JSON.stringify(invalid)).ok, false);
console.log("A2UI charts: contratos, compatibilidad y pantalla compuesta correctos.");
