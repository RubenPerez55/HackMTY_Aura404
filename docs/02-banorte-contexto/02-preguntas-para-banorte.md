# 2. Preguntas para Banorte

Preguntas organizadas antes de empezar a diseñar la solución. Se agrupan
por tema, y cada una indica si el PDF del reto ya la responde (parcial o
totalmente) o si sigue completamente abierta.

Ver el análisis completo del reto en `01-resumen-del-reto.md`. Las
decisiones ya tomadas tras hablar con los especialistas de Banorte están
en `03-decisiones-proyecto.md` — varias preguntas de aquí ya se marcan
como **[RESUELTA]** y remiten a ese documento.

## A. Usuario y alcance del producto

1. **[RESUELTA]** ¿El reto está enfocado a clientes/público en general, o a
   colaboradores/uso interno de Banorte?
   El equipo lo confirmó con Banorte: **clientes**, por ahora. No se
   descarta escalar a uso interno en el futuro, pero queda fuera del
   alcance de este hackatón. Ver decisión #1 en `03-decisiones-proyecto.md`.

2. **[RESUELTA — cualitativamente]** ¿Qué tan acotado debe ser el caso de
   uso: una sola acción puntual, o un proceso con varios pasos?
   Banorte respondió: lo suficiente para que el usuario sienta que tiene
   un agente personalizado a él. El equipo tradujo esto a un caso demo
   concreto (ver decisión #6 en `03-decisiones-proyecto.md`) en vez de
   una regla abstracta de "cuántos pasos".

3. ¿Se espera que el sistema soporte **múltiples intenciones/dominios** (ej.
   crédito Y pagos) o está bien enfocarse en **un solo dominio** (ej. solo
   crédito) y resolverlo a profundidad?

## B. Estímulo / forma de interacción

4. **[RESUELTA]** ¿La interacción es exclusivamente conversacional (el
   usuario escribe una pregunta), o el "estímulo" que dispara la
   generación de UI puede venir de otro lado (una transacción reciente,
   una fecha próxima, una alerta proactiva del sistema)?
   El equipo ya decidió que **ambos** cuentan: la hiperpersonalización
   (el criterio más importante para Banorte) se construye tanto con
   estímulos proactivos como con acciones/rutinas del usuario. Ver
   decisión #3 en `03-decisiones-proyecto.md`.

5. ¿El input del usuario tiene que ser **texto libre en lenguaje natural**
   siempre, o también puede combinarse con **acciones estructuradas**
   (tocar un botón, elegir una opción de un menú) como disparador de una
   nueva intención?

## C. Alcance técnico de A2UI y MCP

6. **A2UI se menciona como protocolo pero no se detalla — ¿existe una
   especificación/librería concreta que debamos usar, o "un protocolo
   equivalente" significa que podemos diseñar nuestro propio contrato
   agente→UI?** Esto es crítico para poder arrancar el diseño técnico del
   frontend.

7. ¿Se espera un **servidor MCP real** (con su propio proceso, siguiendo
   el spec formal de Anthropic), o basta con una capa que **imite el
   patrón** de MCP (tools con nombre + schema) sin ser 100% compliant con
   el protocolo oficial?

8. Sobre el ciclo cerrado ("la interacción regresa como contexto"): ¿ese
   contexto debe persistir entre sesiones (memoria de conversación
   completa), o basta con que persista dentro de una sola sesión/demo?

## D. Datos

9. El deck dice que los datos pueden ser "sintéticos, simulados o de
   fuentes públicas" — **¿hay algún dataset o API pública que Banorte
   recomiende o prefiera que usemos**, para que los proyectos sean
   comparables, o es completamente libre?

10. ¿Hay restricciones de qué **no** se puede simular (ej. no simular
    datos que parezcan de un cliente real, no usar nombres/marca de
    Banorte en los datos de prueba)?

## E. Evaluación y logística

11. Sobre el criterio "Calidad y adaptabilidad de la UI generada" (20%):
    **¿qué entienden por "adaptable"** — que la UI cambie según distintos
    inputs del mismo usuario, que se vea bien en distintos tamaños de
    pantalla (responsive), o ambas?

12. ¿La demo en vivo se corre en el equipo de los participantes (su laptop)
    o hay que desplegarlo en algún ambiente que Banorte provea/revise?

13. ¿Hay una duración/formato esperado para la demo y la presentación
    final?

## F. Nuevas dudas del caso demo (gastos recurrentes + "golpe de quincena")

Estas surgieron al definir el caso demo de la decisión #6 en
`03-decisiones-proyecto.md` (CFE + anualidad de tarjeta el mismo día).

14. ¿Existe una definición o categorización de **"gasto hormiga"** que
    Banorte ya use internamente (para poder ser consistentes con su
    criterio), o la definimos nosotros para la demo?

15. ¿Los **Puntos Banorte** tienen una tasa de conversión pública/estándar
    a pesos que debamos respetar en los datos sintéticos, o inventamos una
    razonable?

16. ¿"Perdonar el cobro de la anualidad a cambio de domiciliar un
    servicio" es una promoción real vigente hoy en Banorte (nos serviría
    de referencia para las reglas de negocio), o es libre invención del
    equipo para la demo?

## Cómo priorizar si el tiempo con Banorte es limitado

Si solo hay espacio para preguntar 3-4 cosas, este es el orden sugerido de
prioridad porque bloquean decisiones de arquitectura que no se pueden
revertir fácil a medio hackatón:

1. **A2UI (pregunta 6)** — sin saber si hay una spec obligatoria, no
   podemos empezar a diseñar el contrato agente→frontend.
2. **Usuario/alcance (pregunta 1)** — define el tono, los datos y el nivel
   de "seriedad" (compliance) de la solución.
3. **Tipo de estímulo (pregunta 4)** — define si el frontend necesita
   soportar flujos proactivos o solo reactivos a texto.
4. **Acotamiento del caso de uso (pregunta 2)** — para no sobre-diseñar un
   flujo largo cuando el criterio real premia un flujo pequeño y completo.
