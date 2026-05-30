/**
 * 진로·학교 데이터 서버 프록시 (Express·Vite 개발 서버 공용)
 */

/**
 * @param {string} pathAndQuery `/openapi/test/questions?q=...` 형태 (앞에 /)
 * @param {string} apiKey
 */
export async function forwardInspct(pathAndQuery, apiKey) {
  if (!apiKey) {
    return {
      status: 503,
      contentType: "application/json; charset=utf-8",
      body: Buffer.from(JSON.stringify({ error: "인증 설정이 필요합니다." }), "utf8"),
    };
  }
  try {
    const pq = (pathAndQuery || "/").startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
    const target = new URL(`https://www.career.go.kr/inspct${pq}`);
    target.searchParams.delete("apikey");
    target.searchParams.delete("apiKey");
    target.searchParams.set("apikey", apiKey);
    const r = await fetch(target.toString(), {
      headers: {
        Accept: "application/json, application/xml, text/xml, */*",
        "User-Agent": "CareerPathfinder/1.0",
      },
    });
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const body = Buffer.from(await r.arrayBuffer());
    return { status: r.status, contentType: ct, body };
  } catch (e) {
    console.error("[forwardInspct]", e);
    return {
      status: 502,
      contentType: "application/json; charset=utf-8",
      body: Buffer.from(
        JSON.stringify({ error: "외부 서비스에 연결하지 못했습니다." }),
        "utf8",
      ),
    };
  }
}

/**
 * @param {Record<string, string | string[] | undefined>} queryObj Express req.query
 * @param {string} apiKey
 */
export async function forwardCnetGetOpenApi(queryObj, apiKey) {
  if (!apiKey) {
    return {
      status: 503,
      contentType: "application/json; charset=utf-8",
      body: Buffer.from(JSON.stringify({ error: "인증 설정이 필요합니다." }), "utf8"),
    };
  }
  try {
    const u = new URL("https://www.career.go.kr/cnet/openapi/getOpenApi");
    for (const [k, raw] of Object.entries(queryObj)) {
      if (String(k).toLowerCase() === "apikey") continue;
      const v = Array.isArray(raw) ? raw[raw.length - 1] : raw;
      if (v === undefined) continue;
      u.searchParams.set(k, String(v));
    }
    u.searchParams.set("apiKey", apiKey);
    const r = await fetch(u.toString(), {
      headers: {
        Accept: "application/json, application/xml, text/xml, */*",
        "User-Agent": "CareerPathfinder/1.0",
      },
    });
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const body = Buffer.from(await r.arrayBuffer());
    return { status: r.status, contentType: ct, body };
  } catch (e) {
    console.error("[forwardCnetGetOpenApi]", e);
    return {
      status: 502,
      contentType: "application/json; charset=utf-8",
      body: Buffer.from(
        JSON.stringify({ error: "외부 서비스에 연결하지 못했습니다." }),
        "utf8",
      ),
    };
  }
}
