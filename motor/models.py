"""Modelo de transacción y utilidades de lectura/escritura tolerante.

Reglas:
- Las columnas históricas `usuario` y `categoria` se conservan como alias de
  `usuario_origen` y `categoria_original` para no romper los CSV existentes
  ni al backend TypeScript que las sigue leyendo.
- Cualquier columna nueva ausente se inicializa con un valor seguro; nunca se
  descarta una fila por columnas faltantes.
- Las fechas se normalizan a tz-aware en ZONA_HORARIA.
"""
from __future__ import annotations

import csv
import re
import unicodedata
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

try:  # Python 3.9+
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

from config import (
    COLUMNAS,
    COLUMNAS_TARJETA,
    COLUMNAS_USUARIO,
    RUTA_CSV,
    RUTA_TARJETAS,
    RUTA_USUARIOS_BANCARIO,
    ZONA_HORARIA,
)

FECHA_FORMATOS = [
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
]

CATEGORIAS_INGRESO = {"nomina", "deposito", "ingreso", "reembolso", "transferencia_recibida", "salary", "income"}
PALABRAS_INGRESO = ("NOMINA", "DEPOSITO", "REEMBOLSO", "TRANSFERENCIA RECIBIDA", "PAGO DE", "ABONO")

ESTATUS_VALIDOS = {"pending", "posted", "reversed"}
DIRECCIONES_VALIDAS = {"debit", "credit"}


def _tz() -> Any:
    if ZoneInfo is not None:
        try:
            return ZoneInfo(ZONA_HORARIA)
        except Exception:  # pragma: no cover
            return timezone.utc
    return timezone.utc  # pragma: no cover


def _texto(valor: Any) -> str:
    if valor is None:
        return ""
    texto = str(valor).strip()
    if texto.lower() in {"nan", "none", "null", "nat"}:
        return ""
    return texto


def _a_float(valor: Any) -> Optional[float]:
    texto = _texto(valor)
    if not texto:
        return None
    texto = texto.replace("$", "").replace(",", "").replace("MXN", "").strip()
    try:
        return float(texto)
    except (TypeError, ValueError):
        return None


def parse_fecha(valor: Any) -> datetime:
    """Normaliza cualquier fecha a tz-aware; nunca lanza, cae a `ahora`."""
    texto = _texto(valor)
    if texto:
        try:
            return datetime.fromisoformat(texto.replace("Z", "+00:00")).astimezone(_tz())
        except ValueError:
            pass
        for formato in FECHA_FORMATOS:
            try:
                fecha = datetime.strptime(texto, formato)
                if fecha.tzinfo is None:
                    fecha = fecha.replace(tzinfo=_tz())
                return fecha.astimezone(_tz())
            except ValueError:
                continue
    return datetime.now(_tz())


def fmt_fecha_iso(fecha: datetime) -> str:
    return fecha.astimezone(_tz()).replace(microsecond=0).isoformat()


def normalizar_texto(valor: Any) -> str:
    """Mayúsculas, sin acentos ni puntuación redundante, espacios colapsados."""
    texto = _texto(valor).upper()
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"[^A-Z0-9 ]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


def normalizar_encabezado(encabezado: str) -> str:
    return normalizar_texto(encabezado).lower().replace(" ", "_")


def _inferir_direccion(fila: Dict[str, Any], monto: Optional[float], categoria: str) -> str:
    cruda = _texto(fila.get("direccion")).lower()
    if cruda in DIRECCIONES_VALIDAS:
        return cruda
    descripcion = normalizar_texto(fila.get("descripcion"))
    categoria_norm = normalizar_texto(categoria)
    if monto is not None and monto < 0:
        return "debit"
    if categoria_norm in CATEGORIAS_INGRESO or any(p in descripcion for p in PALABRAS_INGRESO):
        return "credit"
    return "debit"


def _inferir_estatus(fila: Dict[str, Any]) -> str:
    crudo = _texto(fila.get("estatus")).lower()
    if crudo in ESTATUS_VALIDOS:
        return crudo
    return "posted"


@dataclass
class Transaction:
    id_transaccion: str
    usuario: str
    fecha: datetime
    monto: float
    categoria: str
    descripcion: str = ""
    estatus: str = "posted"
    moneda: str = "MXN"
    direccion: str = "debit"
    referencia: str = ""
    usuario_origen: str = ""
    cuenta_origen: str = ""
    contraparte_nombre: str = ""
    contraparte_cuenta: str = ""
    contraparte_banco: str = ""
    id_tarjeta: str = ""
    saldo_despues: Optional[float] = None
    categoria_original: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)

    # -- consultas -----------------------------------------------------------
    @property
    def es_debito(self) -> bool:
        return self.direccion == "debit"

    @property
    def es_credito(self) -> bool:
        return self.direccion == "credit"

    @property
    def esta_posted(self) -> bool:
        return self.estatus == "posted"

    @property
    def fecha_dia(self) -> str:
        return self.fecha.strftime("%Y-%m-%d")

    @property
    def descripcion_norm(self) -> str:
        return normalizar_texto(self.descripcion or self.contraparte_nombre)

    # -- serialización -------------------------------------------------------
    @classmethod
    def from_row(cls, fila: Dict[str, Any], posicion: int = 0) -> "Transaction":
        usuario = _texto(fila.get("usuario")) or _texto(fila.get("usuario_origen"))
        categoria = _texto(fila.get("categoria")) or _texto(fila.get("categoria_original"))
        monto = _a_float(fila.get("monto"))
        if monto is None:
            monto = 0.0
        identificador = _texto(fila.get("id_transaccion"))
        if not identificador:
            identificador = f"auto-{posicion}-{uuid.uuid4().hex[:8]}"
        fecha = parse_fecha(fila.get("fecha"))
        return cls(
            id_transaccion=identificador,
            usuario=usuario,
            fecha=fecha,
            monto=abs(monto),
            categoria=categoria or "Otros",
            descripcion=_texto(fila.get("descripcion")),
            estatus=_inferir_estatus(fila),
            moneda=_texto(fila.get("moneda")) or "MXN",
            direccion=_inferir_direccion(fila, monto, categoria),
            referencia=_texto(fila.get("referencia")),
            usuario_origen=_texto(fila.get("usuario_origen")) or usuario,
            cuenta_origen=_texto(fila.get("cuenta_origen")),
            contraparte_nombre=_texto(fila.get("contraparte_nombre")),
            contraparte_cuenta=_texto(fila.get("contraparte_cuenta")),
            contraparte_banco=_texto(fila.get("contraparte_banco")),
            id_tarjeta=_texto(fila.get("id_tarjeta")),
            saldo_despues=_a_float(fila.get("saldo_despues")),
            categoria_original=_texto(fila.get("categoria_original")) or categoria,
            extra={k: v for k, v in fila.items() if k not in COLUMNAS},
        )

    def to_row(self) -> Dict[str, Any]:
        return {
            "id_transaccion": self.id_transaccion,
            "usuario": self.usuario,
            "fecha": fmt_fecha_iso(self.fecha),
            "monto": f"{self.monto:.2f}",
            "categoria": self.categoria,
            "descripcion": self.descripcion,
            "estatus": self.estatus,
            "moneda": self.moneda,
            "direccion": self.direccion,
            "referencia": self.referencia,
            "usuario_origen": self.usuario_origen or self.usuario,
            "cuenta_origen": self.cuenta_origen,
            "contraparte_nombre": self.contraparte_nombre,
            "contraparte_cuenta": self.contraparte_cuenta,
            "contraparte_banco": self.contraparte_banco,
            "id_tarjeta": self.id_tarjeta,
            "saldo_despues": "" if self.saldo_despues is None else f"{self.saldo_despues:.2f}",
            "categoria_original": self.categoria_original or self.categoria,
        }


# ---------------------------------------------------------------------------
# Lectura / escritura CSV
# ---------------------------------------------------------------------------
def _leer_csv(ruta: Path) -> List[Dict[str, Any]]:
    if not ruta.exists():
        return []
    filas: List[Dict[str, Any]] = []
    with ruta.open("r", encoding="utf-8-sig", newline="") as archivo:
        lector = csv.DictReader(archivo)
        if not lector.fieldnames:
            return []
        mapa = {campo: normalizar_encabezado(campo or "") for campo in lector.fieldnames}
        for fila_cruda in lector:
            fila: Dict[str, Any] = {}
            for campo, valor in fila_cruda.items():
                fila[mapa.get(campo or "", campo or "")] = valor
            if not any(_texto(v) for v in fila.values()):
                continue
            filas.append(fila)
    return filas


def leer_transacciones(ruta: Optional[Path] = None) -> List[Transaction]:
    filas = _leer_csv(ruta or RUTA_CSV)
    transacciones = [Transaction.from_row(fila, i) for i, fila in enumerate(filas)]
    transacciones.sort(key=lambda t: t.fecha)
    return transacciones


def agrupar_por_usuario(transacciones: Iterable[Transaction]) -> Dict[str, List[Transaction]]:
    grupos: Dict[str, List[Transaction]] = {}
    for transaccion in transacciones:
        if not transaccion.usuario:
            continue
        grupos.setdefault(transaccion.usuario, []).append(transaccion)
    return grupos


def asegurar_encabezado(ruta: Path, columnas: List[str]) -> bool:
    """Añade columnas faltantes a un CSV sin perder datos. Devuelve True si migró."""
    filas = _leer_csv(ruta)
    existentes = set(filas[0].keys()) if filas else set()
    if not filas:
        return False
    faltantes = [c for c in columnas if c not in existentes]
    if not faltantes:
        return False
    for fila in filas:
        for columna in faltantes:
            fila.setdefault(columna, "")
    orden: List[str] = list(columnas)
    with ruta.open("w", encoding="utf-8", newline="") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=orden, extrasaction="ignore")
        escritor.writeheader()
        for fila in filas:
            escritor.writerow({c: fila.get(c, "") for c in orden})
    return True


def migrar_csv() -> bool:
    """Garantiza que los tres CSV tengan todas las columnas canónicas."""
    migrado = False
    for ruta, columnas in (
        (RUTA_CSV, COLUMNAS),
        (RUTA_USUARIOS_BANCARIO, COLUMNAS_USUARIO),
        (RUTA_TARJETAS, COLUMNAS_TARJETA),
    ):
        migrado = asegurar_encabezado(ruta, columnas) or migrado
    return migrado


def append_transaccion(transaccion: Transaction, ruta: Optional[Path] = None) -> None:
    """Agrega una transacción conservando el orden canónico de columnas."""
    destino = ruta or RUTA_CSV
    filas = _leer_csv(destino)
    columnas = list(filas[0].keys()) if filas else list(COLUMNAS)
    for columna in COLUMNAS:
        if columna not in columnas:
            columnas.append(columna)
    with destino.open("a", encoding="utf-8", newline="") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=columnas, extrasaction="ignore")
        if not filas:
            escritor.writeheader()
        escritor.writerow(transaccion.to_row())


# ---------------------------------------------------------------------------
# Contexto bancario (usuarios / tarjetas)
# ---------------------------------------------------------------------------
def leer_usuarios(ruta: Optional[Path] = None) -> Dict[str, Dict[str, Any]]:
    filas = _leer_csv(ruta or RUTA_USUARIOS_BANCARIO)
    usuarios: Dict[str, Dict[str, Any]] = {}
    for fila in filas:
        nombre = _texto(fila.get("usuario"))
        if nombre:
            usuarios[nombre] = fila
    return usuarios


def leer_tarjetas(ruta: Optional[Path] = None) -> List[Dict[str, Any]]:
    return _leer_csv(ruta or RUTA_TARJETAS)


def dias_hasta(fecha_objetivo: Optional[datetime], desde: datetime) -> Optional[float]:
    if fecha_objetivo is None:
        return None
    return (fecha_objetivo - desde).total_seconds() / 86400.0


def proxima_nomina(fila_usuario: Dict[str, Any], desde: datetime) -> datetime:
    fecha = parse_fecha(fila_usuario.get("fecha_nomina")) if _texto(fila_usuario.get("fecha_nomina")) else None
    if fecha and fecha.date() >= desde.date():
        return fecha
    # Fallback determinista: día configurado del siguiente mes.
    from config import PAYROLL_FALLBACK_DAY

    anio = desde.year
    mes = desde.month
    if desde.day >= PAYROLL_FALLBACK_DAY:
        mes += 1
        if mes > 12:
            mes = 1
            anio += 1
    return datetime(anio, mes, PAYROLL_FALLBACK_DAY, tzinfo=_tz())


def nuevo_id(prefijo: str = "tx") -> str:
    return f"{prefijo}-{datetime.now(_tz()).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
