import { handleApi } from "../lib/api-handler.mjs";

export default function handler(req, res) {
  const path = `/${[req.query.path].flat().filter(Boolean).join("/")}`;
  return handleApi(req, res, `/api${path}`);
}
