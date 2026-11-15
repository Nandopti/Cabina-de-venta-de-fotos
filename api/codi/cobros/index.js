import { createCharge } from "../../../server/codi.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  try {
    const origin = `https://${req.headers.host}`;
    res.status(201).json(await createCharge(process.env, origin));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Error de pago." });
  }
}
