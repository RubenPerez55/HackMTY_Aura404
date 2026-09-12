# Contexto del reto Banorte — índice

Esta carpeta documenta el reto oficial de Banorte × Tec de Monterrey,
recibido como PDF (ver `Reto_UI_Generativa_Banorte_Tec.pdf` un nivel
arriba, en `docs/`).

- **`01-resumen-del-reto.md`** — análisis completo del reto: objetivo,
  dominio, la base técnica obligatoria (LLM + MCP + A2UI), arquitectura de
  referencia, reglas, evaluación y entregables.
- **`02-preguntas-para-banorte.md`** — preguntas organizadas y priorizadas
  para Banorte. Varias ya están marcadas **[RESUELTA]** tras la plática
  con especialistas; quedan las de detalle técnico (A2UI, datos, eval).
- **`03-decisiones-proyecto.md`** — lo que el equipo ya definió tras esa
  plática: alcance de cliente, qué significa "hiperpersonalización" para
  Banorte (estímulos + rutinas, y por qué NO es solo "memoria" sino
  análisis de datos transaccionales), el mockup de layout propuesto
  (componentes 85% / chat 15%), y el caso demo bandera ("golpe financiero
  de quincena": CFE + anualidad de tarjeta).

Próximo paso: cerrar las preguntas técnicas que faltan (A2UI, esquema de
datos) y pasar a diseñar la arquitectura concreta (servidor MCP, motor de
detección de anomalías, component registry) sobre el caso demo ya
definido.
