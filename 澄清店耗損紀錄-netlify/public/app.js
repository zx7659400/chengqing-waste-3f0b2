(function () {
  "use strict";
  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  const $ = (id) => document.getElementById(id);

  const S = {
    online: false, items: [], categories: [], reasons: ["過期", "做錯", "客退", "掉落／污染", "備太多", "其他"],
    logsByMonth: {}, loadingMonth: {},
    tab: "log", period: new Date().getHours() < 14 ? "上午" : "下午",
    sel: null, reason: "過期", day: todayStr(), month: todayStr().slice(0, 7),
    adminPw: load("waste.adminPw") || "", isAdmin: false, editing: null, pendingDelete: null, busy: false,
  };

  function pad(n) { return String(n).padStart(2, "0"); }
  function todayStr() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dayLabel(s) { const [y, m, d] = s.split("-").map(Number); return m + "/" + d + "（" + WEEK[new Date(y, m - 1, d).getDay()] + "）"; }
  function money(n) { const v = Math.round((n || 0) * 10) / 10; return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 1 }); }
  function num(v) { if (v === "" || v == null) return null; const n = parseFloat(v); return isFinite(n) ? n : null; }
  function fmtQty(q) { return (Math.round(q * 100) / 100).toString(); }
  function store(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  let toastTimer;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800); }

  async function api(path, opts = {}) {
    const headers = { "content-type": "application/json" };
    if (opts.admin && S.adminPw) headers["x-admin-password"] = S.adminPw;
    const res = await fetch(path, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) { const err = new Error((data && data.error) || "連線失敗，請再試一次"); err.status = res.status; throw err; }
    return data;
  }
  function setStatus(ok) {
    S.online = ok; $("status").textContent = ok ? "已連線・資料同步中" : "連不上伺服器，請檢查網路";
    $("status").classList.toggle("off", !ok);
  }

  /* ---------- tabs ---------- */
  document.querySelectorAll("nav.tabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  function setTab(t) {
    S.tab = t;
    document.querySelectorAll("nav.tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    ["log", "day", "month", "items"].forEach((k) => { $("panel-" + k).hidden = k !== t; });
    if (t === "day") loadMonth(S.day.slice(0, 7), true);
    if (t === "month") loadMonth(S.month, true);
    render();
  }

  /* ---------- inputs ---------- */
  $("todayLabel").textContent = "今天 " + dayLabel(todayStr());
  $("byName").value = load("waste.by") || "";
  $("byName").addEventListener("input", (e) => { store("waste.by", e.target.value.trim()); renderForm(); });
  $("dayPick").value = S.day;
  $("dayPick").addEventListener("change", (e) => { if (e.target.value) { S.day = e.target.value; loadMonth(S.day.slice(0, 7)); render(); } });
  $("monthPick").value = S.month;
  $("monthPick").addEventListener("change", (e) => { if (e.target.value) { S.month = e.target.value; loadMonth(S.month); render(); } });
  document.querySelectorAll("#periodSeg button").forEach((b) => b.addEventListener("click", () => { S.period = b.dataset.p; renderPeriod(); }));
  function renderPeriod() { document.querySelectorAll("#periodSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.p === S.period))); }

  function buildReasons() {
    const rc = $("reasonChips"); rc.textContent = "";
    S.reasons.forEach((r) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = r; b.dataset.r = r; b.addEventListener("click", () => { S.reason = r; renderForm(); }); rc.appendChild(b); });
  }
  buildReasons();
  $("qtyMinus").addEventListener("click", () => { const q = num($("qty").value) || 0; $("qty").value = fmtQty(Math.max(0, q - stepFor())); renderForm(); });
  $("qtyPlus").addEventListener("click", () => { const q = num($("qty").value) || 0; $("qty").value = fmtQty(q + stepFor()); renderForm(); });
  ["qty", "price"].forEach((id) => $(id).addEventListener("input", renderForm));
  function stepFor() { const it = selItem(); return !it ? 1 : weighed(it) ? 10 : it.unit === "斤" ? 0.5 : 1; }

  /* ---------- helpers ---------- */
  // 秤重品項：有每份克數，記錄時輸入秤到的克數
  function weighed(it) { return !!it && !it.floating && Number(it.grams) > 0; }
  function calcAmount(it, q, p) { if (q == null || p == null) return null; return weighed(it) ? (q / Number(it.grams)) * p : q * p; }
  function priceText(it) { return money(it.price) + "／" + (weighed(it) ? it.grams + "g" : it.unit); }
  function activeItems() { return S.items.filter((i) => i.active !== false); }
  function selItem() { return S.items.find((i) => i.id === S.sel) || null; }
  function monthLogs(m) { return S.logsByMonth[m] || []; }
  function catOrder() { const seen = S.categories.slice(); S.items.forEach((i) => { if (!seen.includes(i.cat)) seen.push(i.cat); }); return seen; }
  function lastPrice(itemId) {
    const all = [].concat(...Object.values(S.logsByMonth)).filter((l) => l.itemId === itemId && l.price != null);
    all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return all.length ? all[0].price : null;
  }
  function sum(arr) { return arr.reduce((s, l) => s + (l.amount || 0), 0); }
  function empty(el, text) { const p = document.createElement("p"); p.className = "empty"; p.textContent = text; el.appendChild(p); }

  /* ---------- 記錄 ---------- */
  function renderItemGrid() {
    const box = $("itemGrid"); box.textContent = "";
    const items = activeItems();
    if (!S.items.length) { empty(box, S.online ? "還沒有品項，請主管到「品項」分頁新增。" : "品項載入中…"); return; }
    catOrder().forEach((cat) => {
      const list = items.filter((i) => i.cat === cat).sort((a, b) => (a.order || 0) - (b.order || 0));
      if (!list.length) return;
      const h = document.createElement("div"); h.className = "group-title"; h.textContent = cat; box.appendChild(h);
      const g = document.createElement("div"); g.className = "items";
      list.forEach((it) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "item-btn";
        b.setAttribute("aria-pressed", String(S.sel === it.id));
        const n = document.createElement("span"); n.className = "n"; n.textContent = it.name;
        const p = document.createElement("span"); p.className = "p";
        if (it.floating) p.textContent = "填每" + it.unit + "價格";
        else if (it.price == null) { p.textContent = "未設單價"; p.classList.add("missing"); }
        else p.textContent = priceText(it) + (weighed(it) ? "・秤重" : "");
        b.append(n, p);
        b.addEventListener("click", () => selectItem(it.id));
        g.appendChild(b);
      });
      box.appendChild(g);
    });
  }
  function selectItem(id) {
    S.sel = id; const it = selItem();
    $("qty").value = weighed(it) ? "" : "1";
    if (it.floating) { const lp = lastPrice(it.id); $("price").value = lp != null ? lp : ""; }
    else $("price").value = it.price != null ? it.price : "";
    $("note").value = "";
    renderItemGrid(); renderForm();
    $("entryCard").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  }
  function renderForm() {
    const it = selItem(); $("entryCard").hidden = !it; if (!it) return;
    const w = weighed(it);
    $("selName").textContent = it.name; $("selUnit").textContent = w ? "g" : it.unit;
    $("qtyLabel").textContent = w ? "秤到的重量" : "數量"; $("qty").step = String(stepFor()); $("qty").placeholder = w ? "例如 120" : "";
    const fixed = !it.floating && it.price != null;
    $("price").readOnly = fixed;
    $("priceLabel").textContent = it.floating ? "今天每" + it.unit + "價格（元）" : w ? "每份成本（" + it.grams + "g）" : fixed ? "單價（固定成本）" : "單價（尚未設定，可先填）";
    $("selHint").textContent = it.floating ? "菜價浮動，填今天的進價" : w ? "秤重後輸入克數" : fixed ? "" : "請主管到「品項」補單價";
    document.querySelectorAll("#reasonChips .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.r === S.reason)));
    const q = num($("qty").value), p = num($("price").value);
    const amt = calcAmount(it, q, p);
    $("amountPreview").textContent = amt != null ? money(amt) + (w && q ? "（約 " + fmtQty(q / Number(it.grams)) + " 份）" : "") : "—";
    const by = $("byName").value.trim();
    const warn = !by ? "請先填記錄人。" : (q == null || q <= 0) ? (w ? "請輸入秤到的克數。" : "數量要大於 0。") : (it.floating && p == null) ? "請填今天每" + it.unit + "的價格，才能算出耗損金額。" : (p == null ? "還沒有單價，這筆會先記數量，金額之後補。" : "");
    $("formWarn").hidden = !warn; $("formWarn").textContent = warn;
    $("submitBtn").disabled = S.busy || !by || q == null || q <= 0;
  }
  $("submitBtn").addEventListener("click", async () => {
    const it = selItem(); if (!it) return;
    const by = $("byName").value.trim(), q = num($("qty").value), p = num($("price").value);
    if (!by || q == null || q <= 0) return;
    S.busy = true; renderForm();
    const date = todayStr();
    try {
      const { log } = await api("/api/logs", { method: "POST", body: { date, period: S.period, itemId: it.id, qty: q, price: p, reason: S.reason, note: $("note").value.trim(), by } });
      const m = date.slice(0, 7); S.logsByMonth[m] = (S.logsByMonth[m] || []).concat(log);
      toast("已記錄：" + log.name + " " + fmtQty(log.qty) + log.unit + (log.amount != null ? " " + money(log.amount) : ""));
      S.sel = null; setStatus(true);
    } catch (e) { toast(e.message); if (!e.status) setStatus(false); }
    S.busy = false; render();
  });

  /* ---------- 今日回報 ---------- */
  function dayLogs(d) { return monthLogs(d.slice(0, 7)).filter((l) => l.date === d).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); }
  function renderDay() {
    const logs = dayLogs(S.day), m = monthLogs(S.day.slice(0, 7)).filter((l) => l.date <= S.day);
    $("dayTotal").textContent = money(sum(logs)); $("dayCount").textContent = String(logs.length); $("dayMonthTotal").textContent = money(sum(m));
    const list = $("dayList"); list.textContent = "";
    if (!logs.length) empty(list, S.loadingMonth[S.day.slice(0, 7)] && !S.logsByMonth[S.day.slice(0, 7)] ? "載入中…" : dayLabel(S.day) + " 還沒有耗損紀錄。");
    ["上午", "下午"].forEach((per) => {
      const part = logs.filter((l) => l.period === per); if (!part.length) return;
      const h = document.createElement("div"); h.className = "period-h"; h.textContent = per + "　" + money(sum(part)); list.appendChild(h);
      part.forEach((l) => {
        const row = document.createElement("div"); row.className = "entry";
        const t = document.createElement("div"); t.className = "t"; t.textContent = l.name + "　" + fmtQty(l.qty) + l.unit;
        const a = document.createElement("div"); a.className = "a";
        if (l.amount == null) { a.textContent = "未設單價"; a.classList.add("missing"); } else a.textContent = money(l.amount);
        const m2 = document.createElement("div"); m2.className = "m";
        const tm = new Date(l.createdAt || 0);
        m2.textContent = l.reason + (l.note ? "｜" + l.note : "") + (l.price != null && l.unit === "斤" ? "｜每斤 " + money(l.price) : "") + (l.portionG ? "｜約 " + fmtQty(l.qty / l.portionG) + " 份" : "") + "｜" + l.by + " " + pad(tm.getHours()) + ":" + pad(tm.getMinutes());
        const del = document.createElement("button"); del.type = "button"; del.className = "del";
        const pending = S.pendingDelete === l.id;
        del.textContent = pending ? "確定刪除？" : "刪除"; if (pending) del.classList.add("confirm");
        del.addEventListener("click", async () => {
          if (S.pendingDelete !== l.id) { S.pendingDelete = l.id; renderDay(); setTimeout(() => { if (S.pendingDelete === l.id) { S.pendingDelete = null; renderDay(); } }, 4000); return; }
          S.pendingDelete = null;
          try {
            await api("/api/logs?date=" + l.date + "&id=" + encodeURIComponent(l.id), { method: "DELETE" });
            const mm = l.date.slice(0, 7); S.logsByMonth[mm] = monthLogs(mm).filter((x) => x.id !== l.id);
            toast("已刪除"); render();
          } catch (e) { toast(e.message); }
        });
        row.append(t, a, m2, del); list.appendChild(row);
      });
    });
    $("copyPreview").textContent = reportText();
  }
  function reportText() {
    const logs = dayLogs(S.day), m = monthLogs(S.day.slice(0, 7)).filter((l) => l.date <= S.day);
    const lines = ["【澄清店 耗損回報】" + dayLabel(S.day)];
    if (!logs.length) lines.push("今日無耗損");
    ["上午", "下午"].forEach((per) => {
      const part = logs.filter((l) => l.period === per); if (!part.length) return;
      lines.push(per + "（" + money(sum(part)) + "）");
      part.forEach((l) => lines.push("・" + l.name + " " + fmtQty(l.qty) + l.unit + " " + (l.amount != null ? money(l.amount) : "（未設單價）") + "（" + l.reason + (l.note ? "，" + l.note : "") + "）"));
    });
    lines.push("合計 " + money(sum(logs)) + "｜" + logs.length + " 筆");
    lines.push("本月累計 " + money(sum(m)));
    const missing = [...new Set(logs.filter((l) => l.amount == null).map((l) => l.name))];
    if (missing.length) lines.push("※ 未設單價：" + missing.join("、"));
    const bys = [...new Set(logs.map((l) => l.by))]; if (bys.length) lines.push("記錄人：" + bys.join("、"));
    return lines.join("\n");
  }
  $("copyBtn").addEventListener("click", async () => {
    const text = reportText();
    try { await navigator.clipboard.writeText(text); toast("已複製，貼到店裡群組即可"); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("copyPreview")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("已選取文字，請長按複製"); }
  });

  /* ---------- 本月 ---------- */
  function bars(el, rows, fmt) {
    el.textContent = "";
    if (!rows.length) { empty(el, "這個月還沒有資料。"); return; }
    const max = Math.max(...rows.map((r) => r.v), 1);
    rows.forEach((r) => {
      const b = document.createElement("div"); b.className = "bar";
      const n = document.createElement("span"); n.className = "name"; n.textContent = r.k;
      const tr = document.createElement("div"); tr.className = "track";
      const f = document.createElement("div"); f.className = "fill"; f.style.width = Math.max(2, (r.v / max) * 100) + "%"; tr.appendChild(f);
      const v = document.createElement("span"); v.className = "num"; v.textContent = fmt(r);
      b.append(n, tr, v); el.appendChild(b);
    });
  }
  function group(logs, key) {
    const m = new Map();
    logs.forEach((l) => { const k = key(l); const o = m.get(k) || { k, v: 0, n: 0 }; o.v += l.amount || 0; o.n += 1; m.set(k, o); });
    return [...m.values()];
  }
  function renderMonth() {
    const logs = monthLogs(S.month);
    $("mTotal").textContent = money(sum(logs)); $("mCount").textContent = String(logs.length);
    $("mMissing").textContent = String(logs.filter((l) => l.amount == null).length);
    bars($("mByItem"), group(logs, (l) => l.name).sort((a, b) => b.v - a.v || b.n - a.n).slice(0, 12), (r) => money(r.v) + "｜" + r.n + "筆");
    bars($("mByReason"), group(logs, (l) => l.reason).sort((a, b) => b.v - a.v || b.n - a.n), (r) => money(r.v) + "｜" + r.n + "筆");
    bars($("mByDay"), group(logs, (l) => l.date).sort((a, b) => (a.k < b.k ? -1 : 1)).map((r) => ({ ...r, k: dayLabel(r.k) })), (r) => money(r.v));
  }

  /* ---------- 品項（主管） ---------- */
  function fillCatSelect(sel, current) {
    sel.textContent = "";
    catOrder().forEach((c) => { const o = document.createElement("option"); o.textContent = c; if (c === current) o.selected = true; sel.appendChild(o); });
  }
  async function checkAdmin(pw) {
    try { await api("/api/admin/check", { method: "POST", admin: true }); S.isAdmin = true; return true; }
    catch (e) { S.isAdmin = false; if (pw) toast(e.message); return false; }
  }
  $("adminBtn").addEventListener("click", async () => {
    S.adminPw = $("adminPw").value; if (!S.adminPw) { toast("請輸入主管密碼"); return; }
    if (await checkAdmin(true)) { store("waste.adminPw", S.adminPw); $("adminPw").value = ""; toast("已解鎖，可以編輯品項"); }
    else { S.adminPw = ""; }
    renderItems();
  });
  $("adminOut").addEventListener("click", () => { S.isAdmin = false; S.adminPw = ""; store("waste.adminPw", ""); S.editing = null; renderItems(); });

  async function saveItems(items, okMsg) {
    try { const r = await api("/api/items", { method: "PUT", admin: true, body: { items } }); S.items = r.items; toast(okMsg); S.editing = null; render(); return true; }
    catch (e) { toast(e.message); if (e.status === 401) { S.isAdmin = false; renderItems(); } return false; }
  }
  function renderItems() {
    const box = $("itemList"); box.textContent = "";
    $("itemsReadonly").hidden = S.isAdmin; $("addCard").hidden = !S.isAdmin;
    $("adminBox").hidden = S.isAdmin; $("adminOn").hidden = !S.isAdmin;
    fillCatSelect($("nCat"), $("nCat").value || catOrder()[0]);
    if (!S.items.length) { empty(box, "還沒有品項。"); return; }
    const order = catOrder();
    [...S.items].sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat) || (a.order || 0) - (b.order || 0)).forEach((it) => {
      const row = document.createElement("div"); row.className = "item-row" + (it.active === false ? " inactive" : "");
      const left = document.createElement("div");
      const nm = document.createElement("strong"); nm.textContent = it.name;
      const cat = document.createElement("span"); cat.className = "pill"; cat.textContent = it.cat;
      left.append(nm, cat);
      if (it.floating) { const f = document.createElement("span"); f.className = "pill float"; f.textContent = "浮動價"; left.appendChild(f); }
      const pr = document.createElement("div"); pr.className = "small";
      pr.textContent = it.floating ? "記錄時填每" + it.unit + "價格" : it.price == null ? "未設單價／" + it.unit : priceText(it) + (weighed(it) ? "（秤重：輸入克數換算）" : "");
      left.appendChild(pr);
      row.appendChild(left);
      if (S.isAdmin) {
        const eb = document.createElement("button"); eb.type = "button"; eb.className = "ghost"; eb.textContent = S.editing === it.id ? "收起" : "編輯";
        eb.addEventListener("click", () => { S.editing = S.editing === it.id ? null : it.id; renderItems(); });
        row.appendChild(eb);
        if (S.editing === it.id) row.appendChild(editForm(it));
      }
      box.appendChild(row);
    });
  }
  function editForm(it) {
    const f = document.createElement("div"); f.className = "edit-form";
    const mk = (labelTxt, id, type, val) => { const w = document.createElement("div"); w.className = "field"; const l = document.createElement("label"); l.htmlFor = id; l.textContent = labelTxt; const i = document.createElement("input"); i.type = type; i.id = id; i.value = val == null ? "" : val; if (type === "number") { i.inputMode = "decimal"; i.min = "0"; i.step = "0.1"; } w.append(l, i); return [w, i]; };
    const [wn, iN] = mk("名稱", "e-name-" + it.id, "text", it.name);
    const [wu, iU] = mk("單位", "e-unit-" + it.id, "text", it.unit);
    const [wp, iP] = mk("每份成本（元）", "e-price-" + it.id, "number", it.price);
    const [wg, iG] = mk("每份克數（秤重品項才填）", "e-grams-" + it.id, "number", it.grams);
    const wc = document.createElement("div"); wc.className = "field";
    const lc = document.createElement("label"); lc.htmlFor = "e-cat-" + it.id; lc.textContent = "分類";
    const sc = document.createElement("select"); sc.id = "e-cat-" + it.id; fillCatSelect(sc, it.cat);
    wc.append(lc, sc);
    const fl = document.createElement("label"); fl.className = "check full"; const cf = document.createElement("input"); cf.type = "checkbox"; cf.id = "e-float-" + it.id; cf.checked = !!it.floating; fl.append(cf, document.createTextNode(" 浮動價（記錄時填當天價格）"));
    const ac = document.createElement("label"); ac.className = "check full"; const ca = document.createElement("input"); ca.type = "checkbox"; ca.id = "e-active-" + it.id; ca.checked = it.active !== false; ac.append(ca, document.createTextNode(" 顯示在記錄畫面"));
    const save = document.createElement("button"); save.type = "button"; save.className = "primary full"; save.textContent = "儲存";
    save.addEventListener("click", () => {
      const name = iN.value.trim(); if (!name) { toast("名稱不能空白"); return; }
      const items = S.items.map((x) => x.id === it.id ? { ...x, name, unit: iU.value.trim() || "份", price: num(iP.value), grams: cf.checked ? null : num(iG.value), cat: sc.value, floating: cf.checked, active: ca.checked } : x);
      saveItems(items, "已儲存");
    });
    f.append(wn, wc, wu, wp, wg, fl, ac, save);
    return f;
  }
  $("addItemBtn").addEventListener("click", async () => {
    const name = $("nName").value.trim(); if (!name) { toast("請填品項名稱"); return; }
    const cat = $("nCat").value;
    const order = Math.max(0, ...S.items.filter((i) => i.cat === cat).map((i) => i.order || 0)) + 1;
    const floating = $("nFloat").checked;
    const ok = await saveItems(S.items.concat({ id: "", name, cat, unit: $("nUnit").value.trim() || (floating ? "斤" : "份"), price: floating ? null : num($("nPrice").value), grams: floating ? null : num($("nGrams").value), floating, active: true, order }), "已新增：" + name);
    if (ok) { ["nName", "nUnit", "nPrice", "nGrams"].forEach((id) => { $(id).value = ""; }); $("nFloat").checked = false; }
  });

  /* ---------- render & data ---------- */
  function render() {
    renderPeriod(); renderItemGrid(); renderForm();
    if (S.tab === "day") renderDay();
    if (S.tab === "month") renderMonth();
    if (S.tab === "items") renderItems();
  }
  async function loadMonth(m, force) {
    if (S.loadingMonth[m] || (S.logsByMonth[m] && !force)) return;
    S.loadingMonth[m] = true; render();
    try { const r = await api("/api/logs?month=" + m); S.logsByMonth[m] = r.logs; setStatus(true); }
    catch (e) { setStatus(false); }
    S.loadingMonth[m] = false; render();
  }
  async function init() {
    render();
    try {
      const r = await api("/api/items");
      S.items = r.items; S.categories = r.categories || []; if (r.reasons) { S.reasons = r.reasons; buildReasons(); }
      setStatus(true);
    } catch (e) { setStatus(false); }
    if (S.adminPw) await checkAdmin(false);
    await loadMonth(todayStr().slice(0, 7));
    render();
  }
  // 每 30 秒同步一次其他夥伴的紀錄（畫面在前景時）
  setInterval(() => {
    if (document.visibilityState !== "visible" || S.busy) return;
    const months = new Set([todayStr().slice(0, 7), S.day.slice(0, 7), S.tab === "month" ? S.month : null].filter(Boolean));
    months.forEach((m) => loadMonth(m, true));
  }, 30000);
  init();
})();
