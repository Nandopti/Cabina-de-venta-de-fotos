import { applyWebhook } from "../../server/codi.js";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  try {
    res.status(200).json(applyWebhook(req.body || {}, process.env));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Error de pago." });
  }
}
