// 耗損 App 的後端邏輯。store 由呼叫端注入（正式環境是 Netlify Blobs），方便本機測試。
import { DEFAULT_ITEMS, CATEGORIES } from "./items.mjs";

const ITEMS_KEY = "config/items";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const REASONS = ["過期", "做錯", "客退", "掉落／污染", "備太多", "其他"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (status, message) => json({ error: message }, status);

const clip = (v, n) => String(v ?? "").trim().slice(0, n);
const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const round2 = (n) => Math.round(n * 100) / 100;

function isAdmin(req, env) {
  const pw = env.ADMIN_PASSWORD;
  return Boolean(pw) && req.headers.get("x-admin-password") === pw;
}

// 舊版存的品項沒有 grams 欄位：從預設品項或名稱裡的「（75g）」補上，並把名稱裡的克數拿掉。
const GRAM_SUFFIX = /（(\d+(?:\.\d+)?)g）$/;
function upgradeItem(it) {
  if (it.grams !== undefined || it.floating) return it;
  const d = DEFAULT_ITEMS.find((x) => x.id === it.id);
  const m = GRAM_SUFFIX.exec(it.name || "");
  const grams = (d && d.grams) || (m ? Number(m[1]) : null);
  if (!grams) return { ...it, grams: null };
  return { ...it, grams, name: (it.name || "").replace(GRAM_SUFFIX, "") || it.name };
}

async function readItems(store) {
  const items = await store.get(ITEMS_KEY, { type: "json" });
  return Array.isArray(items) ? items.map(upgradeItem) : DEFAULT_ITEMS;
}

const isWeighed = (it) => !it.floating && Number(it.grams) > 0;

function cleanItem(raw, i) {
  const name = clip(raw.name, 40);
  if (!name) return null;
  const id = clip(raw.id, 40).replace(/[^A-Za-z0-9_-]/g, "") || "item-" + Date.now().toString(36) + "-" + i;
  const cat = CATEGORIES.includes(raw.cat) ? raw.cat : "其他";
  return {
    id, name, cat,
    unit: clip(raw.unit, 10) || "份",
    price: raw.floating ? null : toNum(raw.price),
    floating: Boolean(raw.floating),
    grams: raw.floating ? null : (toNum(raw.grams) || null),
    active: raw.active !== false,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : i + 1,
    note: clip(raw.note, 80) || undefined,
  };
}

// 讀寫某一天的紀錄陣列，用 ETag 做樂觀鎖，同時有人記錄也不會互相蓋掉。
async function updateDay(store, date, mutate) {
  const key = "day/" + date;
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await store.getWithMetadata(key, { type: "json" });
    const list = cur && Array.isArray(cur.data) ? cur.data : [];
    const next = mutate(list.slice());
    if (next === null) return { ok: false, reason: "not_found" };
    const res = cur
      ? await store.setJSON(key, next, { onlyIfMatch: cur.etag })
      : await store.setJSON(key, next, { onlyIfNew: true });
    if (res.modified) return { ok: true, list: next };
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 200));
  }
  return { ok: false, reason: "busy" };
}

async function readDay(store, date) {
  const list = await store.get("day/" + date, { type: "json" });
  return Array.isArray(list) ? list : [];
}

export async function handle(req, store, env = {}) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method.toUpperCase();

  try {
    // ---- 品項 ----
    if (path === "/api/items" && method === "GET") {
      return json({ items: await readItems(store), categories: CATEGORIES, reasons: REASONS });
    }
    if (path === "/api/items" && method === "PUT") {
      if (!isAdmin(req, env)) return fail(401, "主管密碼不正確");
      const body = await req.json().catch(() => null);
      if (!body || !Array.isArray(body.items)) return fail(400, "資料格式不正確");
      const items = body.items.map(cleanItem).filter(Boolean);
      const ids = new Set();
      for (const it of items) { if (ids.has(it.id)) it.id += "-" + Math.random().toString(36).slice(2, 6); ids.add(it.id); }
      await store.setJSON(ITEMS_KEY, items);
      return json({ items });
    }
    if (path === "/api/admin/check" && method === "POST") {
      if (!env.ADMIN_PASSWORD) return fail(500, "尚未設定主管密碼（ADMIN_PASSWORD）");
      return isAdmin(req, env) ? json({ ok: true }) : fail(401, "主管密碼不正確");
    }

    // ---- 紀錄 ----
    if (path === "/api/logs" && method === "GET") {
      const date = url.searchParams.get("date");
      const month = url.searchParams.get("month");
      if (date && DATE_RE.test(date)) return json({ logs: await readDay(store, date) });
      if (month && MONTH_RE.test(month)) {
        const { blobs } = await store.list({ prefix: "day/" + month });
        const days = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
        return json({ logs: days.filter(Array.isArray).flat() });
      }
      return fail(400, "請提供 date=YYYY-MM-DD 或 month=YYYY-MM");
    }
    if (path === "/api/logs" && method === "POST") {
      const b = await req.json().catch(() => null);
      if (!b) return fail(400, "資料格式不正確");
      const date = clip(b.date, 10);
      if (!DATE_RE.test(date)) return fail(400, "日期格式不正確");
      const items = await readItems(store);
      const item = items.find((i) => i.id === b.itemId);
      if (!item) return fail(400, "找不到這個品項，請重新整理頁面");
      const qty = toNum(b.qty);
      if (!qty) return fail(400, "數量要大於 0");
      const by = clip(b.by, 20);
      if (!by) return fail(400, "請填記錄人");
      // 固定價品項一律用後台單價；浮動價（蔬菜）用記錄時輸入的每斤價格
      const price = item.floating ? toNum(b.price) : (item.price ?? toNum(b.price));
      // 秤重品項：qty 是秤到的克數，金額 = 克數 ÷ 每份克數 × 每份成本
      const weighed = isWeighed(item);
      const portions = weighed ? qty / Number(item.grams) : qty;
      const rec = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        date,
        period: b.period === "下午" ? "下午" : "上午",
        itemId: item.id, name: item.name, cat: item.cat, unit: weighed ? "g" : item.unit,
        ...(weighed ? { portionG: Number(item.grams) } : {}),
        qty: round2(qty), price, amount: price == null ? null : round2(portions * price),
        reason: REASONS.includes(b.reason) ? b.reason : "其他",
        note: clip(b.note, 60), by, createdAt: Date.now(),
      };
      const r = await updateDay(store, date, (list) => (list.push(rec), list));
      if (!r.ok) return fail(503, "同時太多人記錄，請再按一次");
      return json({ log: rec }, 201);
    }
    if (path === "/api/logs" && method === "DELETE") {
      const date = url.searchParams.get("date");
      const id = url.searchParams.get("id");
      if (!date || !DATE_RE.test(date) || !id) return fail(400, "缺少日期或編號");
      const r = await updateDay(store, date, (list) => {
        const i = list.findIndex((l) => l.id === id);
        if (i < 0) return null;
        list.splice(i, 1);
        return list;
      });
      if (!r.ok && r.reason === "not_found") return fail(404, "這筆紀錄已經不存在");
      if (!r.ok) return fail(503, "同時太多人修改，請再按一次");
      return json({ ok: true });
    }
    return fail(404, "找不到這個功能");
  } catch (e) {
    return fail(500, "伺服器暫時出錯，請稍後再試");
  }
}
