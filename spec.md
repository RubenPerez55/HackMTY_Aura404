# Especificación Funcional: Banorte ShockAbsorber
### Guardián Proactivo de Gastos Recurrentes y Estabilizador de Salud Financiera
**Documento:** `spec.md` • **Versión:** 1.0.0 • **Tipo:** Contrato Funcional (El QUÉ)

---

## 1. Objetivo y Contexto del Feature

### 1.1 Problema de Negocio
Los clientes de banca personal enfrentan desbalances financieros imprevistos causados por tres eventos cotidianos:
1. **Picos atípicos en servicios fijos:** Facturación bimestral de luz (CFE) o gas con incrementos drásticos sobre su consumo habitual (ej. +70% en verano).
2. **Renovaciones anuales olvidadas:** Cobro de anualidades de tarjetas de crédito o pólizas de seguros que vencen sorpresivamente en quincenas ajustadas.
3. **Golpes de liquidez por compras extraordinarias:** Egresos indispensables o de emergencia (médicos, reparaciones) que consumen el 80% o más del saldo en cuenta, dejando al usuario en riesgo de insolvencia para sus gastos básicos diarios.

Las aplicaciones bancarias actuales son **reactivas y estáticas**: notifican el cargo cuando el dinero ya salió de la cuenta y obligan al usuario a resolver el estrés por su cuenta, buscando opciones en menús complejos o recurriendo a créditos con altos intereses.

### 1.2 Objetivo del Producto
Desarrollar una experiencia financiera proactiva e hiperpersonalizada dentro de la banca móvil que:
* Detecte automáticamente estos desbalances antes o en el instante en que ocurren.
* Reemplace los chatbots tradicionales por una interfaz generada dinámicamente adaptada a la naturaleza del desbalance.
* Permita al usuario neutralizar el impacto económico mediante herramientas del propio banco (canje de puntos de lealtad, exención de comisiones por domiciliación, o diferimiento de compras a plazos) en un ciclo interactivo cerrado y con autorización segura.

---

## 2. Requisitos Funcionales

Los comportamientos observables del sistema se definen bajo el estándar *Dado / Cuando / Entonces*:

### RF-01: Detección Proactiva y Activación sin Chatbot
* **RF-01.1 (Trigger por Pico de Servicio):**
  * **Dado** que un cargo por servicio recurrente excede en un 40% o más el promedio histórico del cliente,
  * **Cuando** el usuario ingresa a la aplicación bancaria o consulta sus movimientos,
  * **Entonces** el sistema presenta un banner de acción inteligente destacando el sobrecosto exacto y ofreciendo alternativas de amortiguamiento sin requerir que el usuario redacte un mensaje de texto.
* **RF-01.2 (Trigger por Renovación Anual Inminente):**
  * **Dado** que una comisión anual programada (anualidad de tarjeta) tiene una fecha de cobro prevista en 5 días o menos,
  * **Cuando** el usuario visualiza su posición financiera,
  * **Entonces** el sistema despliega una alerta preventiva indicando la fecha de vencimiento y ofreciendo vías de exención antes de que ocurra el débito automático.
* **RF-01.3 (Trigger por Golpe de Liquidez):**
  * **Dado** que una transacción individual consume el 75% o más del saldo disponible en la cuenta y deja el presupuesto diario por debajo del nivel de subsistencia quincenal,
  * **Cuando** se confirma el movimiento,
  * **Entonces** el sistema genera una alerta de estabilización de liquidez informando los días restantes para la siguiente dispersión de nómina y proponiendo opciones para recuperar el saldo en cuenta.

### RF-02: Generación Dinámica de la Interfaz (A2UI)
* **RF-02.1 (Composición Adaptable):**
  * **Dado** un desbalance detectado,
  * **Cuando** el usuario accede a la alerta,
  * **Entonces** el sistema genera en tiempo real una interfaz visual compuesta específicamente para ese caso, mostrando el desglose comparativo de la anomalía y los controles interactivos pertinentes para resolverlo.
* **RF-02.2 (Hiperpersonalización de Soluciones):**
  * **Dado** el perfil de productos del cliente,
  * **Cuando** se formula la interfaz de resolución,
  * **Entonces** el sistema solo presenta opciones viables con sus productos vigentes (ej. canje de puntos únicamente si cuenta con saldo suficiente; domiciliaciones únicamente para servicios detectados no domiciliados).

### RF-03: Interacción Bidireccional en Tiempo Real (Ciclo Cerrado)
* **RF-03.1 (Ajuste de Puntos de Lealtad):**
  * **Dado** el caso de un pico de servicio,
  * **Cuando** el usuario selecciona la opción de pagar el excedente con puntos,
  * **Entonces** la interfaz recalcula al instante el cargo neto a débito, mostrando la reducción del impacto a \$0 pesos adicionales sobre su consumo normal.
* **RF-03.2 (Conmutación de Domiciliaciones para Exención):**
  * **Dado** el caso de una anualidad por vencer,
  * **Cuando** el usuario activa los interruptores de domiciliación de servicios sugeridos,
  * **Entonces** la interfaz actualiza en vivo el costo de la anualidad, mostrando visualmente la exención a \$0 MXN.
* **RF-03.3 (Recálculo de Saldo en Desbalance de Liquidez):**
  * **Dado** el caso de un golpe de liquidez,
  * **When** el usuario desliza el control de plazos (ej. 3, 6 o 12 meses),
  * **Entonces** la representación visual del saldo disponible en cuenta se recalcula en vivo, mostrando el incremento inmediato de liquidez recuperada y el monto de la cuota mensual fija.

### RF-04: Ejecución y Autorización Segura (Human-in-the-Loop)
* **RF-04.1 (Requisito de Segundo Factor):**
  * **Dado** cualquier plan de alivio configurado por el usuario,
  * **Cuando** el usuario pulsa la acción de confirmación,
  * **Entonces** el sistema solicita de forma obligatoria un código dinámico de autenticación de dos factores (SoftToken) antes de aplicar cualquier movimiento de fondos, domiciliación o diferimiento.
* **RF-04.2 (Confirmación Transaccional):**
  * **Dado** un token de seguridad válido,
  * **Cuando** se procesa la operación,
  * **Entonces** el sistema actualiza de inmediato el saldo real, emite un comprobante con folio bancario y retira la alerta de desbalance.

---

## 3. Requisitos No Funcionales

* **RNF-01 (Latencia de Detección):** La evaluación determinista de reglas sobre transacciones debe completarse en menos de **50 milisegundos**.
* **RNF-02 (Latencia de Generación de Interfaz):** El tiempo total desde que el usuario toca la alerta hasta que la interfaz interactiva está completamente renderizada debe ser menor a **2.5 segundos**.
* **RNF-03 (Resiliencia Operativa):** Ante cualquier degradación o indisponibilidad del servicio de inferencia de lenguaje, el sistema debe presentar la interfaz interactiva de respaldo en menos de **500 milisegundos** sin interrumpir la experiencia ni mostrar pantallas de error.
* **RNF-04 (Diseño Adaptable):** La interfaz generada debe ser totalmente responsiva, diseñada bajo principios *mobile-first* y operable mediante controles táctiles directos (botones, deslizadores e interruptores).

---

## 4. Casos Límite y Manejo de Errores

* **E-01 (Saldo de Puntos Parcial):** Si el cliente tiene puntos acumulados pero no cubren el 100% del excedente del servicio, el sistema debe permitir la aplicación del saldo máximo de puntos disponible y calcular el saldo restante a pagar en débito o tarjeta.
* **E-02 (Token de Seguridad Inválido o Vencido):** Si el usuario ingresa un código de dos factores incorrecto o con longitud distinta a 6 dígitos, el sistema debe mostrar un mensaje de error descriptivo manteniendo intacta la configuración seleccionada sin forzar a reiniciar el flujo.
* **E-03 (Compra no Elegible para Pagos Fijos):** Si una compra no cumple con el monto mínimo requerido para diferimiento (\$500 MXN), la opción de plazos debe deshabilitarse y ofrecer como alternativa un ajuste de presupuesto diario.
* **E-04 (Cancelación del Flujo por el Usuario):** Si el usuario decide cerrar la interfaz de alivio sin autorizar, ningún fondo debe moverse y la alerta debe permanecer disponible en la bandeja con su estado original.

---

## 5. Criterios de Aceptación

Para considerar este feature como completado y listo para evaluación, deben satisfacerse las siguientes pruebas verificables:

1. [ ] **Prueba de Trigger Proactivo:** Al cargar el estado con un recibo de servicio con incremento del 70%, la vista principal muestra un banner contextual con el monto exacto del sobrecosto sin requerir interacción por chat de texto.
2. [ ] **Prueba de Adaptabilidad de Interfaz:** La pantalla resultante para el caso de pico de servicio muestra gráficos comparativos y opciones de puntos; la pantalla para la anualidad muestra interruptores de domiciliación; y la pantalla para el golpe de liquidez muestra el control deslizante de plazos.
3. [ ] **Prueba de Ciclo Bidireccional:** Al mover el control deslizante de plazos en el golpe de liquidez, la cifra de saldo proyectado se actualiza en pantalla antes de confirmar.
4. [ ] **Prueba de Gobernanza 2FA:** Ninguna operación financiera (puntos, domiciliación o diferimiento) puede concluir con éxito sin ingresar un código dinámico de 6 dígitos.
5. [ ] **Prueba de Impacto Real en Saldos:** Tras autorizar la operación, el estado de la cuenta refleja el nuevo saldo disponible o la condonación de la comisión correspondiente.

---

## 6. Fuera de Alcance (Out of Scope)

* Integración con hardware biométrico nativo del sistema operativo (sensores de huella o escáner facial de dispositivos móviles).
* Liquidación de créditos o préstamos en estado de mora legal o cobranza judicial (>90 días de atraso).
* Emisión y envío físico de plásticos de tarjetas de crédito o débito a domicilio.
* Apertura de nuevas cuentas bancarias para usuarios no registrados previamente en el banco.
