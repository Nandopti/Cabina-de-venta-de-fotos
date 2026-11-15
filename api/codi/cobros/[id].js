import { getCharge } from "../../../server/codi.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido." });
  try {
    res.status(200).json(await getCharge(req.query.id, process.env));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Error de pago." });
  }
}
