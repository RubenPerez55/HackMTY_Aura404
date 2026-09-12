/**
 * Parser CSV minimalista compatible con RFC 4180 (campos entre comillas,
 * comillas escapadas `""`). Suficiente para las 3 tablas compartidas y
 * para los textos/libre que el motor pueda insertar con comas.
 *
 * Devuelve las filas como arreglo de arreglos (cada celda sin trim).
 */
export function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    switch (ch) {
      case '"':
        inQuotes = true;
        break;
      case ",":
        row.push(field);
        field = "";
        break;
      case "\n":
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        break;
      case "\r":
        // se ignora; el salto real lo entrega \n (\r\n o \r en mac).
        break;
      default:
        field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // descarta filas vacías finales.
  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === "")) {
    rows.pop();
  }
  return rows;
}

/** Convierte filas en objetos tipados usando la primera fila como cabecera. */
export function csvToObjects(raw: string): Record<string, string>[] {
  const rows = parseCsv(raw);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = (cells[i] ?? "").trim();
    });
    return record;
  });
}

/** `""` -> null; resto con trim. */
export function strOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** `""` -> null; resto a número (si no es numérico, null). */
export function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}