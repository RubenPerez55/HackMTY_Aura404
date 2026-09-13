# Banorte Vanguard — Prototipo HackMTY (Aura404)

> **Reto Banorte × Tec de Monterrey:** Interfaces que la IA construye en tiempo real (A2UI + Model Context Protocol).

**Banorte Vanguard** es un estabilizador financiero proactivo que detecta anomalías de gasto y quiebres de liquidez, orquestando soluciones bancarias hiperpersonalizadas (Planes Alivio a Meses Sin Intereses, Adelanto de Nómina y Domiciliación de Servicios con Condonación de Anualidad). A través de un motor de IA que combina LLM (Gemini), MCP y componentes dinámicos A2UI, la aplicación construye la interfaz en tiempo real y permite autorizar acciones críticas mediante **SoftToken (Human-in-the-Loop)**.

---

## 📋 Requisitos Previos

* **Node.js:** Versión 18 o superior (`node -v`).
* **npm:** Versión 9 o superior (`npm -v`).
* **API Key de Gemini:** Clave de API de [Google AI Studio](https://aistudio.google.com/).

---

## ⚙️ Configuración del Entorno

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/RubenPerez55/HackMTY_Aura404.git
   cd HackMTY_Aura404
   ```

2. **Configurar variables de entorno del backend:**
   Copia el archivo de plantilla `.env.example` dentro de `mcp-agent/`:
   ```bash
   cp mcp-agent/.env.example mcp-agent/.env
   ```
   Abre `mcp-agent/.env` y coloca tu API Key de Gemini:
   ```env
   LLM_PROVIDER=openai-compatible
   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
   LLM_MODEL=gemini-2.5-flash
   GEMINI_API_KEY=tu-api-key-de-gemini-aqui
   ```

3. **Instalar dependencias:**
   ```bash
   # Dependencias del backend / agente MCP
   npm --prefix mcp-agent install

   # Dependencias del frontend móvil React
   npm --prefix frontend install
   ```

---

## 🚀 Instrucciones para Correr la Aplicación

Para ejecutar la demo completa en modo desarrollo necesitas **dos terminales** activas:

### Terminal 1: Backend Orquestador + Servidor MCP
Inicia el orquestador BFF y el servidor bancario MCP (escuchando en `http://localhost:4000`):
```bash
npm run dev:backend
```

### Terminal 2: Frontend (Banorte Vanguard Móvil)
Inicia el servidor de desarrollo de Vite (escuchando en `http://localhost:5173`):
```bash
npm run dev
```

Abre en tu navegador: **`http://localhost:5173`**

*(La aplicación incluye un proxy en Vite que redirige automáticamente todas las peticiones `/api` al backend en el puerto 4000).*

---

## 🧪 Pruebas y Comprobaciones de Calidad

El proyecto cuenta con una suite completa de pruebas de integración y verificación:

* **Ejecutar todas las pruebas (MCP + Backend SSE):**
  ```bash
  npm run smoke:all
  ```
  *Verifica las 13 operaciones bancarias MCP (consultas, simulaciones, domiciliaciones y autorizaciones SoftToken) y el ciclo de vida de sesiones SSE.*

* **Compilación de producción (TypeScript + Vite):**
  ```bash
  npm run build:all
  ```
  *Verifica 0 errores de tipado y empaqueta frontend y backend para producción.*

* **Restaurar datos sintéticos de prueba:**
  Si realizaste transacciones de prueba que alteraron los saldos en los CSV mock (`data/`):
  ```bash
  npm run data:reset
  ```

---

## 📱 Cómo Probar los Escenarios de la Demo

Una vez abierta la aplicación (`http://localhost:5173`), utiliza el panel lateral **Demo Controller**:

1. **Escenario 1 — Gasto Extraordinario en Salud (Hospital Ángeles):**
   * Haz clic en *"Gasto Médico Mayor"*.
   * Observa el **Smart Action Banner** en el dashboard. Al tocarlo, el agente genera la pantalla A2UI con la métrica del impacto, el plan a Meses Sin Intereses (MSI) y el slider interactivo.
   * Puedes interactuar en el chat preguntando: *"¿Qué tanto me comió este pago de mi saldo?"* o *"¿Cómo quedan los meses?"*.
   * Selecciona el plazo deseado y autoriza con el botón de **SoftToken** usando el código sugerido en pantalla.
2. **Escenario 2 — Sobrecosto en Servicio y Anualidad (CFE / Tarjeta):**
   * Alterna al usuario Rubén Pérez o haz clic en *"Sobrecosto CFE"*.
   * El agente desplegará la comparativa de consumo histórico con `TrendHistoryChart`, ofreciendo la domiciliación para condonar el 100% de la anualidad bancaria.
3. **Escenario 3 — Rescate de Liquidez pre-nómina:**
   * Simula y autoriza un **Adelanto de Nómina** inmediato calibrando el monto con el slider interactivo.

---

## 📂 Estructura del Repositorio

```
├── data/                          # CSVs de datos bancarios sintéticos (usuarios, tarjetas, transacciones)
├── frontend/                      # Aplicación React + Vite + Tailwind (Shell móvil Banorte + lienzo A2UI)
│   ├── src/a2ui/                  # Renderizador dinámico y catálogo de componentes A2UI
│   ├── src/components/            # Componentes visuales (gráficas de dona, tendencias, sliders, tablas)
│   └── src/App.jsx                # Orquestador del ciclo de vida del cliente y chat
├── mcp-agent/                     # Backend TypeScript + Servidor MCP + Orquestador
│   ├── src/agent/                 # Definición del agente LLM y contrato de esquemas A2UI (Zod)
│   ├── src/backend/               # Servidor Fastify (REST + SSE)
│   ├── src/mcp/                   # Servidor MCP Bancario con herramientas Human-in-the-Loop
│   └── task.md                    # System prompt y directivas de generación del agente
├── docs/                          # Documentación técnica de arquitectura y diseño
├── spec.md                        # Especificación funcional de requerimientos (RF)
└── ARCHITECTURE.md                # Contrato sagrado de arquitectura del sistema
```
