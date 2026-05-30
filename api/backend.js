import { forwardCnetGetOpenApi, forwardInspct } from "../server/careernetProxy.mjs";

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function pathSegments(req) {
  const fullPath = req.query.fullPath;
  if (fullPath != null && fullPath !== "") {
    const raw = Array.isArray(fullPath) ? fullPath.join("/") : String(fullPath);
    return raw.split("/").filter(Boolean);
  }
  const u = (req.url || "").split("?")[0];
  const prefix = "/api/backend/";
  if (u.startsWith(prefix)) {
    const rest = u.slice(prefix.length);
    return rest ? rest.split("/").filter(Boolean) : [];
  }
  return [];
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
      delete queryObj.fullPath;
      const out = await forwardCnetGetOpenApi(queryObj, apiKey);
      setCors(req, res);
      res.status(out.status);
      res.setHeader("Content-Type", out.contentType);
      return res.send(out.body);
    }

    if (parts[0] === "inspct") {
      const rest = `/${parts.slice(1).join("/")}`;
      const url = new URL(req.url || "/", "http://localhost");
      const out = await forwardInspct(`${rest}${url.search}`, apiKey);
      setCors(req, res);
      res.status(out.status);
      res.setHeader("Content-Type", out.contentType);
      return res.send(out.body);
    }

    setCors(req, res);
    return res.status(404).json({ error: "경로를 찾을 수 없습니다." });
  } catch (e) {
    console.error(e);
    setCors(req, res);
    return res.status(500).json({ error: "요청 처리 중 오류가 났습니다." });
  }
}
