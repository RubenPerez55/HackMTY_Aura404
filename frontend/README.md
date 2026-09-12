# Frontend — Banorte ShockAbsorber (demo)

Scaffold en React + Vite (Tailwind vía CDN, igual que el mockup HTML
original) que implementa el catálogo de componentes básicos descrito en
`../docs/03-arquitectura-tecnica/02-catalogo-componentes.md`.

## Qué es esto (y qué no es todavía)

- **Sí es:** un shell de app bancaria funcional con datos sintéticos
  (`src/mockData.js`) que simula los 3 triggers de `spec.md` (RF-01):
  pico de servicio, anualidad por vencer y golpe de liquidez. Corre 100%
  en el navegador, sin backend.
- **Sí demuestra:** el ciclo completo — banner en el dashboard (UI base,
  NO generada por A2UI) → el usuario lo toca → se abre un modal con el
  componente correspondiente (sí generado dinámicamente, elegido por
  `uiHint` vía el component registry) → el usuario ajusta el control
  (slider/switches) y ve el recálculo en vivo → confirma → 2FA → recibo
  de confirmación → la alerta desaparece del dashboard.
- **Todavía NO es:** la integración real con el Backend/Orquestador, el
  MCP Server, ni el protocolo A2UI real. Los `uiHint` y los payloads de
  `mockData.js` están escritos con la forma que se espera que tenga la
  respuesta A2UI real (ver `01-arquitectura-referencia.md`), para que
  conectarlo después sea, idealmente, solo cambiar de dónde vienen los
  datos (de `mockData.js` a una respuesta HTTP real) sin tocar los
  componentes.

## Cómo correrlo

```bash
cd frontend
npm install
npm run dev
```

Abre la URL que imprime Vite (por defecto `http://localhost:5173`).

## Estructura

```
src/
├── main.jsx                  → punto de entrada de React
├── App.jsx                   → shell de la app + orquesta el ciclo banner→modal→2FA→recibo
├── mockData.js                → datos sintéticos de usuario y de los 3 triggers
└── components/
    ├── AlertBanner.jsx         → UI base del dashboard (NO es A2UI)
    ├── Modal.jsx               → wrapper genérico de modal
    ├── ServiceSpikeCard.jsx    → RF-02.1 / RF-03.1 (pico de servicio + puntos)
    ├── AnnualFeeCard.jsx       → RF-01.2 / RF-03.2 (anualidad + domiciliación)
    ├── LiquidityShockCard.jsx  → RF-01.3 / RF-03.3 (golpe de liquidez + plazos)
    ├── TwoFactorModal.jsx      → RF-04.1 (2FA genérico)
    ├── ConfirmationReceipt.jsx → RF-04.2 (folio + confirmación)
    ├── GenericJsonView.jsx     → fallback obligatorio para uiHint no reconocido
    └── componentRegistry.js    → mapa uiHint -> componente (el "Agentic UI" en código)
```

## Siguiente paso técnico

Reemplazar `mockData.js` por una llamada real al Backend/Orquestador
(REST + SSE/WebSocket, payload A2UI JSON — ver
`../docs/03-arquitectura-tecnica/01-arquitectura-referencia.md`), y mover
el estado de `triggers` a que lo alimente ese backend en vez de un array
estático. La lógica de UI (registry, modales, recálculo en vivo) no
debería tener que cambiar.
