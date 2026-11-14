/**
 * Vite es la herramienta de desarrollo y el empaquetador.
 * No es un framework de interfaz. Sirve la página, recarga al editar
 * y, aquí, también abre las rutas /api/codi/* hacia server/codi.js.
 *
 * Ese puente existe para que `npm run dev` baste para probar.
 * En producción hay que montar las mismas funciones en un backend
 * (Express, un Worker, el servidor que te dé el banco). La carpeta
 * dist/ que genera `npm run build` es solo HTML, CSS y JavaScript.
 */
import { defineConfig, loadEnv } from "vite";
import {
  applyWebhook,
  createCharge,
  getCharge,
  getPrice,
  simulatePayment,
} from "./server/codi.js";

function codiApi(env) {
  const handle = async (req, res, next) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "api" || parts[1] !== "codi") {
      next();
      return;
    }

    try {
      if (req.method === "GET" && parts.length === 3 && parts[2] === "precio") {
        send(res, 200, getPrice(env));
        return;
      }
      if (req.method === "POST" && parts.length === 3 && parts[2] === "cobros") {
        send(res, 201, await createCharge(env, requestOrigin(req)));
        return;
      }
      if (req.method === "GET" && parts.length === 4 && parts[2] === "cobros") {
        send(res, 200, await getCharge(parts[3], env));
        return;
      }
      if (
        req.method === "POST" &&
        parts.length === 5 &&
        parts[2] === "cobros" &&
        parts[4] === "simular-pago"
      ) {
        send(res, 200, await simulatePayment(parts[3], env));
        return;
      }
      if (req.method === "POST" && parts.length === 3 && parts[2] === "webhook") {
        send(res, 200, applyWebhook(await readJson(req), env));
        return;
      }
      send(res, 404, { error: "Ruta de CoDi no encontrada." });
    } catch (error) {
      send(res, error.status || 500, { error: error.message || "Error de pago." });
    }
  };

  return {
    name: "codi-api",
    configureServer(server) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
  };
}

function requestOrigin(req) {
  const host = req.headers?.host;
  if (!host) return "";
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}`;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("El cuerpo no es JSON válido.");
    error.status = 400;
    throw error;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [codiApi(env)],
    server: {
      host: true,
      port: 5173,
    },
    preview: {
      host: true,
      port: 4173,
    },
  };
});
