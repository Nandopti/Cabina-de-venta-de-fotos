import { getPrice } from "../../server/codi.js";

export default function handler(req, res) {
  res.status(200).json(getPrice(process.env));
}
