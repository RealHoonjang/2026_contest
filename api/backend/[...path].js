import { forwardCnetGetOpenApi, forwardInspct } from "../../server/careernetProxy.mjs";

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS ||
    "https://realhoonjang.github.io,http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function pathSegments(req) {
  const raw = req.query.path;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET만 지원합니다." });

  const apiKey =
    process.env.CAREERNET_API_KEY || process.env.CAREERNET_SERVICE_KEY || "";
  const parts = pathSegments(req);

  if (parts.join("/") === "health") {
    return res.json({ ok: true, hasKey: Boolean(apiKey) });
  }

  try {
    if (parts[0] === "cnet") {
      const queryObj = { ...req.query };
      delete queryObj.path;
      const out = await forwardCnetGetOpenApi(queryObj, apiKey);
      res.status(out.status);
      res.setHeader("Content-Type", out.contentType);
      return res.send(out.body);
    }

    if (parts[0] === "inspct") {
      const rest = `/${parts.slice(1).join("/")}`;
      const url = new URL(req.url || "/", "http://localhost");
      const out = await forwardInspct(`${rest}${url.search}`, apiKey);
      res.status(out.status);
      res.setHeader("Content-Type", out.contentType);
      return res.send(out.body);
    }

    return res.status(404).json({ error: "경로를 찾을 수 없습니다." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "요청 처리 중 오류가 났습니다." });
  }
}
