import { handleApi } from "../lib/api-handler.mjs";

export default function handler(req, res) {
  return handleApi(req, res, "/api/health");
}
