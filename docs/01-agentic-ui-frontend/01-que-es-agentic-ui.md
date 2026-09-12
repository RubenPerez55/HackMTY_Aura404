# 1. ¿Qué es "Agentic UI" / Generative UI?

**Agentic UI** (también llamada *Generative UI*) es el patrón de frontend
donde la interfaz **no está fija de antemano**: en lugar de que el
desarrollador diseñe una sola pantalla para un flujo, el agente de IA va
decidiendo, en tiempo real, qué información necesita mostrar y con qué
**tipo de componente** se representa mejor — y el frontend ensambla la UI
sobre la marcha con esa decisión.

Ejemplo de la vida real (fintech): el usuario pregunta "¿cómo va mi
portafolio?" y en vez de responder solo texto, el agente decide llamar a
una tool que trae el desglose de inversiones, y el frontend renderiza una
tabla o un gráfico de pastel — sin que un desarrollador haya programado
"si preguntan por portafolio, muestra esta pantalla". La pantalla se arma
dinámicamente según el *evento* (qué tool se llamó y qué devolvió).

## La idea central que hay que tener clarísima

Este es el punto donde vale la pena corregir el enfoque inicial: **MCP no
genera UI**. MCP es el protocolo que conecta al agente con las
herramientas/datos (ver `docs/00-fundamentos-mcp/`). La generación de la
interfaz es una responsabilidad **del frontend/Host**, que ocurre *después*
de que MCP ya resolvió una tool call. El flujo real es:

```
1. Usuario escribe algo
2. El LLM (orquestador del Host) decide: "necesito llamar la tool X"
3. El Client MCP invoca la tool X en el Server correspondiente
4. El Server responde con datos estructurados (JSON / texto / etc.)
5. EL FRONTEND decide qué componente usar para mostrar esa respuesta
   → esta decisión (el "Agentic UI") es lógica de la aplicación,
     no de MCP.
6. Se renderiza el componente con los datos recibidos
```

Entonces "Agentic UI" en este proyecto = el **motor de mapeo** entre
`(nombre de la tool que se llamó, forma de los datos que regresó)` y
`(qué componente de React/Vue/lo que sea se debe montar y con qué props)`.

## Dos formas de resolverlo (para tenerlas sobre la mesa)

1. **Mapeo del lado del frontend (recomendado para MVP/hackatón):**
   Cada tool tiene un `name` y devuelve un JSON con una forma conocida.
   El frontend mantiene un **registro de componentes** (`componentRegistry`)
   que asocia `tool.name` (o un campo tipo `resultType` que definamos
   nosotros en el schema de salida) → un componente React reutilizable.
   Simple, controlable, 100% nuestro.

2. **UI declarada por el propio Server (MCP-UI u otra convención):**
   El Server, en vez de devolver solo datos crudos, devuelve también una
   pista de presentación (ej. un recurso embebido tipo HTML/iframe, o un
   JSON Schema de UI). Es más "avanzado" y se acerca a la propuesta
   comunitaria MCP-UI. Da más flexibilidad pero también más complejidad y
   menos control sobre el diseño/consistencia visual — probablemente no es
   necesario para un MVP de hackatón, pero está bien tenerlo documentado
   como posible v2.

Para el resto de esta carpeta se desarrolla la opción 1, que es la más
realista para el tiempo de un hackatón.
