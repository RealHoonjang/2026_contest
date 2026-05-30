/**
 * 프로덕션: 정적 파일 + 백엔드 프록시
 * 개발: `npm run dev`(Vite)만 써도 동일 경로가 Vite 미들웨어에서 처리됩니다.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";
import { forwardCnetGetOpenApi, forwardInspct } from "./careernetProxy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });

const PORT = Number(process.env.PORT) || 3000;
const API_KEY =
  process.env.CAREERNET_API_KEY ||
  process.env.CAREERNET_SERVICE_KEY ||
  "";

const app = express();

app.disable("x-powered-by");

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "https://realhoonjang.github.io,http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/backend/health", (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(API_KEY),
  });
});

app.get("/api/backend/cnet/openapi/getOpenApi", async (req, res) => {
  try {
    const out = await forwardCnetGetOpenApi(req.query, API_KEY);
    res.status(out.status);
    res.setHeader("Content-Type", out.contentType);
    res.send(out.body);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "요청 처리 중 오류가 났습니다." });
  }
});

app.use("/api/backend/inspct", async (req, res) => {
  try {
    const pathAndQuery = req.url || "/";
    const out = await forwardInspct(pathAndQuery, API_KEY);
    res.status(out.status);
    res.setHeader("Content-Type", out.contentType);
    res.send(out.body);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "요청 처리 중 오류가 났습니다." });
  }
});

const dist = path.join(root, "public");
const hasPublic = fs.existsSync(path.join(dist, "index.html"));

if (hasPublic) {
  app.use(express.static(dist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(
    `[server] http://localhost:${PORT}  (인증키 ${API_KEY ? "로드됨" : "없음"})`,
  );
  if (hasPublic) console.log(`[server] 정적: ${dist}`);
});
