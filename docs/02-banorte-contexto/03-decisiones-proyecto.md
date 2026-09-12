# 3. Decisiones del proyecto (post-plática con especialistas de Banorte)

Este documento captura las decisiones que ya tomó el equipo tras hablar
con Banorte, para que cualquier compañero (o su agente) tenga el mismo
contexto sin tener que releer todo el hilo. Reemplaza/resuelve varias de
las dudas abiertas en `02-preguntas-para-banorte.md` — ese archivo se
actualiza en consecuencia.

## 1. Alcance de usuario: clientes (por ahora)

**Decisión:** el proyecto se especifica para **clientes de Banorte**, no
para uso interno/colaboradores. No se descarta que en el futuro escale a
uso interno, pero eso queda fuera del alcance de este hackatón.

Resuelve la pregunta A.1 de `02-preguntas-para-banorte.md`.

## 2. Qué tan acotado: "que el usuario sienta un agente personalizado"

**Decisión (cualitativa):** el criterio de acotamiento no es "una acción
puntual vs. un proceso largo" — es que el usuario sienta que el agente lo
conoce a él específicamente. En la práctica, esto se traduce a: un flujo
concreto, de un dominio acotado (gastos/pagos recurrentes), resuelto de
principio a fin, con datos que reflejen hábitos de un usuario particular
(ver el caso demo abajo).

Resuelve parcialmente la pregunta A.2/A.3 — el "acotamiento" real lo va a
dar el caso demo elegido, no una regla abstracta.

## 3. Hiperpersonalización: el criterio más importante para Banorte

Banorte confirmó explícitamente que la **hiperpersonalización** es lo que
más les importa del proyecto. Se decide que tiene **dos caras**, no una
sola:

1. **Basada en estímulos (proactiva):** el sistema detecta algo por su
   cuenta (un cargo que se disparó, una fecha que se acerca) y actúa sin
   que el usuario haya preguntado nada.
2. **Basada en acciones/rutinas del usuario (adaptativa):** el agente
   ajusta qué componente mostrar según el comportamiento habitual de ese
   usuario (ej. si sólo revisa transacciones, prioriza ese tipo de
   componente en vez de mostrar todo el catálogo posible).

Resuelve la pregunta B.4 — sí, el estímulo puede ser distinto a "el
usuario escribió una pregunta".

## 4. Corrección importante: la hiperpersonalización NO es "memoria" en el sentido de perfil/conversación — es análisis de datos transaccionales

En una iteración anterior de este documento se había planteado la
hiperpersonalización como si dependiera de una "memoria de usuario" al
estilo de un perfil acumulado o memoria de conversación de un LLM. **El
equipo lo aclaró y hay que corregirlo:**

- No es (solo) que el agente "recuerde" preferencias declaradas o
  historial de chat.
- Es que el agente tiene, vía algoritmos, **acceso a los datos
  transaccionales del usuario** (ej. sus cargos fijos de CFE) y puede
  **detectar cuando algo se sale de lo normal** (un cargo recurrente que
  de un mes a otro subió).

Esto cambia la pieza de arquitectura que hay que construir: en vez de (o
además de) un "perfil de usuario" estático que el LLM simplemente lee,
se necesita una **capa de análisis/detección de anomalías sobre el
histórico de transacciones** que produzca señales (ej. "este cargo se
salió de lo normal", "hay gastos hormiga recortables") que se le pasan al
agente como contexto o como resultado de una tool MCP. Esa capa puede
vivir como parte del servidor MCP (una tool que hace el cálculo al
llamarse) o como un servicio de análisis aparte que el servidor MCP
consulta.

La memoria de sesión/conversación (el "ciclo cerrado" que ya pide el reto
de Banorte) sigue siendo válida y necesaria, pero **ya no es la pieza
central de la hiperpersonalización** — es complementaria.

## 5. ACTUALIZACIÓN — el mockup cambió: app bancaria mobile con banner +
   modales, no el layout de chat 85/15

El layout de "componentes 85% / chat 15%" de la reunión anterior **se
reemplazó** por un mockup distinto, más cercano a una app bancaria real
(ver el HTML de referencia y `frontend/` en el repo): una pantalla de
banca móvil normal (saldo, operaciones rápidas, movimientos) con un
**banner/warning** que aparece cuando el motor de detección encuentra un
desbalance, y al tocarlo se abre un **modal** con la interfaz generada
por el agente (gráficas, controles, acciones).

Esto también resuelve lo que quedaba pendiente aquí: **el panel no
"arranca" con nada — el punto de entrada es el banner del dashboard**, y
el ciclo agente↔UI ni siquiera se activa hasta que el usuario lo toca.
Ver la aclaración completa en
`docs/03-arquitectura-tecnica/01-arquitectura-referencia.md` (sección
"Corrección: cuándo empieza el ciclo") y el catálogo de componentes en
`docs/03-arquitectura-tecnica/02-catalogo-componentes.md`.

No se descarta un chat como canal adicional más adelante, pero ya no es
la pieza central del layout — el foco pasó a ser el ciclo
banner→modal→confirmación.

## 6. Caso demo — ya formalizado como `spec.md`: "Banorte ShockAbsorber"

El caso demo descrito abajo ya se convirtió en una especificación
funcional formal: **`spec.md`, en la raíz del repo** ("Banorte
ShockAbsorber — Guardián Proactivo de Gastos Recurrentes y Estabilizador
de Salud Financiera"). Ese documento es ahora la fuente de verdad sobre
requisitos funcionales (RF-01 a RF-04), no funcionales, casos límite y
criterios de aceptación — este resumen se deja como narrativa/contexto,
pero para el detalle exacto de comportamiento esperado hay que consultar
`spec.md` directamente.

Diferencia importante respecto a la primera versión de este documento:
`spec.md` formaliza **tres** disparadores (RF-01), no solo el combo
CFE+anualidad:
1. **Pico de servicio recurrente** (ej. CFE, ≥40% sobre su promedio).
2. **Renovación anual inminente** (anualidad con cobro en ≤5 días).
3. **Golpe de liquidez** (una compra consume ≥75% del saldo disponible).

Cada uno tiene su propia tarjeta/componente dedicado — ver
`docs/03-arquitectura-tecnica/02-catalogo-componentes.md`.

### El problema cotidiano

A mitad de quincena llega el recibo de luz (CFE) más alto de lo normal
(ej. por temporada de calor / uso de aire acondicionado), y el mismo día
se cobra la anualidad de una tarjeta que el usuario ya había olvidado. En
segundos, el dinero disponible para el resto del mes se reduce
drásticamente.

### Qué hace la solución

En vez de una notificación pasiva tipo *"se te cobraron $3,500 pesos"*
que deja al usuario en ceros, la app detecta el golpe financiero (antes de
tiempo o en el momento) y **rediseña la pantalla al instante** con
opciones personalizadas para "salvar la quincena":

- Permite cubrir el excedente del recibo de luz usando **Puntos Banorte**.
- Ofrece **perdonar el cobro de la anualidad** de la tarjeta con solo
  domiciliar un servicio, en un toque.

### Resultado esperado

El usuario neutraliza el golpe financiero en ~30 segundos, **sin
endeudarse y sin poner dinero de su bolsillo**.

### Dónde entra exactamente la hiperpersonalización (aclaración del equipo)

No es "mostrar una gráfica de salud financiera" genérica al estilo de un
dashboard tradicional (ej. BBVA). El agente:

1. Detecta, vía análisis de las transacciones fijas del usuario, que un
   cargo recurrente (CFE) se disparó respecto a su histórico.
2. En vez de solo alertar, **ofrece un camino de solución**: identifica
   que hay "gastos hormiga" recortables que compensarían el excedente y
   ayudarían a mantener el saldo positivo — el mensaje conceptual es *"la
   luz llegó más alta, pero hay gastos hormiga que se pueden reducir para
   mantener tu saldo positivo"*.
3. Genera componentes de apoyo a esa narrativa (gráficas, porcentajes,
   métricas del gasto hormiga vs. el excedente a cubrir) más las dos
   acciones concretas (cubrir con Puntos, perdonar anualidad vía
   domiciliación).

### Por qué es un buen flujo bandera para la demo

- Es **proactivo** (estímulo) y no solo reactivo a una pregunta de texto
  — encaja con la decisión #3 de este documento.
- Usa **análisis de datos transaccionales**, no memoria conversacional —
  coincide con la corrección del punto #4.
- Termina en **al menos dos acciones reales ejecutables** (aplicar
  puntos, domiciliar servicio) — cumple la regla del reto de "al menos un
  flujo accionable".
- Vive en **un solo dominio acotado** (pagos/gastos) resuelto de
  principio a fin — sigue el consejo textual del deck: *"elijan un
  problema pequeño y resuélvanlo completo."*

## 7. Nuevas piezas de arquitectura que esto implica

1. **Motor de detección de anomalías/patrones** sobre transacciones
   (para el hackatón, basta con reglas simples: comparar el cargo actual
   contra el promedio histórico del mismo concepto/comercio).
2. **Catálogo/categorización de "gastos hormiga"** (o gasto no esencial),
   para poder sugerir recortes concretos.
3. **Simulación de Puntos Banorte** como medio de pago alternativo (dato
   sintético: saldo de puntos del usuario + tasa de conversión a pesos).
4. **Simulación de "domiciliación de servicio"** como acción que, al
   ejecutarse, perdona un cobro (regla de negocio simulada, no
   necesariamente real).
5. **Un disparador/evento** que arranque el ciclo sin que el usuario
   escriba nada — para el hackatón puede simularse como una verificación
   al iniciar sesión (no hace falta infraestructura real de
   notificaciones push).

## 8. Preguntas nuevas que esto abre

Se agregaron a `02-preguntas-para-banorte.md` (sección F):
- ¿Existe una definición/categorización de "gasto hormiga" que Banorte ya
  use internamente, o la definimos nosotros?
- ¿Los Puntos Banorte tienen una tasa de conversión pública/estándar que
  debamos respetar en los datos sintéticos?
- ¿"Domiciliar un servicio para perdonar la anualidad" es una promoción
  real vigente en Banorte (para inspirar las reglas de negocio), o es
  libre invención del equipo?
