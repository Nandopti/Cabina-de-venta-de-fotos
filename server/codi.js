/**
 * ============================================================
 *  AQUÍ SE CONECTA LA API DE CODI
 * ============================================================
 *
 * CoDi (Cobro Digital) es el esquema de Banco de México para cobrar
 * con un QR que el cliente paga desde la app de su banco.
 *
 * Banxico no ofrece una API REST pública para que cualquier sitio
 * genere cobros. En la práctica contratas a un participante o
 * agregador (tu banco, o un procesador que hable CoDi) y él te da
 * una URL, una llave y un PDF con los nombres de los campos.
 *
 * Este archivo es el único lugar que debe conocer esa API.
 * El navegador solo llama a /api/codi/* (ver src/payments/codi-client.js).
 * La llave NUNCA se manda al frontend: Vite no expone variables sin
 * el prefijo VITE_, y aquí se leen con process / loadEnv en el servidor.
 *
 * Contrato interno (lo que el resto de la cabina espera):
 *
 *   {
 *     id: string,
 *     reference: string,
 *     amount: number,          // pesos MXN
 *     currency: "MXN",
 *     concept: string,
 *     status: "pendiente" | "aprobado" | "expirado",
 *     qrPayload: string,       // texto exacto que se dibuja en el QR
 *     checkoutUrl: string,     // página donde se paga con tarjeta
 *     expiresAt: string,       // ISO 8601
 *     mode: "mock" | "live"
 *   }
 *
 * Tarjetas:
 *   Esta plantilla no pide número de tarjeta, vencimiento ni CVV.
 *   Eso lo captura el banco o el procesador en checkoutUrl (página PCI).
 *   CoDi, por sí mismo, cobra desde la app del banco (cuenta / débito
 *   vía SPEI), no por la red de Visa o Mastercard.
 *   Si tu proveedor además devuelve una página de tarjeta, pégala en
 *   checkoutUrl dentro de mapProviderResponse(). El botón
 *   "Pagar con tarjeta" abre esa dirección.
 *
 * Modo mock (PAYMENT_MODE=mock, el valor por defecto):
 *   Genera un QR que NO es un cobro real. Sirve para recorrer la cabina.
 *   El botón de simular marca el cobro como aprobado solo en memoria.
 *
 * Para cobrar de verdad:
 *   1. Copia .env.example a .env
 *   2. PAYMENT_MODE=live
 *   3. Llena CODI_API_BASE_URL, CODI_API_KEY y CODI_COMMERCE_ID
 *   4. Ajusta requestLiveCharge() y mapProviderResponse() a tu PDF
 *   5. Implementa la firma en applyWebhook() antes de fiarte del aviso
 *   6. Publica este módulo en un backend. Un hosting solo de archivos
 *      estáticos (la carpeta dist/) no ejecuta este código.
 */

const CONCEPT = "Retrato digital — cabina";
const charges = new Map();

export function getPrice(env) {
  return {
    amount: priceAmount(env),
    currency: "MXN",
    concept: CONCEPT,
  };
}

export async function createCharge(env, origin = "") {
  const price = getPrice(env);
  const id = crypto.randomUUID();
  const reference = `CAB-${Date.now().toString(36).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const mode = paymentMode(env);

  const charge = {
    id,
    reference,
    amount: price.amount,
    currency: price.currency,
    concept: price.concept,
    status: "pendiente",
    expiresAt,
    mode,
    providerId: null,
    qrPayload: "",
    checkoutUrl: "",
  };

  if (mode === "live") {
    const remote = await requestLiveCharge(charge, env, origin);
    charge.providerId = remote.providerId;
    charge.qrPayload = remote.qrPayload;
    charge.checkoutUrl = remote.checkoutUrl;
    if (remote.expiresAt) charge.expiresAt = remote.expiresAt;
  } else {
    charge.qrPayload = [
      "CABINA-DEMO",
      "ESTE QR NO ES UN COBRO",
      `ref=${charge.reference}`,
      `monto=${charge.amount} MXN`,
      charge.concept,
    ].join("|");
    charge.checkoutUrl = `${publicBase(env, origin)}/?paso=banco&cobro=${charge.id}`;
  }

  charges.set(charge.id, charge);
  return present(charge);
}

export async function getCharge(id, env) {
  const charge = requireCharge(id);
  refreshExpiry(charge);
  if (charge.mode === "live" && charge.status === "pendiente") {
    charge.status = await requestLiveStatus(charge, env);
  }
  return present(charge);
}

export async function simulatePayment(id, env) {
  const charge = requireCharge(id);
  if (paymentMode(env) !== "mock" || charge.mode !== "mock") {
    throw httpError(403, "La simulación solo existe en PAYMENT_MODE=mock.");
  }
  refreshExpiry(charge);
  if (charge.status === "expirado") {
    throw httpError(409, "Este cobro ya venció. Genera otro QR.");
  }
  charge.status = "aprobado";
  return present(charge);
}

/**
 * Aviso del proveedor de que el QR ya se pagó, aunque el cliente no
 * regrese al navegador. La ruta es POST /api/codi/webhook.
 *
 * En live esta función se niega hasta que verifiques la firma.
 * Si marcaras el cobro como pagado solo porque llegó un JSON, cualquiera
 * podría confirmar pagos sin haber cobrado.
 */
export function applyWebhook(body, env) {
  if (paymentMode(env) !== "mock") {
    throw httpError(
      501,
      "Configura la verificación de firma en applyWebhook() antes de usar el webhook en vivo.",
    );
  }

  const id = body?.cobroId;
  if (!id || !charges.has(id)) {
    throw httpError(404, "Cobro no encontrado para el webhook de demostración.");
  }
  const charge = charges.get(id);
  charge.status = "aprobado";
  return present(charge);
}

/**
 * ------------------------------------------------------------
 *  Llamada real al proveedor. Edita este bloque con su PDF.
 * ------------------------------------------------------------
 *
 * Ejemplo de forma, no de un estándar único de Banxico:
 *
 *   POST {CODI_API_BASE_URL}/cobros
 *   Authorization: Bearer {CODI_API_KEY}
 *   {
 *     "monto": 49,
 *     "moneda": "MXN",
 *     "concepto": "Retrato digital — cabina",
 *     "referencia": "CAB-...",
 *     "idComercio": "...",
 *     "vigenciaMinutos": 15,
 *     "urlRetorno": "https://tu-cabina/?paso=listo&cobro=..."
 *   }
 *
 * Si tu proveedor usa otros nombres, firma HMAC o un certificado,
 * cámbialos aquí. El resto de la cabina no debería enterarse.
 */
async function requestLiveCharge(charge, env, origin) {
  const baseUrl = requiredEnv(env, "CODI_API_BASE_URL");
  const apiKey = requiredEnv(env, "CODI_API_KEY");
  const commerceId = env.CODI_COMMERCE_ID || "";

  const response = await fetch(`${trimSlash(baseUrl)}/cobros`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      monto: charge.amount,
      moneda: charge.currency,
      concepto: charge.concept,
      referencia: charge.reference,
      idComercio: commerceId,
      vigenciaMinutos: 15,
      urlRetorno: `${publicBase(env, origin)}/?paso=listo&cobro=${charge.id}`,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.message || data.error || response.statusText;
    throw httpError(502, `El proveedor CoDi rechazó el cobro: ${detail}`);
  }

  return mapProviderResponse(data);
}

async function requestLiveStatus(charge, env) {
  const baseUrl = requiredEnv(env, "CODI_API_BASE_URL");
  const apiKey = requiredEnv(env, "CODI_API_KEY");
  const remoteId = charge.providerId || charge.id;

  const response = await fetch(`${trimSlash(baseUrl)}/cobros/${encodeURIComponent(remoteId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) return charge.status;
  const data = await response.json().catch(() => ({}));
  return normalizeStatus(data.status ?? data.estado ?? charge.status);
}

/**
 * Traduce la respuesta del proveedor al contrato de esta cabina.
 * Revisa los nombres reales (qr, cadenaQR, qrCode, urlPago, paymentUrl…)
 * y deja en qrPayload el texto que la app del banco espera escanear.
 * checkoutUrl debe ser la página de tarjeta del proveedor, si la ofrece.
 */
export function mapProviderResponse(data) {
  const qrPayload = data.qrPayload || data.qr || data.cadenaQR || data.qrCode || "";
  const checkoutUrl = data.checkoutUrl || data.urlPago || data.paymentUrl || data.liga || "";
  if (!qrPayload || !checkoutUrl) {
    throw httpError(
      502,
      "La API respondió sin QR o sin página de pago. Ajusta mapProviderResponse() en server/codi.js.",
    );
  }

  return {
    providerId: data.id || data.idCobro || data.chargeId || null,
    qrPayload,
    checkoutUrl,
    expiresAt: data.expiresAt || data.vigencia || null,
  };
}

function present(charge) {
  return {
    id: charge.id,
    reference: charge.reference,
    amount: charge.amount,
    currency: charge.currency,
    concept: charge.concept,
    status: charge.status,
    qrPayload: charge.qrPayload,
    checkoutUrl: charge.checkoutUrl,
    expiresAt: charge.expiresAt,
    mode: charge.mode,
  };
}

function requireCharge(id) {
  const charge = charges.get(id);
  if (!charge) throw httpError(404, "No encontré ese cobro. Genera el QR otra vez.");
  return charge;
}

function refreshExpiry(charge) {
  if (charge.status === "pendiente" && Date.parse(charge.expiresAt) <= Date.now()) {
    charge.status = "expirado";
  }
}

function normalizeStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["aprobado", "approved", "paid", "pagado", "liquidado", "completado"].includes(status)) {
    return "aprobado";
  }
  if (["expirado", "expired", "cancelado", "canceled", "cancelled"].includes(status)) {
    return "expirado";
  }
  return "pendiente";
}

function paymentMode(env) {
  return env.PAYMENT_MODE === "live" ? "live" : "mock";
}

function priceAmount(env) {
  const amount = Number(env.PRICE_MXN || 49);
  if (!Number.isFinite(amount) || amount <= 0) return 49;
  return Math.round(amount * 100) / 100;
}

function publicBase(env, origin) {
  return (env.PUBLIC_BASE_URL || origin || "http://localhost:5173").replace(/\/$/, "");
}

function requiredEnv(env, key) {
  if (!env[key]) {
    throw httpError(500, `Falta ${key} en el archivo .env`);
  }
  return env[key];
}

function trimSlash(value) {
  return value.replace(/\/$/, "");
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
