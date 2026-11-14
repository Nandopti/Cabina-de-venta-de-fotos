/**
 * Cliente del pago. Corre en el navegador.
 *
 * No llama a CoDi directamente y no conoce la llave secreta.
 * Solo habla con las rutas /api/codi/*, que en desarrollo atiende
 * Vite (vite.config.js) usando la lógica de server/codi.js.
 *
 * Librería: ninguna. fetch() ya viene en el navegador.
 * El QR se dibuja en otro archivo con la librería `qrcode`,
 * porque el navegador no trae un generador de códigos QR.
 */

async function request(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "No pude completar el pago.");
  }
  return data;
}

export function fetchPrice() {
  return request("/api/codi/precio");
}

export function createCharge() {
  return request("/api/codi/cobros", { method: "POST", body: "{}" });
}

export function fetchCharge(id) {
  return request(`/api/codi/cobros/${encodeURIComponent(id)}`);
}

export function simulateCharge(id) {
  return request(`/api/codi/cobros/${encodeURIComponent(id)}/simular-pago`, {
    method: "POST",
    body: "{}",
  });
}
