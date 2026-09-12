/**
 * Modelos de la base de datos compartida (3 tablas CSV).
 *
 * Espejo de las columnas de `../motor/config.py` para que backend y el
 * futuro servidor MCP bancario hablen el mismo esquema.
 */

export interface BankingUser {
  usuario: string;
  fecha_afiliacion: string | null;
  ingreso_mensual: number | null;
  saldo_ahorro: number | null;
  deuda_total: number | null;
  pagos_atrasados: number | null;
  puntos_fidelidad: number | null;
  nivel_fidelidad: string | null;
  score_crediticio: number | null;
  historial_crediticio: string | null;
}

export interface Card {
  id_tarjeta: string | null;
  usuario: string | null;
  tipo: string | null;
  marca: string | null;
  numero_enmascarado: string | null;
  vencimiento: string | null;
  estatus: string | null;
  limite_credito: number | null;
  saldo_utilizado: number | null;
}

export interface Transaction {
  id_transaccion: number | null;
  usuario: string | null;
  fecha: string | null;
  categoria: string | null;
  monto: number | null;
  descripcion: string | null;
}

/** Contexto bancario de un usuario (paralelo a `banca.contexto_usuario`). */
export interface UserContext extends BankingUser {
  tarjetas_activas: Card[];
  tarjetas_totales: Card[];
  credito_activas: number;
  debito_activas: number;
}

export const USUARIOS_BANCARIO_COLUMNS = [
  "usuario",
  "fecha_afiliacion",
  "ingreso_mensual",
  "saldo_ahorro",
  "deuda_total",
  "pagos_atrasados",
  "puntos_fidelidad",
  "nivel_fidelidad",
  "score_crediticio",
  "historial_crediticio",
] as const;

export const TARJETAS_COLUMNS = [
  "id_tarjeta",
  "usuario",
  "tipo",
  "marca",
  "numero_enmascarado",
  "vencimiento",
  "estatus",
  "limite_credito",
  "saldo_utilizado",
] as const;

export const TRANSACCIONES_COLUMNS = [
  "id_transaccion",
  "usuario",
  "fecha",
  "categoria",
  "monto",
  "descripcion",
] as const;