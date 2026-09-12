# 2. Catálogo de componentes básicos (Agentic UI)

Primera versión del **component registry** que ya se había planteado
conceptualmente en
`docs/01-agentic-ui-frontend/03-arquitectura-componentes-reutilizables.md`.
Aquí se aterriza con los componentes concretos que necesita el caso demo
de `spec.md` ("Banorte ShockAbsorber"), usando como base visual el mockup
HTML que ya se armó (Tailwind + Font Awesome, estética Banorte).

El código vivo de estos componentes está en `frontend/src/components/`.
Este documento es el **contrato**: qué hace cada componente, cuándo lo
elige el agente, y qué props/datos espera.

## Regla de oro (recordatorio de `01-agentic-ui-frontend/04-correcciones-y-notas.md`)

El **banner del dashboard NO es un componente A2UI** — es UI base de la
app que refleja el estado "hay un warning pendiente". Todo lo demás de
esta tabla sí es contenido que el agente genera dinámicamente después de
que el usuario toca ese banner.

## Componentes

| Componente            | `uiHint`              | Cuándo lo usa el agente                                   | Props principales |
|------------------------|------------------------|-------------------------------------------------------------|--------------------|
| `AlertBanner`          | *(no aplica — UI base)*| Siempre que el motor de detección emite un trigger pendiente de revisar. | `severity`, `title`, `subtitle` |
| `ServiceSpikeCard`     | `service_spike_card`   | RF-01.1 — un cargo recurrente (CFE, gas) excede su promedio histórico (≥40%). | `service`, `currentAmount`, `historicalAverage`, `overageAmount`, `pointsAvailable`, `pointsToMxnRate` |
| `AnnualFeeCard`        | `annual_fee_card`      | RF-01.2 — anualidad con cobro previsto en ≤5 días.        | `feeAmount`, `dueDate`, `eligibleServices[]` (para domiciliar) |
| `LiquidityShockCard`   | `liquidity_shock_card` | RF-01.3 — una transacción consume ≥75% del saldo disponible. | `transactionAmount`, `currentBalance`, `daysUntilPayroll`, `planOptions[]` (3/6/12 meses) |
| `TwoFactorModal`       | `two_factor_modal`     | RF-04.1 — antes de aplicar CUALQUIER acción de las tres tarjetas anteriores. | `actionSummary`, `onSubmitCode` |
| `ConfirmationReceipt`  | `confirmation_receipt` | RF-04.2 — después de un 2FA válido y la operación aplicada. | `folio`, `newBalance`, `actionDescription` |
| `GenericJsonView`      | *(fallback)*           | Cualquier `uiHint` no reconocido — nunca debe faltar (ver doc 03 de `01-agentic-ui-frontend/`). | `data` |

## Detalle por componente

### `AlertBanner` (UI base, no generada por A2UI)
Vive siempre en el dashboard. Su estado (visible/oculto, severidad,
texto) sí puede venir del backend (ej. "tienes 1 alerta financiera
nueva"), pero su montaje en la pantalla no pasa por el ciclo A2UI — es
parte del shell de la app. Al tocarlo, dispara la llamada que arranca el
ciclo agente↔UI (ver `01-arquitectura-referencia.md`).

### `ServiceSpikeCard`
Cubre RF-02.1 + RF-03.1. Debe mostrar: comparación visual (barra o
número) entre el cobro actual y el promedio histórico, el monto exacto
del sobrecosto, y un control (slider o input) para aplicar puntos de
lealtad — al mover el control, el cargo neto a débito se recalcula **en
el cliente, en vivo**, sin esperar al backend (RF-03.1 pide que sea
instantáneo). El submit final (aplicar puntos de verdad) sí va al
backend, y de ahí a `TwoFactorModal`.

### `AnnualFeeCard`
Cubre RF-01.2 + RF-03.2. Muestra la fecha de vencimiento y una lista de
switches (uno por servicio elegible para domiciliar). Al activar un
switch, el costo de la anualidad se recalcula en vivo hacia $0 si aplica
la exención. Igual que arriba: el cálculo visual es local, la ejecución
real pasa por `TwoFactorModal`.

### `LiquidityShockCard`
Cubre RF-01.3 + RF-03.3. Un slider de plazos (3/6/12 meses) que recalcula
en vivo el saldo disponible proyectado y la cuota mensual fija. Mismo
patrón: cálculo visual inmediato, ejecución real vía 2FA.

### `TwoFactorModal`
Cubre RF-04.1. Genérico para las tres tarjetas — recibe un resumen de la
acción a autorizar (`actionSummary`) y un campo de 6 dígitos. Maneja el
caso límite E-02 (código inválido: error descriptivo, sin reiniciar el
flujo ni perder la configuración que el usuario ya armó).

### `ConfirmationReceipt`
Cubre RF-04.2. Folio bancario + saldo actualizado + descripción de la
acción aplicada. Es el último paso del ciclo — después de esto, la
alerta original en el dashboard (`AlertBanner`) debe desaparecer
(RF-04.2 lo pide explícito).

### `GenericJsonView`
El fallback obligatorio de siempre (ver
`01-agentic-ui-frontend/03-arquitectura-componentes-reutilizables.md`).
Necesario mientras no todos los `uiHint` posibles tengan componente
dedicado, y como red de seguridad en la demo en vivo.

## Nota sobre RNF-03 (resiliencia)

`spec.md` pide que si el LLM/servicio de inferencia falla, se muestre una
interfaz de respaldo en <500ms sin pantallas de error. Esto sugiere que,
para cada `uiHint` de los tres casos (ServiceSpike, AnnualFee,
LiquidityShock), el frontend debería tener una versión "default" del
componente que se pueda montar solo con los datos crudos del trigger
(sin esperar la composición fina del LLM) — algo a definir cuando se
diseñe el contrato A2UI a detalle, pero ya vale la pena tenerlo en mente
al construir los componentes: que puedan recibir props mínimas y
igual verse bien, no solo el caso "ideal" con todos los campos.
