import { execSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { csvToObjects, objectsToCsv, numOrNull, strOrNull } from "./csv.js";
import {
  type BankingUser,
  type Card,
  type Transaction,
  type UserContext,
} from "./types.js";

/** Filtros de consulta de transacciones. */
export interface TransactionQuery {
  usuario?: string;
  categoria?: string;
  /** Fecha ISO desde (inclusive), p. ej. `2026-08-01`. */
  desde?: string;
  /** Fecha ISO hasta (inclusive). */
  hasta?: string;
  limit?: number;
}

/**
 * Capa de acceso a la base de datos compartida (3 tablas CSV).
 *
 * Es la fuente de datos del backend y quedará a disposición del servidor
 * MCP bancario externo. La carpeta se configura con `DATA_DIR` (por
 * defecto `../data`, junto al motor).
 *
 * Lectura con caché por `mtime`: si el motor inserta una transacción, el
 * siguiente acceso detecta el cambio y relee el archivo.
 * Solo lectura: las escrituras las hace el motor (`insertar_transaccion.py`).
 */
export class BankDataSource {
  private readonly dir: string;
  private readonly cache = new Map<string, { mtimeMs: number; records: Record<string, string>[] }>();

  constructor(dir?: string) {
    this.dir = dir ?? fileURLToPath(new URL("../../../data", import.meta.url));
  }

  listUsers(): BankingUser[] {
    return this.table("usuarios_bancario.csv").map(toBankingUser);
  }

  getUser(usuario: string): BankingUser | undefined {
    return this.listUsers().find(byName(usuario));
  }

  listCards(usuario?: string): Card[] {
    const cards = this.table("tarjetas.csv").map(toCard);
    return usuario ? cards.filter(byName(usuario)) : cards;
  }

  listTransactions(query: TransactionQuery = {}): Transaction[] {
    let rows = this.table("transacciones.csv")
      .map(toTransaction)
      .filter((t) => t.usuario !== null);

    if (query.usuario) rows = rows.filter((t) => byName(query.usuario!)(t));
    if (query.categoria) {
      const cat = query.categoria.trim().toLowerCase();
      rows = rows.filter((t) => (t.categoria ?? "").toLowerCase() === cat);
    }
    if (query.desde) rows = rows.filter((t) => (t.fecha ?? "") >= query.desde!);
    if (query.hasta) rows = rows.filter((t) => (t.fecha ?? "") <= query.hasta!);

    rows.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
    return query.limit && query.limit > 0 ? rows.slice(0, query.limit) : rows;
  }

  /** Contexto completo de un usuario (perfil + tarjetas), como en `banca.py`. */
  getUserContext(usuario: string): UserContext | undefined {
    const user = this.getUser(usuario);
    if (!user) return undefined;

    const tarjetas_totales = this.listCards(usuario);
    const tarjetas_activas = tarjetas_totales.filter((c) => c.estatus === "Activa");

    return {
      ...user,
      tarjetas_activas,
      tarjetas_totales,
      credito_activas: tarjetas_activas.filter((c) => c.tipo === "Credito").length,
      debito_activas: tarjetas_activas.filter((c) => c.tipo === "Debito").length,
    };
  }

  /** Nombres exactos de los usuarios disponibles (los 4 mockeados). */
  listNames(): string[] {
    return this.table("usuarios_bancario.csv")
      .map((r) => strOrNull(r.usuario ?? ""))
      .filter((n): n is string => n !== null);
  }

  /**
   * Actualiza campos financieros del usuario (saldo, puntos, deuda) en usuarios_bancario.csv.
   */
  updateUser(
    usuario: string,
    updates: Partial<{
      saldo_ahorro: number;
      puntos_fidelidad: number;
      deuda_total: number;
    }>,
  ): BankingUser | undefined {
    const filename = "usuarios_bancario.csv";
    const records = this.table(filename);
    const needle = usuario.trim().toLowerCase();
    const index = records.findIndex((r) => (r.usuario ?? "").trim().toLowerCase() === needle);
    if (index === -1) return undefined;

    const current = records[index];
    if (updates.saldo_ahorro !== undefined) {
      current.saldo_ahorro = updates.saldo_ahorro.toFixed(1);
    }
    if (updates.puntos_fidelidad !== undefined) {
      current.puntos_fidelidad = Math.round(updates.puntos_fidelidad).toString();
    }
    if (updates.deuda_total !== undefined) {
      current.deuda_total = updates.deuda_total.toFixed(1);
    }

    const file = `${this.dir}/${filename}`;
    const csvContent = objectsToCsv(records);
    writeFileSync(file, csvContent, "utf8");

    // Invalidar caché
    this.cache.delete(filename);
    return this.getUser(usuario);
  }

  /**
   * Registra una nueva transacción en transacciones.csv (append transaccional).
   */
  appendTransaction(txn: {
    usuario: string;
    categoria: string;
    monto: number;
    descripcion: string;
    fecha?: string;
  }): Transaction {
    const filename = "transacciones.csv";
    const records = this.table(filename);
    const maxId = records.reduce((max, r) => {
      const id = Number(r.id_transaccion);
      return Number.isFinite(id) && id > max ? id : max;
    }, 0);

    const newId = maxId + 1;
    const fecha = txn.fecha ?? new Date().toISOString().replace("T", " ").substring(0, 19);

    const newRecord: Record<string, string> = {
      id_transaccion: String(newId),
      usuario: txn.usuario,
      fecha,
      categoria: txn.categoria,
      monto: txn.monto.toFixed(2),
      descripcion: txn.descripcion,
    };

    records.push(newRecord);
    const file = `${this.dir}/${filename}`;
    const csvContent = objectsToCsv(records);
    writeFileSync(file, csvContent, "utf8");

    // Invalidar caché
    this.cache.delete(filename);

    return {
      id_transaccion: newId,
      usuario: txn.usuario,
      fecha,
      categoria: txn.categoria,
      monto: txn.monto,
      descripcion: txn.descripcion,
    };
  }

  /**
   * Almacén en memoria de servicios domiciliados durante la sesión.
   */
  private readonly domiciliations = new Map<string, Set<string>>();

  recordDomiciliations(usuario: string, services: string[]): string[] {
    const key = usuario.trim().toLowerCase();
    const current = this.domiciliations.get(key) ?? new Set<string>();
    for (const s of services) current.add(s);
    this.domiciliations.set(key, current);
    return [...current];
  }

  getDomiciliations(usuario: string): string[] {
    const key = usuario.trim().toLowerCase();
    return [...(this.domiciliations.get(key) ?? [])];
  }

  get dirPath(): string {
    return this.dir;
  }

  clearCache(): void {
    this.cache.clear();
    this.domiciliations.clear();
  }

  /**
   * Restablece los archivos CSV de datos al estado base de git y limpia la caché.
   */
  resetData(): void {
    try {
      const repoRoot = resolve(this.dir, "..");
      execSync("git checkout HEAD -- data/", { cwd: repoRoot, stdio: "pipe" });
    } catch (err) {
      console.warn("No se pudo restablecer data/ vía git checkout:", err);
    }
    this.clearCache();
  }

  private table(filename: string): Record<string, string>[] {
    const file = `${this.dir}/${filename}`;
    const cached = this.cache.get(filename);
    const mtimeMs = statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? -1;

    if (!cached || cached.mtimeMs !== mtimeMs) {
      const raw = readFileSync(file, "utf8");
      const records = csvToObjects(raw);
      this.cache.set(filename, { mtimeMs, records });
      return records;
    }
    return cached.records;
  }
}

function byName(usuario: string) {
  const needle = usuario.trim().toLowerCase();
  return (row: { usuario?: string | null }) =>
    (row.usuario ?? "").trim().toLowerCase() === needle;
}

function toBankingUser(r: Record<string, string>): BankingUser {
  return {
    usuario: strOrNull(r.usuario ?? "") ?? "",
    fecha_afiliacion: strOrNull(r.fecha_afiliacion ?? ""),
    ingreso_mensual: numOrNull(r.ingreso_mensual ?? ""),
    saldo_ahorro: numOrNull(r.saldo_ahorro ?? ""),
    deuda_total: numOrNull(r.deuda_total ?? ""),
    pagos_atrasados: numOrNull(r.pagos_atrasados ?? ""),
    puntos_fidelidad: numOrNull(r.puntos_fidelidad ?? ""),
    nivel_fidelidad: strOrNull(r.nivel_fidelidad ?? ""),
    score_crediticio: numOrNull(r.score_crediticio ?? ""),
    historial_crediticio: strOrNull(r.historial_crediticio ?? ""),
  };
}

function toCard(r: Record<string, string>): Card {
  return {
    id_tarjeta: strOrNull(r.id_tarjeta ?? ""),
    usuario: strOrNull(r.usuario ?? ""),
    tipo: strOrNull(r.tipo ?? ""),
    marca: strOrNull(r.marca ?? ""),
    numero_enmascarado: strOrNull(r.numero_enmascarado ?? ""),
    vencimiento: strOrNull(r.vencimiento ?? ""),
    estatus: strOrNull(r.estatus ?? ""),
    limite_credito: numOrNull(r.limite_credito ?? ""),
    saldo_utilizado: numOrNull(r.saldo_utilizado ?? ""),
  };
}

function toTransaction(r: Record<string, string>): Transaction {
  return {
    id_transaccion: numOrNull(r.id_transaccion ?? ""),
    usuario: strOrNull(r.usuario ?? ""),
    fecha: strOrNull(r.fecha ?? ""),
    categoria: strOrNull(r.categoria ?? ""),
    monto: numOrNull(r.monto ?? ""),
    descripcion: strOrNull(r.descripcion ?? ""),
  };
}