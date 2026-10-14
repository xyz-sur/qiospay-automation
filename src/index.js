/**
 * QIOSPAY AUTOMATION & QRIS ENGINE
 * Powered by Cloudflare Workers & Cloudflare D1 Database
 */

export default {
  // 1. HTTP REQUEST ROUTER
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // A. CORS Headers for API
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // B. Public Routes
    try {
      // 1. Webhook Callback QRIS dari Qiospay
      if (path === "/api/callback/qris" && request.method === "POST") {
        return await handleQrisCallback(request, env, ctx);
      }

      // 2. Private Mutasi API (Bebas limit untuk bot lain)
      if (path === "/api/qris/mutasi" && request.method === "GET") {
        return await handleGetMutasi(url, env, corsHeaders);
      }

      // 3. Webhook Bot Telegram
      if (path === "/api/telegram" && request.method === "POST") {
        return await handleTelegramWebhook(request, env);
      }

      // 4. Auth: Request Telegram OTP
      if (path === "/api/auth/request-otp" && request.method === "POST") {
        return await handleRequestOtp(request, env);
      }

      // 5. Auth: Verify Telegram OTP
      if (path === "/api/auth/verify-otp" && request.method === "POST") {
        return await handleVerifyOtp(request, env);
      }

      // 6. Dashboard API: Get Status & Statistics
      if (path === "/api/dashboard/stats" && request.method === "GET") {
        return await handleGetDashboardStats(request, env, corsHeaders);
      }

      // 7. Dashboard API: Update Settings
      if (path === "/api/dashboard/config" && request.method === "POST") {
        return await handleUpdateConfig(request, env);
      }

      // 8. Dashboard API: Trigger Manual WD Now
      if (path === "/api/dashboard/trigger-wd" && request.method === "POST") {
        return await handleManualWdTrigger(request, env);
      }

      // 9. Web Dashboard Frontend HTML
      if (path === "/" || path === "/dashboard") {
        return new Response(renderDashboardHtml(), {
          status: 200,
          headers: { "Content-Type": "text/html; charset=UTF-8" }
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (err) {
      console.error("Worker Router Error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },

  // 2. CRON TRIGGER (OTOMATIS 12 JAM SEKALI)
  async scheduled(event, env, ctx) {
    console.log("⏰ Running QiosPay 12-Hour Scheduled Auto-Withdraw Cron...");
    ctx.waitUntil(executeAutoWithdrawal(env, "CRON_12_HOURS"));
  }
};

// ============================================================================
// MODUL 1: CALLBACK QRIS & PRIVATE MUTATION API
// ============================================================================

async function handleQrisCallback(request, env, ctx) {
  try {
    const payload = await request.json();
    console.log("📥 Received QRIS Callback:", JSON.stringify(payload));

    const data = payload.data || payload;
    const refid = String(data.refid || data.issuer_reff || "MUT_" + Date.now());
    const amount = parseInt(data.amount || 0);
    const buyerName = data.name || data.buyer_name || "Pelanggan QRIS";
    const issuer = String(data.issuer || data.brand_name || "-");
    const balance = parseInt(data.balance || 0);
    const dateStr = data.time || data.date || new Date().toISOString();

    // 1. Simpan ke database D1
    if (env.DB) {
      await env.DB.prepare(
        `INSERT INTO mutations (refid, amount, buyer_name, issuer, balance, type, date_str, raw_payload)
         VALUES (?, ?, ?, ?, ?, 'CR', ?, ?)
         ON CONFLICT(refid) DO UPDATE SET balance = excluded.balance`
      ).bind(refid, amount, buyerName, issuer, balance, dateStr, JSON.stringify(payload)).run();
    }

    // 2. Kirim Notifikasi Realtime ke Telegram Admin
    if (env.BOT_TOKEN && env.ADMIN_ID) {
      const msg = `💰 <b>DANA QRIS MASUK!</b>\n\n` +
        `💵 <b>Nominal:</b> <code>Rp ${amount.toLocaleString('id-ID')}</code>\n` +
        `👤 <b>Pengirim:</b> <code>${escapeHtml(buyerName)}</code>\n` +
        `🏦 <b>Issuer:</b> <code>${issuer}</code>\n` +
        `💳 <b>Saldo Terkini:</b> <code>Rp ${balance.toLocaleString('id-ID')}</code>\n` +
        `🆔 <b>Ref ID:</b> <code>${refid}</code>\n` +
        `🕒 <b>Waktu:</b> <code>${dateStr}</code>`;

      ctx.waitUntil(sendTelegramMessage(env.BOT_TOKEN, env.ADMIN_ID, msg));
    }

    // 3. Dual Callback Forwarding (Ke Google AppScript jika disetel)
    if (env.DUAL_CALLBACK_URL) {
      ctx.waitUntil(
        fetch(env.DUAL_CALLBACK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(e => console.warn("Dual Callback Error:", e.message))
      );
    }

    return new Response(JSON.stringify({ status: "accept", message: "Mutation recorded successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Callback Processing Error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 200 });
  }
}

// Private API untuk dicek detikan oleh bot lain tanpa kena rate limit Qiospay
async function handleGetMutasi(url, env, corsHeaders) {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers: corsHeaders });
  }

  const refid = url.searchParams.get("refid");
  const amount = url.searchParams.get("amount");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 100);

  let query = "SELECT * FROM mutations";
  const params = [];

  if (refid) {
    query += " WHERE refid = ?";
    params.push(refid);
  } else if (amount) {
    query += " WHERE amount = ?";
    params.push(parseInt(amount));
  }

  query += " ORDER BY id DESC LIMIT ?";
  params.push(limit);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return new Response(JSON.stringify({
    status: "success",
    count: results.length,
    data: results
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// ============================================================================
// MODUL 2: LOGIKA AUTO-WITHDRAW & H2H TRANSAKSI SETIAP 12 JAM
// ============================================================================

async function executeAutoWithdrawal(env, triggerSource = "MANUAL") {
  console.log(`[AutoWD] Execution started by ${triggerSource}`);

  if (!env.DB) {
    return { success: false, message: "DB binding missing" };
  }

  // 1. Ambil Pengaturan dari D1
  const configRows = await env.DB.prepare("SELECT key, value FROM config").all();
  const cfg = {};
  for (const r of (configRows.results || [])) cfg[r.key] = r.value;

  if (cfg.auto_wd_enabled !== "1" && triggerSource !== "MANUAL") {
    console.log("[AutoWD] Skipped: Auto-WD disabled in settings");
    return { success: false, message: "Auto-WD disabled" };
  }

  const targetProduct = cfg.target_product || "DANA100";
  const destNumber = cfg.dana_dest || "";
  const hargaMax = parseInt(cfg.harga_max || "100500");

  if (!destNumber) {
    const warn = "⚠️ [Auto-WD] Nomor DANA penampung belum disetel!";
    if (env.BOT_TOKEN && env.ADMIN_ID) await sendTelegramMessage(env.BOT_TOKEN, env.ADMIN_ID, warn);
    return { success: false, message: warn };
  }

  // 2. Cek Saldo Terkini di Qiospay via Mutasi Endpoint
  let currentBalance = 0;
  try {
    const res = await fetch(`https://qiospay.id/api/mutasi/qris/${env.MERCHANT_CODE}/${env.API_KEY}`);
    const mutData = await res.json();
    if (mutData.status === "success" && Array.isArray(mutData.data) && mutData.data.length > 0) {
      currentBalance = parseInt(mutData.data[0].balance || 0);
    }
  } catch (e) {
    console.warn("[AutoWD] Warning fetching latest balance:", e.message);
  }

  // Fallback cek balance dari mutasi lokal jika API Qiospay return error
  if (currentBalance === 0) {
    const lastMut = await env.DB.prepare("SELECT balance FROM mutations ORDER BY id DESC LIMIT 1").first();
    if (lastMut && lastMut.balance) currentBalance = lastMut.balance;
  }

  // 3. Validasi Apakah Saldo Mencukupi
  if (currentBalance < hargaMax) {
    const logMsg = `Saldo Qiospay (Rp ${currentBalance.toLocaleString('id-ID')}) belum mencukupi untuk ${targetProduct} (Maks Rp ${hargaMax.toLocaleString('id-ID')}).`;
    console.log(`[AutoWD] ${logMsg}`);

    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'last_wd_status'").bind(logMsg).run();
    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'last_wd_attempt'").bind(Date.now().toString()).run();

    if (env.BOT_TOKEN && env.ADMIN_ID) {
      const tgMsg = `⏳ <b>[AUTO-WD 12 JAM: DILEWATI]</b>\n\n` +
        `💳 <b>Saldo Tersedia:</b> <code>Rp ${currentBalance.toLocaleString('id-ID')}</code>\n` +
        `📦 <b>Target Produk:</b> <code>${targetProduct}</code>\n` +
        `💵 <b>Kebutuhan Saldo:</b> <code>Rp ${hargaMax.toLocaleString('id-ID')}</code>\n\n` +
        `<i>Alasan: Saldo belum mencapai batas minimal. Dana tetap aman di akun untuk siklus 12 jam berikutnya.</i>`;
      await sendTelegramMessage(env.BOT_TOKEN, env.ADMIN_ID, tgMsg);
    }
    return { success: false, message: logMsg, balance: currentBalance };
  }

  // 4. Eksekusi H2H Trx Pembelian DANA
  const refID = `WD_${Date.now()}`;
  const memberID = env.MEMBER_ID || "mansur";
  const pin = env.MEMBER_PIN || "";
  const password = env.MEMBER_PASSWORD || "";
  const h2hBaseUrl = env.H2H_URL || "https://qiospay.id/api/h2h/trx";

  // Hitung Signature OtomaX
  const sign = await generateOtomaXSignature(memberID, targetProduct, destNumber, refID, pin, password);

  const queryParams = new URLSearchParams({
    memberID: memberID,
    product: targetProduct,
    dest: destNumber,
    refID: refID,
    pin: pin,
    password: password,
    harga_max: hargaMax.toString(),
    sign: sign
  });

  const fullH2hUrl = `${h2hBaseUrl}?${queryParams.toString()}`;
  console.log(`[AutoWD] Calling H2H URL: ${h2hBaseUrl}?memberID=${memberID}&product=${targetProduct}&dest=${destNumber}&refID=${refID}`);

  try {
    const response = await fetch(fullH2hUrl);
    const rawResponse = await response.text();
    console.log("[AutoWD] H2H Raw Response:", rawResponse);

    // Simpan ke riwayat transaksi
    const isSuccess = rawResponse.toLowerCase().includes("sukses") || rawResponse.toLowerCase().includes("proses");
    const statusText = isSuccess ? "BERHASIL" : "GAGAL";

    await env.DB.prepare(
      `INSERT INTO h2h_transactions (ref_id, product, dest, amount, status, message, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(refID, targetProduct, destNumber, hargaMax, statusText, rawResponse, rawResponse).run();

    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'last_wd_status'").bind(`${statusText}: ${rawResponse}`).run();
    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'last_wd_attempt'").bind(Date.now().toString()).run();

    // Notifikasi Telegram
    if (env.BOT_TOKEN && env.ADMIN_ID) {
      const emoji = isSuccess ? "✅" : "❌";
      const tgMsg = `${emoji} <b>[EKSEKUSI AUTO-WD H2H]</b>\n\n` +
        `📦 <b>Produk:</b> <code>${targetProduct}</code>\n` +
        `📱 <b>Nomor Tujuan:</b> <code>${destNumber}</code>\n` +
        `🆔 <b>Ref ID:</b> <code>${refID}</code>\n` +
        `📊 <b>Status:</b> <b>${statusText}</b>\n` +
        `📝 <b>Respon Server:</b>\n<code>${escapeHtml(rawResponse)}</code>`;

      await sendTelegramMessage(env.BOT_TOKEN, env.ADMIN_ID, tgMsg);
    }

    return { success: isSuccess, raw: rawResponse, refID };
  } catch (err) {
    console.error("[AutoWD] Network error executing H2H:", err);
    return { success: false, error: err.message };
  }
}

// Formula: base64(sha1("OtomaX|memberID|product|dest|refID|pin|password"))
async function generateOtomaXSignature(memberID, product, dest, refID, pin, password) {
  const str = `OtomaX|${memberID.trim()}|${product.trim().toLowerCase()}|${dest.trim()}|${refID.trim()}|${pin.trim()}|${password.trim()}`;
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return btoa(hex);
}

// ============================================================================
// MODUL 3: TELEGRAM OTP LOGIN & DASHBOARD API
// ============================================================================

async function handleRequestOtp(request, env) {
  const { telegram_id } = await request.json();
  if (String(telegram_id).trim() !== String(env.ADMIN_ID).trim()) {
    return new Response(JSON.stringify({ success: false, message: "ID Telegram tidak terdaftar sebagai Administrator!" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Generate OTP 6 digit
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 menit

  await env.DB.prepare("INSERT INTO otp_sessions (telegram_id, otp_code, expires_at) VALUES (?, ?, ?)")
    .bind(telegram_id, otp, expiresAt).run();

  // Kirim OTP via Telegram Bot
  if (env.BOT_TOKEN) {
    const text = `🔐 <b>KODE OTP LOGIN DASHBOARD QIOSPAY</b>\n\n` +
      `Kode verifikasi Anda adalah:\n` +
      `👉 <code>${otp}</code> 👈\n\n` +
      `<i>Kode ini berlaku selama 5 menit. Jangan berikan kepada siapa pun!</i>`;
    await sendTelegramMessage(env.BOT_TOKEN, env.ADMIN_ID, text);
  }

  return new Response(JSON.stringify({ success: true, message: "Kode OTP telah dikirimkan ke Telegram Anda." }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handleVerifyOtp(request, env) {
  const { telegram_id, otp } = await request.json();
  const now = Date.now();

  const session = await env.DB.prepare(
    "SELECT id FROM otp_sessions WHERE telegram_id = ? AND otp_code = ? AND expires_at > ? ORDER BY id DESC LIMIT 1"
  ).bind(telegram_id, otp, now).first();

  if (!session) {
    return new Response(JSON.stringify({ success: false, message: "Kode OTP salah atau sudah kedaluwarsa!" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Buat auth token
  const token = "qios_tok_" + crypto.randomUUID().replace(/-/g, "");
  await env.DB.prepare("UPDATE otp_sessions SET token = ? WHERE id = ?").bind(token, session.id).run();

  return new Response(JSON.stringify({ success: true, token }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handleGetDashboardStats(request, env, corsHeaders) {
  if (!env.DB) return new Response("{}", { status: 500, headers: corsHeaders });

  // 1. Mutasi QRIS terakhir
  const { results: mutations } = await env.DB.prepare("SELECT * FROM mutations ORDER BY id DESC LIMIT 10").all();
  // 2. Transaksi H2H terakhir
  const { results: h2hLogs } = await env.DB.prepare("SELECT * FROM h2h_transactions ORDER BY id DESC LIMIT 10").all();
  // 3. Konfigurasi
  const { results: configs } = await env.DB.prepare("SELECT * FROM config").all();
  const cfg = {};
  for (const c of configs || []) cfg[c.key] = c.value;

  // 4. Hitung Saldo & Mutasi Hari Ini
  const todayTotal = await env.DB.prepare("SELECT SUM(amount) as total FROM mutations WHERE date(created_at) = date('now')").first();
  const totalSuccessWd = await env.DB.prepare("SELECT COUNT(*) as count FROM h2h_transactions WHERE status = 'BERHASIL'").first();

  return new Response(JSON.stringify({
    config: cfg,
    today_qris_total: todayTotal?.total || 0,
    total_successful_wd: totalSuccessWd?.count || 0,
    recent_mutations: mutations || [],
    recent_h2h: h2hLogs || []
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleUpdateConfig(request, env) {
  const body = await request.json();
  if (!env.DB) return new Response(JSON.stringify({ success: false }), { status: 500 });

  for (const [key, val] of Object.entries(body)) {
    await env.DB.prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(key, String(val)).run();
  }

  return new Response(JSON.stringify({ success: true, message: "Pengaturan berhasil disimpan." }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handleManualWdTrigger(request, env) {
  const result = await executeAutoWithdrawal(env, "MANUAL_DASHBOARD");
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
}

// ============================================================================
// MODUL 4: TELEGRAM BOT COMMANDS (/status, /tarik, /setdana, /setproduk)
// ============================================================================

async function handleTelegramWebhook(request, env) {
  const update = await request.json();
  const msg = update.message;
  if (!msg) return new Response("OK");

  const chatId = msg.chat.id;
  const user = msg.from;
  const text = (msg.text || "").trim();

  // Hanya admin terdaftar yang dapat mengeksekusi perintah bot
  if (String(user.id) !== String(env.ADMIN_ID)) {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⛔ Anda tidak memiliki akses ke bot pengelola QiosPay ini.");
    return new Response("OK");
  }

  if (text === "/start" || text === "/help") {
    const help = `🤖 <b>QIOSPAY AUTOMATION CONTROLLER</b>\n\n` +
      `<b>Perintah Tersedia:</b>\n` +
      `• <code>/status</code> — Cek saldo, konfigurasi & mutasi terakhir\n` +
      `• <code>/tarik</code> — Paksa eksekusi penarikan H2H ke DANA sekarang\n` +
      `• <code>/setdana 08xxxxxxxx</code> — Ganti nomor DANA penampung\n` +
      `• <code>/setproduk DANA100</code> — Ganti target produk H2H\n` +
      `• <code>/setharga 100500</code> — Ganti batas harga maksimum\n` +
      `• <code>/autoon</code> / <code>/autooff</code> — Sakelar penarikan 12 jam`;
    await sendTelegramMessage(env.BOT_TOKEN, chatId, help);
    return new Response("OK");
  }

  if (text === "/status") {
    const configRows = await env.DB.prepare("SELECT key, value FROM config").all();
    const cfg = {};
    for (const r of (configRows.results || [])) cfg[r.key] = r.value;

    const lastMut = await env.DB.prepare("SELECT amount, balance, created_at FROM mutations ORDER BY id DESC LIMIT 1").first();

    const statusMsg = `📊 <b>STATUS QIOSPAY AUTOMATION:</b>\n\n` +
      `📱 <b>Nomor DANA:</b> <code>${cfg.dana_dest || "Belum disetel"}</code>\n` +
      `📦 <b>Target Produk:</b> <code>${cfg.target_product || "DANA100"}</code>\n` +
      `💵 <b>Harga Maks:</b> <code>Rp ${parseInt(cfg.harga_max || 100500).toLocaleString('id-ID')}</code>\n` +
      `⚙️ <b>Auto-WD (12 Jam):</b> <b>${cfg.auto_wd_enabled === "1" ? "AKTIF ✅" : "NONAKTIF ❌"}</b>\n` +
      `🕒 <b>Eksekusi Terakhir:</b> <code>${cfg.last_wd_status || "-"}</code>\n\n` +
      `💳 <b>Saldo Terakhir:</b> <code>Rp ${parseInt(lastMut?.balance || 0).toLocaleString('id-ID')}</code>`;

    await sendTelegramMessage(env.BOT_TOKEN, chatId, statusMsg);
    return new Response("OK");
  }

  if (text === "/tarik") {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ Sedang memproses eksekusi penarikan H2H ke DANA...");
    const res = await executeAutoWithdrawal(env, "TELEGRAM_COMMAND");
    if (!res.success) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, `⚠️ <b>Gagal:</b> ${res.message || res.error}`);
    }
    return new Response("OK");
  }

  if (text.startsWith("/setdana")) {
    const num = text.replace("/setdana", "").trim();
    if (!num) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ Format: <code>/setdana 085397538187</code>");
      return new Response("OK");
    }
    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'dana_dest'").bind(num).run();
    await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ Nomor DANA penampung diperbarui ke: <code>${num}</code>`);
    return new Response("OK");
  }

  if (text.startsWith("/setproduk")) {
    const prod = text.replace("/setproduk", "").trim().toUpperCase();
    if (!prod) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ Format: <code>/setproduk DANA100</code>");
      return new Response("OK");
    }
    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'target_product'").bind(prod).run();
    await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ Target produk H2H diperbarui ke: <code>${prod}</code>`);
    return new Response("OK");
  }

  if (text === "/autoon") {
    await env.DB.prepare("UPDATE config SET value = '1' WHERE key = 'auto_wd_enabled'").run();
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "✅ Auto-Withdraw 12 jam telah <b>DIAKTIFKAN</b>.");
    return new Response("OK");
  }

  if (text === "/autooff") {
    await env.DB.prepare("UPDATE config SET value = '0' WHERE key = 'auto_wd_enabled'").run();
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ Auto-Withdraw 12 jam telah <b>DINONAKTIFKAN</b>.");
    return new Response("OK");
  }

  return new Response("OK");
}

// ============================================================================
// MODUL 5: DASHBOARD HTML (TAILWIND CSS & DARK MODERN TECH)
// ============================================================================

function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QiosPay Automation & QRIS Engine</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #080C15; color: #E2E8F0; }
    .glass { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .btn-gradient { background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); }
    .btn-emerald { background: linear-gradient(135deg, #10B981 0%, #059669 100%); }
  </style>
</head>
<body class="min-h-screen">

  <!-- NAVBAR -->
  <nav class="border-b border-slate-800 bg-[#0B1120]/80 sticky top-0 z-50 backdrop-blur-md">
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">
          Q
        </div>
        <div>
          <span class="font-extrabold text-white text-base tracking-tight font-display">QIOSPAY<span class="text-sky-400">.ENGINE</span></span>
          <span class="text-[10px] ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">LIVE EDGE</span>
        </div>
      </div>
      <div id="authStatus" class="flex items-center gap-2 text-xs">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-slate-400">Cloudflare D1 Synced</span>
      </div>
    </div>
  </nav>

  <!-- LOGIN MODAL (OTP TELEGRAM) -->
  <div id="loginModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div class="glass max-w-md w-full rounded-2xl p-6 border border-slate-700/80 shadow-2xl">
      <div class="text-center mb-6">
        <div class="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto text-2xl mb-3">
          🔐
        </div>
        <h3 class="text-lg font-bold text-white">Login Dashboard Admin</h3>
        <p class="text-xs text-slate-400 mt-1">Masukkan User ID Telegram Anda untuk menerima kode OTP otentikasi.</p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Telegram User ID</label>
          <input type="text" id="tgUserId" value="682723201" placeholder="Contoh: 682723201" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500">
        </div>
        <button onclick="requestOtp()" id="btnRequestOtp" class="w-full btn-gradient py-2.5 rounded-xl font-bold text-xs text-white shadow-md shadow-sky-500/20">
          Kirim Kode OTP ke Telegram
        </button>

        <div id="otpInputGroup" class="hidden pt-3 border-t border-slate-800 space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Kode OTP 6 Digit</label>
            <input type="text" id="otpCode" placeholder="Masukkan 6 angka OTP" maxlength="6" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-sm font-mono tracking-widest text-sky-400 focus:outline-none focus:border-sky-500">
          </div>
          <button onclick="verifyOtp()" id="btnVerifyOtp" class="w-full btn-emerald py-2.5 rounded-xl font-bold text-xs text-white">
            Verifikasi & Masuk Dashboard
          </button>
        </div>
        <p id="authMsg" class="text-xs text-center text-rose-400"></p>
      </div>
    </div>
  </div>

  <!-- MAIN DASHBOARD CONTENT -->
  <main class="max-w-7xl mx-auto px-4 py-8 space-y-6">

    <!-- METRICS CARDS -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="glass p-5 rounded-2xl">
        <span class="text-xs text-slate-400 font-medium">Dana Masuk Hari Ini</span>
        <p id="todayTotal" class="text-2xl font-bold text-emerald-400 mt-1">Rp 0</p>
        <span class="text-[10px] text-slate-500">Mutasi QRIS realtime</span>
      </div>
      <div class="glass p-5 rounded-2xl">
        <span class="text-xs text-slate-400 font-medium">Target DANA Penampung</span>
        <p id="danaDest" class="text-base font-bold text-white mt-1">-</p>
        <span id="targetProd" class="text-[10px] text-sky-400 font-mono">DANA100</span>
      </div>
      <div class="glass p-5 rounded-2xl">
        <span class="text-xs text-slate-400 font-medium">Status Auto-Withdraw</span>
        <p id="autoWdStatus" class="text-base font-bold text-amber-400 mt-1">12 Jam Sekali</p>
        <span class="text-[10px] text-slate-500">Cron Trigger Aktif</span>
      </div>
      <div class="glass p-5 rounded-2xl flex flex-col justify-between">
        <span class="text-xs text-slate-400 font-medium">Eksekusi Manual</span>
        <button onclick="triggerManualWd()" id="btnTriggerWd" class="btn-gradient py-2 px-4 rounded-xl text-xs font-bold text-white shadow mt-2">
          ⚡ Tarik Saldo Sekarang
        </button>
      </div>
    </div>

    <!-- CONFIGURATION & SETTINGS -->
    <div class="glass rounded-2xl p-6">
      <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <span>⚙️</span> Pengaturan Auto-Withdraw ke DANA
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div>
          <label class="block text-slate-400 mb-1">Nomor DANA Penampung</label>
          <input type="text" id="cfgDanaDest" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white">
        </div>
        <div>
          <label class="block text-slate-400 mb-1">Produk Qiospay</label>
          <select id="cfgProduct" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white">
            <option value="DANA100">DANA100 (Saldo 100k - Rp 100.040)</option>
            <option value="DANA50">DANA50 (Saldo 50k - Rp 50.055)</option>
            <option value="DANA150">DANA150 (Saldo 150k - Rp 150.040)</option>
            <option value="DANA200">DANA200 (Saldo 200k - Rp 200.040)</option>
          </select>
        </div>
        <div>
          <label class="block text-slate-400 mb-1">Batas Harga Max (IDR)</label>
          <input type="number" id="cfgHargaMax" value="100500" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white">
        </div>
        <div class="flex items-end">
          <button onclick="saveConfig()" class="w-full btn-emerald py-2 rounded-xl text-xs font-bold text-white">
            💾 Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>

    <!-- LOGS & TABLES -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- MUTASI QRIS -->
      <div class="glass rounded-2xl p-5">
        <h4 class="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <span>📥</span> Riwayat Mutasi QRIS Terkini (D1 Cache)
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="text-[10px] uppercase text-slate-500 border-b border-slate-800">
              <tr>
                <th class="pb-2">Waktu</th>
                <th class="pb-2">Nominal</th>
                <th class="pb-2">Pengirim</th>
                <th class="pb-2">Ref ID</th>
              </tr>
            </thead>
            <tbody id="mutationTableBody" class="divide-y divide-slate-800/60 font-mono text-[11px]">
              <tr><td colspan="4" class="py-4 text-center text-slate-500">Memuat data mutasi...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- RIWAYAT H2H WD -->
      <div class="glass rounded-2xl p-5">
        <h4 class="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <span>📤</span> Riwayat Penarikan H2H ke DANA
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="text-[10px] uppercase text-slate-500 border-b border-slate-800">
              <tr>
                <th class="pb-2">Waktu</th>
                <th class="pb-2">Produk</th>
                <th class="pb-2">Tujuan</th>
                <th class="pb-2">Status</th>
              </tr>
            </thead>
            <tbody id="h2hTableBody" class="divide-y divide-slate-800/60 font-mono text-[11px]">
              <tr><td colspan="4" class="py-4 text-center text-slate-500">Memuat riwayat H2H...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </main>

  <!-- CLIENT SCRIPT -->
  <script>
    async function requestOtp() {
      const id = document.getElementById('tgUserId').value.trim();
      const msg = document.getElementById('authMsg');
      const btn = document.getElementById('btnRequestOtp');
      btn.disabled = true;
      btn.innerText = 'Mengirim OTP...';

      try {
        const res = await fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegram_id: id })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('otpInputGroup').classList.remove('hidden');
          msg.className = 'text-xs text-center text-emerald-400';
          msg.innerText = data.message;
        } else {
          msg.className = 'text-xs text-center text-rose-400';
          msg.innerText = data.message;
        }
      } catch (e) {
        msg.innerText = 'Error: ' + e.message;
      } finally {
        btn.disabled = false;
        btn.innerText = 'Kirim Ulang Kode OTP';
      }
    }

    async function verifyOtp() {
      const id = document.getElementById('tgUserId').value.trim();
      const otp = document.getElementById('otpCode').value.trim();
      const msg = document.getElementById('authMsg');

      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegram_id: id, otp })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('qios_token', data.token);
          document.getElementById('loginModal').classList.add('hidden');
          loadDashboardData();
        } else {
          msg.innerText = data.message;
        }
      } catch (e) {
        msg.innerText = 'Error: ' + e.message;
      }
    }

    async function loadDashboardData() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();

        // Cards
        document.getElementById('todayTotal').innerText = 'Rp ' + (data.today_qris_total || 0).toLocaleString('id-ID');
        document.getElementById('danaDest').innerText = data.config.dana_dest || 'Belum diatur';
        document.getElementById('targetProd').innerText = data.config.target_product || 'DANA100';

        // Inputs
        document.getElementById('cfgDanaDest').value = data.config.dana_dest || '';
        document.getElementById('cfgProduct').value = data.config.target_product || 'DANA100';
        document.getElementById('cfgHargaMax').value = data.config.harga_max || '100500';

        // Mutations Table
        const mBody = document.getElementById('mutationTableBody');
        if (data.recent_mutations.length === 0) {
          mBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">Belum ada mutasi tersimpan.</td></tr>';
        } else {
          mBody.innerHTML = data.recent_mutations.map(m => \`
            <tr>
              <td class="py-2.5">\${m.created_at.slice(11, 19)}</td>
              <td class="py-2.5 text-emerald-400 font-bold">Rp \${m.amount.toLocaleString('id-ID')}</td>
              <td class="py-2.5 text-white">\${m.buyer_name}</td>
              <td class="py-2.5 text-slate-400">\${m.refid}</td>
            </tr>
          \`).join('');
        }

        // H2H Table
        const hBody = document.getElementById('h2hTableBody');
        if (data.recent_h2h.length === 0) {
          hBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">Belum ada riwayat H2H.</td></tr>';
        } else {
          hBody.innerHTML = data.recent_h2h.map(h => \`
            <tr>
              <td class="py-2.5">\${h.created_at.slice(11, 19)}</td>
              <td class="py-2.5 text-sky-400 font-bold">\${h.product}</td>
              <td class="py-2.5 text-white">\${h.dest}</td>
              <td class="py-2.5 \${h.status === 'BERHASIL' ? 'text-emerald-400' : 'text-rose-400'}">\${h.status}</td>
            </tr>
          \`).join('');
        }
      } catch (e) {
        console.error("Dashboard Load Error:", e);
      }
    }

    async function saveConfig() {
      const payload = {
        dana_dest: document.getElementById('cfgDanaDest').value.trim(),
        target_product: document.getElementById('cfgProduct').value,
        harga_max: document.getElementById('cfgHargaMax').value.trim()
      };

      try {
        const res = await fetch('/api/dashboard/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        alert(data.message || 'Konfigurasi tersimpan!');
        loadDashboardData();
      } catch (e) {
        alert('Gagal menyimpan: ' + e.message);
      }
    }

    async function triggerManualWd() {
      const btn = document.getElementById('btnTriggerWd');
      btn.disabled = true;
      btn.innerText = 'Memproses...';

      try {
        const res = await fetch('/api/dashboard/trigger-wd', { method: 'POST' });
        const data = await res.json();
        alert(data.message || (data.success ? 'Eksekusi Sukses!' : 'Gagal: ' + data.raw));
        loadDashboardData();
      } catch (e) {
        alert('Error: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.innerText = '⚡ Tarik Saldo Sekarang';
      }
    }

    // Auto-check session on load
    if (localStorage.getItem('qios_token')) {
      document.getElementById('loginModal').classList.add('hidden');
      loadDashboardData();
      setInterval(loadDashboardData, 10000); // Polling tiap 10 detik
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// MODUL 6: UTILS & TELEGRAM SENDER
// ============================================================================

async function sendTelegramMessage(botToken, chatId, text) {
  try {
    return await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
  } catch (e) {
    console.error("Failed sending Telegram message:", e);
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
