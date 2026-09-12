# Hackatón MCP — Reto Banorte (Aura404)

Repositorio de preparación para el hackatón. El reto es abierto en servicios
financieros: **agentes de IA que generan interfaces en tiempo real**, usando
**MCP (Model Context Protocol)** como pieza obligatoria.

El reto oficial de Banorte × Tec de Monterrey ya llegó: **"Interfaces que
la IA construye en tiempo real"** — un agente (LLM + MCP + A2UI) que no
solo responde, sino que genera y transmite la interfaz que resuelve el
problema financiero de quien pregunta, dentro de un caso de uso libre de
servicios/productos financieros. El análisis completo está en
`docs/02-banorte-contexto/`.

## Estructura

```
hackaton-MCP/
├── README.md
└── docs/
    ├── 00-fundamentos-mcp/       → Qué es MCP, arquitectura, comunicación, piezas
    ├── 01-agentic-ui-frontend/   → Enfoque de Rubén: Agentic UI, componentes reutilizables
    ├── 02-banorte-contexto/      → Resumen del reto oficial + preguntas + decisiones del equipo
    └── 03-arquitectura-tecnica/  → Arquitectura de referencia (diagrama) + catálogo de componentes
frontend/                          → Scaffold React + Vite del demo (ver frontend/README.md)
spec.md                            → Especificación funcional del feature "Banorte ShockAbsorber"
```

## Cómo leer esto

1. Empieza por `docs/00-fundamentos-mcp/01-que-es-mcp.md` y sigue el orden
   numérico de esa carpeta.
2. Luego pasa a `docs/01-agentic-ui-frontend/`, que es la parte de frontend
   / Agentic UI (el rol de Rubén en el equipo) y ya incluye correcciones y
   notas sobre conceptos que se estaban entendiendo mal.
3. `docs/02-banorte-contexto/` tiene el resumen del reto oficial
   (`01-resumen-del-reto.md`) y las preguntas organizadas para hacerle a
   Banorte antes de arrancar a diseñar (`02-preguntas-para-banorte.md`).

## Estado

- [x] Fundamentos de MCP documentados
- [x] Enfoque de Agentic UI / frontend documentado
- [x] Contexto oficial del reto de Banorte (analizado y documentado)
- [x] Primera ronda de preguntas respondidas por especialistas de Banorte
- [x] Caso de uso concreto definido: "golpe financiero de quincena" (CFE +
      anualidad de tarjeta), con hiperpersonalización como eje central
- [x] Especificación funcional formal del feature (`spec.md` — "Banorte
      ShockAbsorber")
- [x] Arquitectura de referencia documentada (`docs/03-arquitectura-tecnica/`)
- [x] Catálogo de componentes básicos definido y primer scaffold de
      frontend (React + Vite) funcionando con datos sintéticos
- [ ] Preguntas técnicas pendientes (A2UI, datos — ver
      `docs/02-banorte-contexto/02-preguntas-para-banorte.md`)
- [ ] Investigación de A2UI (spec formal vs. protocolo propio)
- [ ] Servidor MCP real + motor de detección de anomalías (aún no hay
      backend, solo el frontend con datos mock)
- [ ] Repositorio git inicializado
