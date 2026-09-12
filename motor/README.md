# Motor de Detección de Impacto Financiero

Prototipo event-driven que escucha `transacciones.csv`, detecta anomalías financieras en tiempo real y dispara triggers estructurados hacia un agente financiero (que por ahora reporta en consola).

## Arquitectura

```
insertar_transaccion.py ──► transacciones.csv ──► motor.py (watchdog)
                                                    │
                                                    ▼
                                              analytics.py
                              (SPENDING_SPIKE / LIQUIDITY_SHOCK)
                                                    │
                                                    ▼
                    agent.py  ──►  banca.py (contexto del usuario en la alerta)
              (reporte en consola)
```

## Usuarios del sistema

| Usuario | Puntos | Score créd. | Tarjetas activas | Caso de prueba |
|---|---|---|---|---|
| `Ruben Perez` | 4,350 (Oro) | 782 (Bueno) | 2 crédito + 1 débito | Perfil premium completo |
| `Hector Barrera` | **0** (Básico) | 695 (Bueno) | 1 crédito + 1 débito | Sin puntos de fidelidad |
| `Hector Castro` | 180 (Básico) | 588 (Regular) | **0** (todas vencidas/canceladas) | Sin tarjetas activas |
| `Javier Ortiz` | **0** (sin asignar) | **Sin historial** | **0** | Sin historial crediticio, sin tarjetas |

## Base de datos local (3 tablas CSV)

| Archivo | Contenido |
|---|---|
| `transacciones.csv` | Historial de movimientos (`id_transaccion`, `usuario`, `fecha`, `categoria`, `monto`, `descripcion`) |
| `usuarios_bancario.csv` | Perfil bancario por usuario: ingreso mensual, saldo en ahorro, deuda total, pagos atrasados, puntos fidelidad, nivel, score e historial crediticio |
| `tarjetas.csv` | Detalle de plásticos: tipo, marca, número enmascarado, vencimiento, estatus, límite y saldo utilizado |

## Reglas de detección

| Evento | Regla |
|---|---|
| `SPENDING_SPIKE_DETECTED` | Z-Score del monto vs histórico de su categoría > 2.5 (o monto > 3× media si la desviación es mínima) |
| `LIQUIDITY_SHOCK_DETECTED` | Cobro individual ≥ $5,000 MXN, **o** acumulado en ventana móvil de 7 días ≥ $12,000 MXN (o 3× el promedio histórico del usuario) |

Los umbrales se ajustan en `config.py`.

## Instalación

```bash
cd motor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Flujo de prueba (dos terminales)

**Terminal 1 — generador de historial y motor a la escucha:**

```bash
source .venv/bin/activate
python data_gen.py              # regenera las 3 tablas (transacciones) o solo menciona
python motor.py                 # quedarse en escucha (Ctrl+C para salir)
```

**Terminal 2 — insertar transacciones:**

```bash
source .venv/bin/activate

# Modo interactivo (pide usuario, categoría, monto y descripción)
python insertar_transaccion.py

# Modo rápido por argumentos
python insertar_transaccion.py --usuario "Hector Barrera" --monto 18500 --categoria "Servicios" --descripcion "Cargo único empresa digital"

# Demo: 4 transacciones calibradas para disparar alertas
python insertar_transaccion.py --demo
```

Cuando insertas una transacción anómala, el motor imprime el trigger estructurado, por ejemplo:

```
⚠ TRIGGER FINANCIERO ESTRUCTURADO
  EVENTO  : LIQUIDITY_SHOCK_DETECTED
  USUARIO : Hector Castro
  MONTO   : $5,200.00 MXN
   [COBRO_INDIVIDUAL] → Cobro individual supera umbral crítico de $5,000 MXN

  CONTEXTO BANCARIO DEL USUARIO
    • Ingreso mensual     : $21,000.00 MXN
    • Puntos fidelidad    : 180 (Basico)
    • Score crediticio    : 588 (Regular)
    • Tarjetas activas    : Ninguna (0 crédito, 0 débito)
```

## Casos de prueba listos

Inserta estos montos para ver las distintas alertas y cómo el agente muestra el contexto de cada perfil:

| Prueba | Comando | Qué esperar |
|---|---|---|
| Spike de gasto | `--usuario "Javier Ortiz" --monto 3000 --categoria "Comida"` | `SPENDING_SPIKE_DETECTED` + perfil sin historial |
| Shock de liquidez | `--usuario "Hector Castro" --monto 5200 --categoria "Salud"` | `LIQUIDITY_SHOCK_DETECTED` + 0 tarjetas activas |
| Ambos eventos | `--usuario "Hector Barrera" --monto 18500 --categoria "Servicios"` | Spike + Shock + 0 puntos fidelidad |
| Todo automático | `python insertar_transaccion.py --demo` | 4 transacciones que disparan alertas para los 4 usuarios |

## Estructura del código

| Archivo | Función |
|---|---|
| `config.py` | Usuarios, categorías, umbrales y rutas de las 3 tablas |
| `data_gen.py` | Genera historial (Faker) + perfiles bancarios y tarjetas; agrega transacciones |
| `banca.py` | Carga `usuarios_bancario.csv`/`tarjetas.csv` y arma el contexto del usuario |
| `analytics.py` | Motor estadístico (Z-Score, ventana móvil 7 días) |
| `motor.py` | File watcher (watchdog) + orquestación de eventos |
| `agent.py` | Agente que consume el trigger y reporta en consola |
| `insertar_transaccion.py` | Simulador de entrada de transacciones |