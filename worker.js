// 空島後端：保管 TDX 與氣象署金鑰，幫網頁拿金門機場的航班和天氣

// 只有這些網站可以用這個 Worker 的資料
const ALLOWED_ORIGINS = [
  'https://sd9960528-ui.github.io',   // 正式網站
  'http://127.0.0.1:5500',            // 本機 Live Server
  'http://localhost:5500',
  'http://localhost:3000'             // 本機 npx serve
];
function allowOrigin(request) {
  const origin = request.headers.get('Origin');
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

const TOKEN_URL = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
const FIDS_URL  = 'https://tdx.transportdata.tw/api/basic/v2/Air/FIDS/Airport';
const CACHE_SECONDS = 60;   // 航班資料記住 60 秒

// ===== TDX 通行證 =====
let cachedToken = null;
let tokenExpiresAt = 0;
let tokenBlockedUntil = 0;  // 被限流時，這個時間之前都不要再去申請

// ===== 航班資料快取 =====
let cachedData = null;
let dataFetchedAt = 0;

// ===== 天氣資料快取 =====
let weatherCache = null;
let weatherAt = 0;

async function getToken(env) {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  if (Date.now() < tokenBlockedUntil) {
    throw { step: '取得 token 失敗', status: 429, tdx: { message: '剛被 TDX 限流，休息中，請稍後再試' } };
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.TDX_CLIENT_ID.trim(),
      client_secret: env.TDX_CLIENT_SECRET.trim()
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    if (res.status === 429) tokenBlockedUntil = Date.now() + 60 * 1000;
    throw { step: '取得 token 失敗', status: res.status, tdx: data };
  }
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 600) * 1000;
  return cachedToken;
}

// 金門天氣：中央氣象署現在天氣觀測，金門站 467110，記住 5 分鐘
async function handleWeather(cors, env) {
  if (weatherCache && Date.now() - weatherAt < 5 * 60 * 1000) {
    return new Response(weatherCache, { headers: { ...cors, 'X-Kongdao-Cache': 'HIT' } });
  }
  if (!env.CWA_API_KEY) {
    return new Response(JSON.stringify({ ok: false, message: '還沒設定氣象署授權碼 CWA_API_KEY' }), { status: 500, headers: cors });
  }
  try {
    const params = new URLSearchParams({ Authorization: env.CWA_API_KEY.trim(), StationId: '467110', format: 'JSON' });
    const res = await fetch(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001?${params}`);
    const text = await res.text();
    if (res.ok && text.includes('"success":"true"')) {
      weatherCache = text;
      weatherAt = Date.now();
      return new Response(text, { headers: cors });
    }
    if (weatherCache) return new Response(weatherCache, { headers: { ...cors, 'X-Kongdao-Cache': 'STALE' } });
    return new Response(JSON.stringify({ ok: false, step: '天氣資料', status: res.status, message: text.slice(0, 300) }),
      { status: 502, headers: cors });
  } catch (err) {
    if (weatherCache) return new Response(weatherCache, { headers: { ...cors, 'X-Kongdao-Cache': 'STALE' } });
    return new Response(JSON.stringify({ ok: false, message: String(err) }), { status: 502, headers: cors });
  }
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin(request),
      'Vary': 'Origin',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`
    };

    // 天氣走另一條路
    if (new URL(request.url).pathname === '/weather') return handleWeather(cors, env);

    // ===== 以下是航班 =====
    if (!env.TDX_CLIENT_ID || !env.TDX_CLIENT_SECRET) {
      return new Response(JSON.stringify({ ok: false, message: '後端已啟動，但還沒設定 TDX 金鑰' }), { headers: cors });
    }
    if (cachedData && Date.now() - dataFetchedAt < CACHE_SECONDS * 1000) {
      return new Response(cachedData, { headers: { ...cors, 'X-Kongdao-Cache': 'HIT' } });
    }
    try {
      const token = await getToken(env);
      const params = new URLSearchParams({ '$filter': "AirportID eq 'KNH'", '$format': 'JSON' });
      const fidsRes = await fetch(`${FIDS_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip' }
      });
      const text = await fidsRes.text();
      if (fidsRes.ok) {
        cachedData = text;
        dataFetchedAt = Date.now();
      } else if (cachedData) {
        return new Response(cachedData, { headers: { ...cors, 'X-Kongdao-Cache': 'STALE' } });
      }
      return new Response(text, { status: fidsRes.status, headers: { ...cors, 'X-Kongdao-Cache': 'MISS' } });
    } catch (err) {
      if (cachedData) return new Response(cachedData, { headers: { ...cors, 'X-Kongdao-Cache': 'STALE' } });
      const body = err && err.step ? { ok: false, ...err } : { ok: false, message: String(err) };
      return new Response(JSON.stringify(body), { status: 502, headers: cors });
    }
  }
};