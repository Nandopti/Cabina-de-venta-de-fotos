/**
 * HTTP de la cabina para /api/codi/*.
 *
 * Vite lo monta en vite.config.js mientras desarrollas y en `npm run preview`.
 * En un hosting estático (solo la carpeta dist/) estas rutas NO existen:
 * hay que publicar este manejador en un backend y hacer que /api llegue ahí.
 * El ejemplo con Express está en server/CODI.md.
 *
 * Este archivo no habla con el banco. Solo valida la petición del navegador
 * y llama a server/codi.js.
 *
 * Rechaza cuerpos que traigan datos de tarjeta. Si alguien intenta mandar
 * un PAN o un CVV a esta cabina, la petición se corta.
 */

import { createCobro, getCobro, getCobroByRef, getPublicConfig, simulatePayment } from "./codi.js";

const CARD_KEYS = [
  "pan",
  "card",
  "cardnumber",
  "numerotarjeta",
  "cvv",
  "cvc",
  "nip",
  "pin",
  "expiracion",
  "expiry",
];

export async function handleCodiApi(req, res, env) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/codi")) return false;

  try {
    if (req.method === "GET" && url.pathname === "/api/codi/config") {
      return send(res, 200, getPublicConfig(env));
    }

    if (req.method === "POST" && url.pathname === "/api/codi/cobros") {
      const body = await readJson(req);
      rejectCardData(body);
      const cobro = await createCobro({ concept: body.concept }, env);
      return send(res, 201, cobro);
    }

    if (req.method === "GET" && url.pathname === "/api/codi/cobros") {
      const ref = url.searchParams.get("ref");
      if (!ref) return send(res, 400, { error: "Falta la referencia." });
      const cobro = await getCobroByRef(ref, env);
      if (!cobro) return send(res, 404, { error: "Cobro no encontrado." });
      return send(res, 200, cobro);
    }

    const one = url.pathname.match(/^\/api\/codi\/cobros\/([^/]+)$/);
    if (req.method === "GET" && one) {
      const cobro = await getCobro(decodeURIComponent(one[1]), env);
      if (!cobro) return send(res, 404, { error: "Cobro no encontrado." });
      return send(res, 200, cobro);
    }

    const simulation = url.pathname.match(/^\/api\/codi\/cobros\/([^/]+)\/simular-pago$/);
    if (req.method === "POST" && simulation) {
      const cobro = await simulatePayment(decodeURIComponent(simulation[1]), env);
      return send(res, 200, cobro);
    }

    return send(res, 404, { error: "Ruta de pago no encontrada." });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("[codi]", error.message);
    return send(res, status, { error: error.message || "Error interno." });
  }
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
  return true;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > 20_000) {
        reject(fail(413, "La petición es demasiado grande."));
        req.destroy();
      } else {
        chunks.push(buf);
      }
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(fail(400, "El cuerpo tiene que ser un objeto JSON."));
          return;
        }
        resolve(parsed);
      } catch {
        reject(fail(400, "JSON inválido."));
      }
    });
    req.on("error", () => reject(fail(400, "No se pudo leer la petición.")));
  });
}

function rejectCardData(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (CARD_KEYS.includes(key.toLowerCase().replace(/[_-]/g, ""))) {
      throw fail(400, "Esta cabina no acepta datos de tarjeta. El banco los pide en su propia página.");
    }
    if (nested && typeof nested === "object") rejectCardData(nested);
  }
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
