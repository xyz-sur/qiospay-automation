/**
 * QIOSPAY AUTOMATION & QRIS ENGINE
 * Powered by Cloudflare Workers & Cloudflare D1 Database
 * Multi-Admin Role Support, Dual Withdrawal Controls & In-App Auto-Fill
 */

// KATALOG RESMI E-WALLET H2H (1 E-WALLET = 1 GRUP PRODUK TUNGGAL & TERMURAH)
const EWALLET_CATALOG = {
  dana: {
    name: "DANA",
    icon: "🔷",
    products: [
      { code: "DP1", name: "DANA 1.000", price: 1060, max: 1560 },
      { code: "DP2", name: "DANA 2.000", price: 2060, max: 2560 },
      { code: "DP5", name: "DANA 5.000", price: 5060, max: 5560 },
      { code: "DP10", name: "DANA 10.000", price: 10060, max: 10560 },
      { code: "DP20", name: "DANA 20.000", price: 20060, max: 20560 },
      { code: "DP25", name: "DANA 25.000", price: 25060, max: 25560 },
      { code: "DP50", name: "DANA 50.000", price: 50060, max: 50560 },
      { code: "DP100", name: "DANA 100.000", price: 100060, max: 100560 }
    ]
  },
  shopee: {
    name: "ShopeePay",
    icon: "🟠",
    products: [
      { code: "SPAY10", name: "ShopeePay 10.000", price: 10019, max: 10519 },
      { code: "SPAY15", name: "ShopeePay 15.000", price: 15019, max: 15519 },
      { code: "SPAY20", name: "ShopeePay 20.000", price: 20019, max: 20519 },
      { code: "SPAY25", name: "ShopeePay 25.000", price: 25019, max: 25519 },
      { code: "SPAY50", name: "ShopeePay 50.000", price: 50019, max: 50519 },
      { code: "SPAY100", name: "ShopeePay 100.000", price: 100019, max: 100519 }
    ]
  },
  gopay: {
    name: "GoPay",
    icon: "🟢",
    products: [
      { code: "GOPAY10", name: "GoPay 10.000", price: 10460, max: 10960 },
      { code: "GOPAY15", name: "GoPay 15.000", price: 15460, max: 15960 },
      { code: "GOPAY20", name: "GoPay 20.000", price: 20460, max: 20960 },
      { code: "GOPAY25", name: "GoPay 25.000", price: 25460, max: 25960 },
      { code: "GOPAY50", name: "GoPay 50.000", price: 50460, max: 50960 }
    ]
  },
  ovo: {
    name: "OVO",
    icon: "🟣",
    products: [
      { code: "OVP10", name: "OVO 10.000", price: 9590, max: 10090 },
      { code: "OVP15", name: "OVO 15.000", price: 14590, max: 15090 },
      { code: "OVP20", name: "OVO 20.000", price: 19590, max: 20090 },
      { code: "OVP25", name: "OVO 25.000", price: 24590, max: 25090 },
      { code: "OVP50", name: "OVO 50.000", price: 49590, max: 50090 },
      { code: "OVP100", name: "OVO 100.000", price: 99590, max: 100090 }
    ]
  },
  linkaja: {
    name: "LinkAja",
    icon: "🔴",
    products: [
      { code: "LINK10", name: "LinkAja 10.000", price: 10110, max: 10610 },
      { code: "LINK20", name: "LinkAja 20.000", price: 20110, max: 20610 },
      { code: "LINK25", name: "LinkAja 25.000", price: 25110, max: 25610 },
      { code: "LINK50", name: "LinkAja 50.000", price: 50110, max: 50610 },
      { code: "LINK100", name: "LinkAja 100.000", price: 100110, max: 100610 }
    ]
  }
};

export default {
  // 1. HTTP REQUEST ROUTER
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Debug: Cek Outbound IP Cloudflare Worker
      if (path === "/api/debug/outbound-ip") {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipJson = await ipRes.json();
        return new Response(JSON.stringify(ipJson), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 1. Webhook Callback QRIS dari Qiospay (Mutasi Masuk)
      if (path === "/api/callback/qris") {
        if (request.method === "GET") {
          return new Response(JSON.stringify({
            status: "active",
            type: "QRIS_CALLBACK",
            message: "QRIS Webhook Endpoint is ACTIVE and ready to receive mutation callbacks",
            forwarding_to: env.DUAL_CALLBACK_URL || "Not configured"
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (request.method === "POST") {
          return await handleQrisCallback(request, env, ctx);
        }
      }

      // 2. Webhook Callback H2H dari Qiospay (Status Transaksi Keluar/WD)
      if (path === "/api/callback/h2h") {
        if (request.method === "GET") {
          return new Response(JSON.stringify({
            status: "active",
            type: "H2H_CALLBACK",
            message: "H2H Webhook Endpoint is ACTIVE and ready to receive transaction status updates"
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (request.method === "POST") {
          return await handleH2hCallback(request, env, ctx);
        }
      }

      // 2. Private Mutasi API (Bebas limit untuk bot lain & detikan)
      if ((path === "/api/qris/mutasi" || path === "/api/mutasi" || path === "/api/qris/cek") && request.method === "GET") {
        return await handleGetMutasi(request, url, env, corsHeaders);
      }

      // 3. Dynamic QRIS Generator API (Dengan Kode Unik & Validasi 3 Menit + 1 Menit Grace Period)
      if ((path === "/api/qris/generate" || path === "/api/qris/create") && (request.method === "GET" || request.method === "POST")) {
        return await handleGenerateQrisApi(request, url, env, corsHeaders);
      }

      // 3.B Check Status Tagihan QRIS Dinamis API
      if ((path === "/api/qris/check" || path === "/api/qris/invoice" || path === "/api/qris/status") && request.method === "GET") {
        return await handleCheckQrisInvoiceApi(request, url, env, corsHeaders);
      }

      // 4. Webhook Bot Telegram (@qiospay2bot)
      if (path === "/api/telegram" && request.method === "POST") {
        return await handleTelegramWebhook(request, env, ctx);
      }

      // 5. Auth: Request Telegram OTP (Multi-Admin)
      if (path === "/api/auth/request-otp" && request.method === "POST") {
        return await handleRequestOtp(request, env);
      }

      // 6. Auth: Verify Telegram OTP
      if (path === "/api/auth/verify-otp" && request.method === "POST") {
        return await handleVerifyOtp(request, env);
      }

      // 7. Dashboard API: Get Stats, Mutations, H2H, Admins
      if (path === "/api/dashboard/stats" && request.method === "GET") {
        return await handleGetDashboardStats(request, env, corsHeaders);
      }

      // 8. Dashboard API: Update Settings
      if (path === "/api/dashboard/config" && request.method === "POST") {
        return await handleUpdateConfig(request, env);
      }

      // 9. Dashboard API: Manage Admins (Add / Delete)
      if (path === "/api/dashboard/admins" && request.method === "POST") {
        return await handleDashboardAdminManage(request, env);
      }

      // 10. Dashboard API: Trigger Tarik QRIS Settle Now
      if (path === "/api/dashboard/trigger-qris-settle" && request.method === "POST") {
        return await handleQrisSettleTrigger(request, env);
      }

      // 11. Dashboard API: Trigger Tarik Qiospay ke E-Wallet Now
      if (path === "/api/dashboard/trigger-wd" && request.method === "POST") {
        return await handleManualWdTrigger(request, env);
      }

      // 12. Web Dashboard Frontend HTML
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
    // 1. Sinkronisasi saldo QRIS terlebih dahulu
    await syncQrisBalance(env);
    // 2. Jalankan eksekusi auto-withdraw ke wallet jika mencukupi
    ctx.waitUntil(executeAutoWithdrawal(env, "CRON_12_HOURS"));
  }
};

// ============================================================================
// HELPER: MULTI-ADMIN PERMISSION CHECK
// ============================================================================

async function getAdminUser(env, userId) {
  const uid = Number(userId);
  if (isNaN(uid)) return null;

  if (String(uid) === String(env.ADMIN_ID)) {
    return { user_id: uid, role: "owner", username: "Super Admin" };
  }

  if (!env.DB) return null;

  const row = await env.DB.prepare(
    "SELECT user_id, username, role FROM admins WHERE user_id = ?"
  ).bind(uid).first();

  return row || null;
}

// ============================================================================
// MODUL 1: CALLBACK QRIS & PRIVATE MUTATION API
// ============================================================================

async function handleQrisCallback(request, env, ctx) {
  try {
    let payload = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        payload = await request.json();
      } catch (e) {
        const raw = await request.text();
        try { payload = JSON.parse(raw); } catch (_) { payload = { raw }; }
      }
    } else if (contentType.includes("form") || contentType.includes("urlencoded")) {
      try {
        const formData = await request.formData();
        for (const [key, val] of formData.entries()) {
          payload[key] = val;
        }
      } catch (e) {
        const raw = await request.text();
        const params = new URLSearchParams(raw);
        for (const [key, val] of params.entries()) {
          payload[key] = val;
        }
      }
    } else {
      const raw = await request.text();
      try {
        payload = JSON.parse(raw);
      } catch (_) {
        const params = new URLSearchParams(raw);
        let hasParams = false;
        for (const [key, val] of params.entries()) {
          payload[key] = val;
          hasParams = true;
        }
        if (!hasParams) payload = { raw_text: raw };
      }
    }

    console.log("📥 Received Webhook Callback:", JSON.stringify(payload));

    const data = payload.data || payload;
    const refid = String(data.refid || data.issuer_reff || data.ref_id || "MUT_" + Date.now());
    const amount = parseInt(data.amount || 0);
    const buyerName = data.name || data.buyer_name || data.buyer_reff || "Pelanggan QRIS";
    const issuer = String(data.issuer || data.brand_name || "QIOSPAY_WEBHOOK");
    const balance = parseInt(data.balance || 0);
    const dateStr = data.time || data.date || new Date().toISOString();

    if (env.DB) {
      await env.DB.prepare(
        `INSERT INTO mutations (refid, amount, buyer_name, issuer, balance, type, date_str, raw_payload)
         VALUES (?, ?, ?, ?, ?, 'CR', ?, ?)
         ON CONFLICT(refid) DO UPDATE SET balance = excluded.balance`
      ).bind(refid, amount, buyerName, issuer, balance, dateStr, JSON.stringify(payload)).run();

      if (balance > 0) {
        await env.DB.prepare(
          "INSERT INTO config (key, value) VALUES ('qris_balance', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        ).bind(String(balance)).run();
      }
    }

    // Cek kecocokan dengan Tagihan QRIS Dinamis (Kode Unik) dalam window toleransi 4 menit (3 menit user + 1 menit grace period)
    let matchedInvoice = null;
    if (env.DB && amount > 0) {
      const nowMs = Date.now();
      matchedInvoice = await env.DB.prepare(
        "SELECT * FROM qris_invoices WHERE status = 'PENDING' AND nominal_total = ? AND grace_expires_at >= ? ORDER BY id DESC LIMIT 1"
      ).bind(amount, nowMs).first();

      if (matchedInvoice) {
        await env.DB.prepare(
          "UPDATE qris_invoices SET status = 'PAID', paid_at = ?, paid_refid = ?, buyer_name = ? WHERE id = ?"
        ).bind(nowMs, refid, buyerName, matchedInvoice.id).run();
      }
    }

    if (env.BOT_TOKEN && env.DB) {
      let msg = "";
      if (matchedInvoice) {
        msg = `🎉 <b>PEMBAYARAN QRIS DINAMIS TELAH DIBAYAR OLEH USER!</b>\n\n` +
          `🆔 <b>No. Tagihan:</b> <code>${matchedInvoice.trx_id}</code>\n` +
          `💵 <b>Nominal Pokok:</b> <code>Rp ${matchedInvoice.nominal_base.toLocaleString('id-ID')}</code>\n` +
          `🔢 <b>Kode Unik:</b> <code>Rp ${matchedInvoice.unique_code}</code>\n` +
          `💰 <b>Total Diterima:</b> <code>Rp ${amount.toLocaleString('id-ID')}</code>\n` +
          `👤 <b>Nama Pengirim:</b> <code>${escapeHtml(buyerName)}</code>\n` +
          `🏦 <b>Issuer/Bank:</b> <code>${issuer}</code>\n` +
          `💳 <b>Saldo QRIS Terkini:</b> <code>Rp ${balance.toLocaleString('id-ID')}</code>\n` +
          `🆔 <b>Ref ID:</b> <code>${refid}</code>\n` +
          `🕒 <b>Waktu:</b> <code>${dateStr}</code>\n\n` +
          `✅ <i>Status: Sukses Lunas & Terverifikasi Otomatis (Aman dalam batas 3 menit + grace period 1 menit)!</i>`;

        // Jika tagihan dibuat oleh chat_id pengguna tertentu, kirim notifikasi langsung juga ke pembeli
        if (matchedInvoice.chat_id && String(matchedInvoice.chat_id) !== String(env.ADMIN_ID)) {
          const userNotify = `✅ <b>PEMBAYARAN QRIS BERHASIL DITERIMA!</b>\n\n` +
            `🆔 <b>No. Tagihan:</b> <code>${matchedInvoice.trx_id}</code>\n` +
            `💰 <b>Total Dibayar:</b> <code>Rp ${amount.toLocaleString('id-ID')}</code>\n` +
            `👤 <b>Pengirim:</b> <code>${escapeHtml(buyerName)}</code>\n` +
            `🕒 <b>Waktu:</b> <code>${dateStr}</code>\n\n` +
            `<i>Terima kasih! Pembayaran QRIS Anda telah lunas dan terverifikasi secara otomatis oleh sistem.</i>`;
          ctx.waitUntil(sendTelegramMessage(env.BOT_TOKEN, matchedInvoice.chat_id, userNotify));
        }
      } else {
        msg = `💰 <b>DANA MASUK (WEBHOOK QIOSPAY)!</b>\n\n` +
          `💵 <b>Nominal:</b> <code>Rp ${amount.toLocaleString('id-ID')}</code>\n` +
          `👤 <b>Pengirim:</b> <code>${escapeHtml(buyerName)}</code>\n` +
          `🏦 <b>Issuer:</b> <code>${issuer}</code>\n` +
          `💳 <b>Saldo Terkini:</b> <code>Rp ${balance.toLocaleString('id-ID')}</code>\n` +
          `🆔 <b>Ref ID:</b> <code>${refid}</code>\n` +
          `🕒 <b>Waktu:</b> <code>${dateStr}</code>`;
      }

      ctx.waitUntil(broadcastToAllAdmins(env, msg));
    }

    // Dual-Callback: Forward ke Google Apps Script (Hanya jika bukan berasal dari GAS agar tidak terjadi infinite loop)
    const reqUserAgent = (request.headers.get("user-agent") || "").toLowerCase();
    const isFromGas = reqUserAgent.includes("google") || reqUserAgent.includes("appengine") || payload._from_gas === true;

    if (env.DUAL_CALLBACK_URL && !isFromGas) {
      ctx.waitUntil(
        fetch(env.DUAL_CALLBACK_URL, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "User-Agent": "QiosPay-DualCallback-Worker/1.0"
          },
          body: JSON.stringify(payload)
        }).then(async r => {
          console.log(`[DualCallback] Forwarded to GAS successfully (HTTP ${r.status})`);
        }).catch(e => console.warn("[DualCallback] Error forwarding to GAS:", e.message))
      );
    }

    return new Response(JSON.stringify({
      status: "accept",
      message: "Callback processed and forwarded successfully",
      refid: refid
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Callback Processing Error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 200 });
  }
}

// 1.B Webhook Callback Khusus H2H (Status Hasil Transaksi Penarikan Saldo / Beli Produk)
async function handleH2hCallback(request, env, ctx) {
  try {
    let payload = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        payload = await request.json();
      } catch (e) {
        const raw = await request.text();
        try { payload = JSON.parse(raw); } catch (_) { payload = { raw }; }
      }
    } else {
      const raw = await request.text();
      try {
        payload = JSON.parse(raw);
      } catch (_) {
        const params = new URLSearchParams(raw);
        for (const [key, val] of params.entries()) {
          payload[key] = val;
        }
      }
    }

    console.log("📥 Received H2H Callback:", JSON.stringify(payload));

    const refId = String(payload.refid || payload.refID || payload.trxid || "");
    const status = String(payload.status || "").toUpperCase();
    const sn = String(payload.sn || payload.serial_number || "");
    const msg = String(payload.message || payload.pesan || payload.keterangan || "");
    const balance = parseInt(payload.balance || payload.saldo || 0);

    const isSuccess = status.includes("SUKSES") || status.includes("SUCCESS");
    const statusText = isSuccess ? "BERHASIL" : (status.includes("GAGAL") || status.includes("FAILED") ? "GAGAL" : status || "PROSES");

    if (env.DB && refId) {
      await env.DB.prepare(
        "UPDATE h2h_transactions SET status = ?, message = ?, raw_response = ? WHERE ref_id = ?"
      ).bind(statusText, `${msg} (SN: ${sn})`, JSON.stringify(payload), refId).run();
    }

    if (balance > 0 && env.DB) {
      await env.DB.prepare(
        "INSERT INTO config (key, value) VALUES ('qiospay_app_balance', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(String(balance)).run();
    }

    if (env.BOT_TOKEN && env.DB) {
      const emoji = isSuccess ? "✅" : "⚠️";
      const tgMsg = `${emoji} <b>LAPORAN STATUS TRANSAKSI H2H!</b>\n\n` +
        `🆔 <b>Ref ID:</b> <code>${refId || "-"}</code>\n` +
        `📊 <b>Status:</b> <b>${statusText}</b>\n` +
        `🔢 <b>SN:</b> <code>${sn || "-"}</code>\n` +
        `💬 <b>Keterangan:</b> <i>${escapeHtml(msg || "-")}</i>\n` +
        (balance > 0 ? `💼 <b>Sisa Saldo Aplikasi:</b> <code>Rp ${balance.toLocaleString('id-ID')}</code>\n` : "");

      ctx.waitUntil(broadcastToAllAdmins(env, tgMsg));
    }

    return new Response(JSON.stringify({ status: "accept", message: "H2H Callback processed successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("H2H Callback Processing Error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 200 });
  }
}

// Helper: Ambil & Validasi Secret Key API Tunggal (Hanya 1 Kunci yang Bisa Diubah di Bot)
async function getSingleSecretKey(env) {
  let activeKey = "mansur";
  if (env.DB) {
    const row = await env.DB.prepare("SELECT value FROM config WHERE key = 'api_secret'").first();
    if (row && row.value) {
      activeKey = row.value.trim();
    } else {
      await env.DB.prepare("INSERT INTO config (key, value) VALUES ('api_secret', 'mansur') ON CONFLICT(key) DO NOTHING").run();
    }
  }
  return activeKey;
}

// Helper: Validasi Secret Key API Tunggal untuk Otentikasi Bot Lain
async function validateApiKey(request, url, env) {
  const keyParam = (
    url.searchParams.get("key") ||
    url.searchParams.get("api_key") ||
    url.searchParams.get("secret") ||
    url.searchParams.get("secret_key") ||
    url.searchParams.get("token") ||
    request.headers.get("x-api-key") ||
    (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
  )?.trim();

  const singleSecretKey = await getSingleSecretKey(env);

  // Jika bot lain tidak mengirimkan key
  if (!keyParam) {
    return {
      valid: false,
      message: "Secret Key wajib disertakan (?key=... atau Header X-API-Key)"
    };
  }

  // Hanya 1 Secret Key yang sah!
  if (keyParam !== singleSecretKey) {
    return {
      valid: false,
      message: "Secret Key salah! Cek atau ubah Secret Key Anda di bot Telegram @qiospay2bot via perintah /api atau /setkey"
    };
  }

  return { valid: true, key: keyParam };
}

// Private API untuk dicek detikan oleh bot lain tanpa kena rate limit Qiospay
async function handleGetMutasi(request, url, env, corsHeaders) {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers: corsHeaders });
  }

  const auth = await validateApiKey(request, url, env);
  if (!auth.valid) {
    return new Response(JSON.stringify({
      status: "error",
      message: auth.message
    }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const refid = url.searchParams.get("refid") || url.searchParams.get("ref_id") || url.searchParams.get("trx_id") || url.searchParams.get("trxid");
  const amountParam = url.searchParams.get("amount") || url.searchParams.get("nominal") || url.searchParams.get("total");
  const amount = amountParam ? parseInt(amountParam.replace(/[^0-9]/g, "")) : null;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 100);

  let query = "SELECT * FROM mutations";
  const params = [];

  if (refid) {
    query += " WHERE refid = ?";
    params.push(refid);
  } else if (amount && !isNaN(amount)) {
    query += " WHERE amount = ?";
    params.push(amount);
  }

  query += " ORDER BY id DESC LIMIT ?";
  params.push(limit);

  let { results } = await env.DB.prepare(query).bind(...params).all();

  // Jika mutasi spesifik (nominal/refid) dicari namun belum ada di D1 lokal,
  // langsung fetch live realtime dari server Qiospay tanpa menunggu cron!
  if ((!results || results.length === 0) && (amount || refid)) {
    try {
      await syncQrisBalance(env);
      const retryRes = await env.DB.prepare(query).bind(...params).all();
      results = retryRes.results || [];
    } catch (_) {}
  }

  // Format data agar kompatibel dengan berbagai bot PPOB / gateway
  const formattedData = (results || []).map(r => ({
    id: r.id,
    refid: r.refid,
    amount: r.amount,
    nominal: r.amount,
    buyer_name: r.buyer_name,
    issuer: r.issuer,
    brand: r.issuer,
    balance: r.balance,
    type: r.type || "CR",
    status: "SUCCESS",
    date: r.date_str,
    created_at: r.created_at
  }));

  return new Response(JSON.stringify({
    status: "success",
    count: formattedData.length,
    data: formattedData
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// ============================================================================
// MODUL 2: GENERATE QRIS DINAMIS & KALKULASI CRC16
// ============================================================================

function calculateCRC16(str) {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function generateDynamicQris(staticQr, amount) {
  if (!amount || parseInt(amount) <= 0) {
    return { qris_string: staticQr, amount: 0 };
  }

  const amtStr = String(parseInt(amount));
  let qrBase = staticQr.trim().slice(0, -4);
  qrBase = qrBase.replace("010211", "010212");

  const parts = qrBase.split("5802ID");
  if (parts.length < 2) return { qris_string: staticQr, amount: 0 };

  const nominalTag = "54" + String(amtStr.length).padStart(2, "0") + amtStr + "5802ID";
  const reconstructed = parts[0].trim() + nominalTag + parts[1].trim();

  const newCrc = calculateCRC16(reconstructed);
  const finalQr = reconstructed + newCrc;

  return {
    qris_string: finalQr,
    amount: parseInt(amount),
    qr_image_url: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(finalQr)}`
  };
}

// Helper: Buat Tagihan QRIS Dinamis dengan Kode Unik & Validasi 3 Menit + Grace Period 1 Menit
async function createUniqueQrisInvoice(env, baseAmount, userId = null, chatId = null) {
  const nominalBase = parseInt(baseAmount);
  if (isNaN(nominalBase) || nominalBase <= 0) {
    throw new Error("Nominal harus berupa angka lebih besar dari 0");
  }

  const now = Date.now();
  // 1. Bersihkan invoice pending yang sudah lewat dari grace period (4 menit)
  if (env.DB) {
    await env.DB.prepare(
      "UPDATE qris_invoices SET status = 'EXPIRED' WHERE status = 'PENDING' AND grace_expires_at < ?"
    ).bind(now).run();
  }

  // 2. Kumpulkan nominal_total yang sedang aktif (pending) agar kode unik tidak bentrok
  const activeTotals = new Set();
  if (env.DB) {
    const rows = await env.DB.prepare(
      "SELECT nominal_total FROM qris_invoices WHERE status = 'PENDING' AND grace_expires_at >= ?"
    ).bind(now).all();
    for (const r of (rows.results || [])) {
      activeTotals.add(Number(r.nominal_total));
    }
  }

  // 3. Pilih kode unik acak (10 - 499) yang tidak bentrok dengan nominal_base yang sama
  let uniqueCode = 0;
  let nominalTotal = nominalBase;
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = Math.floor(Math.random() * 490) + 10; // 10 s/d 499
    const testTotal = nominalBase + candidate;
    if (!activeTotals.has(testTotal)) {
      uniqueCode = candidate;
      nominalTotal = testTotal;
      break;
    }
  }

  if (uniqueCode === 0) {
    uniqueCode = Math.floor(Math.random() * 900) + 100;
    nominalTotal = nominalBase + uniqueCode;
  }

  const staticQr = env.QRIS_STRING || "00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214804083792887370303UMI51440014ID.CO.QRIS.WWW0215ID20254684996570303UMI5204653353033605802ID5925Premium In Aja Payment Qp6007CILACAP61055321162070703A01630499E8";
  const qrData = generateDynamicQris(staticQr, nominalTotal);

  const trxId = `INV${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  const userExpiresAt = now + (3 * 60 * 1000);   // 3 Menit (User Expiration)
  const graceExpiresAt = now + (4 * 60 * 1000);  // 4 Menit (Background Grace Period: 3 Menit + 1 Menit Toleransi Bank)

  if (env.DB) {
    await env.DB.prepare(
      `INSERT INTO qris_invoices (trx_id, nominal_base, unique_code, nominal_total, qris_string, qr_image_url, user_id, chat_id, status, created_at, user_expires_at, grace_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
    ).bind(
      trxId,
      nominalBase,
      uniqueCode,
      nominalTotal,
      qrData.qris_string,
      qrData.qr_image_url,
      userId ? String(userId) : null,
      chatId ? String(chatId) : null,
      now,
      userExpiresAt,
      graceExpiresAt
    ).run();
  }

  return {
    trx_id: trxId,
    nominal_base: nominalBase,
    unique_code: uniqueCode,
    nominal_total: nominalTotal,
    qris_string: qrData.qris_string,
    qr_image_url: qrData.qr_image_url,
    user_expires_at: userExpiresAt,
    grace_expires_at: graceExpiresAt,
    user_expires_in_seconds: 180,
    created_at: now
  };
}

async function handleGenerateQrisApi(request, url, env, corsHeaders) {
  const auth = await validateApiKey(request, url, env);
  if (!auth.valid) {
    return new Response(JSON.stringify({
      status: "error",
      message: auth.message
    }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let amount = url.searchParams.get("amount");
  const useUnique = url.searchParams.get("unique") !== "false";
  const userId = url.searchParams.get("user_id");
  const chatId = url.searchParams.get("chat_id");

  if (request.method === "POST") {
    try {
      const body = await request.json();
      if (body.amount) amount = body.amount;
    } catch (_) {}
  }

  const amtNum = parseInt(amount || 0);
  if (!amtNum || amtNum <= 0) {
    const staticQr = env.QRIS_STRING || "00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214804083792887370303UMI51440014ID.CO.QRIS.WWW0215ID20254684996570303UMI5204653353033605802ID5925Premium In Aja Payment Qp6007CILACAP61055321162070703A01630499E8";
    return new Response(JSON.stringify({
      status: "success",
      data: { qris_string: staticQr, amount: 0, is_static: true }
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (useUnique) {
    const inv = await createUniqueQrisInvoice(env, amtNum, userId, chatId);
    return new Response(JSON.stringify({
      status: "success",
      data: inv
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } else {
    const staticQr = env.QRIS_STRING || "00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214804083792887370303UMI51440014ID.CO.QRIS.WWW0215ID20254684996570303UMI5204653353033605802ID5925Premium In Aja Payment Qp6007CILACAP61055321162070703A01630499E8";
    const result = generateDynamicQris(staticQr, amtNum);
    return new Response(JSON.stringify({
      status: "success",
      data: result
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

async function handleCheckQrisInvoiceApi(request, url, env, corsHeaders) {
  const auth = await validateApiKey(request, url, env);
  if (!auth.valid) {
    return new Response(JSON.stringify({
      status: "error",
      message: auth.message
    }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const trxId = url.searchParams.get("trx_id") || url.searchParams.get("trxid") || url.searchParams.get("invoice") || url.searchParams.get("id") || url.searchParams.get("refid");
  if (!trxId) {
    return new Response(JSON.stringify({ error: "Parameter trx_id wajib diisi (?trx_id=INV...)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Database D1 tidak tersedia" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const inv = await env.DB.prepare("SELECT * FROM qris_invoices WHERE trx_id = ?").bind(trxId).first();
  if (!inv) {
    return new Response(JSON.stringify({ status: "not_found", message: "Tagihan tidak ditemukan" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const now = Date.now();
  let currentStatus = inv.status;
  if (currentStatus === "PENDING" && now > inv.grace_expires_at) {
    currentStatus = "EXPIRED";
    await env.DB.prepare("UPDATE qris_invoices SET status = 'EXPIRED' WHERE id = ?").bind(inv.id).run();
  }

  const remSeconds = currentStatus === "PENDING" ? Math.max(0, Math.floor((inv.user_expires_at - now) / 1000)) : 0;

  return new Response(JSON.stringify({
    status: "success",
    data: {
      trx_id: inv.trx_id,
      nominal_base: inv.nominal_base,
      unique_code: inv.unique_code,
      nominal_total: inv.nominal_total,
      status: currentStatus,
      is_paid: currentStatus === "PAID",
      is_expired: currentStatus === "EXPIRED" || (currentStatus === "PENDING" && now > inv.user_expires_at),
      remaining_seconds: remSeconds,
      paid_at: inv.paid_at,
      paid_refid: inv.paid_refid,
      buyer_name: inv.buyer_name,
      created_at: inv.created_at
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// ============================================================================
// MODUL 3: FITUR PENARIKAN (1: QRIS KE QIOSPAY, 2: QIOSPAY KE WALLET)
// ============================================================================

// A. SINKRONISASI & SETTLEMENT SALDO QRIS KE SALDO QIOSPAY
async function syncQrisBalance(env) {
  let qrisBalance = 0;
  let newMutationsCount = 0;

  try {
    const res = await fetch(`https://qiospay.id/api/mutasi/qris/${env.MERCHANT_CODE}/${env.API_KEY}`);
    const mutData = await res.json();

    if (mutData.status === "success" && Array.isArray(mutData.data) && mutData.data.length > 0) {
      qrisBalance = parseInt(mutData.data[0].balance || 0);

      // Simpan semua mutasi terbaru ke database D1
      for (const m of mutData.data) {
        const refid = String(m.issuer_reff || m.buyer_reff || "MUT_" + Date.now());
        const amt = parseInt(m.amount || 0);
        const bal = parseInt(m.balance || 0);
        const buyer = m.brand_name || "Pelanggan QRIS";
        const dt = m.date || new Date().toISOString();

        await env.DB.prepare(
          `INSERT INTO mutations (refid, amount, buyer_name, issuer, balance, type, date_str, raw_payload)
           VALUES (?, ?, ?, 'QRIS_API', ?, 'CR', ?, ?)
           ON CONFLICT(refid) DO UPDATE SET balance = excluded.balance`
        ).bind(refid, amt, buyer, bal, dt, JSON.stringify(m)).run();
        newMutationsCount++;
      }

      // Update qris_balance saja (jangan timpa qiospay_app_balance)
      await env.DB.prepare("INSERT INTO config (key, value) VALUES ('qris_balance', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(String(qrisBalance)).run();
    }
  } catch (e) {
    console.warn("[SyncQRIS] Error syncing balance:", e.message);
  }

  if (qrisBalance === 0) {
    const lastMut = await env.DB.prepare("SELECT balance FROM mutations ORDER BY id DESC LIMIT 1").first();
    if (lastMut && lastMut.balance) qrisBalance = lastMut.balance;
  }

  return { qrisBalance, newMutationsCount };
}

// B. EKSEKUSI PENARIKAN SALDO QIOSPAY KE WALLET (H2H OTOMAX)
async function executeAutoWithdrawal(env, triggerSource = "MANUAL") {
  console.log(`[AutoWD] Execution started by ${triggerSource}`);

  if (!env.DB) {
    return { success: false, message: "DB binding missing" };
  }

  // 1. Ambil Pengaturan dari D1
  const configRows = await env.DB.prepare("SELECT key, value FROM config").all();
  const cfg = {};
  for (const r of (configRows.results || [])) cfg[r.key] = r.value;

  if (cfg.auto_wd_enabled !== "1" && triggerSource !== "MANUAL" && !triggerSource.startsWith("TELEGRAM_USER_") && !triggerSource.startsWith("BUTTON_")) {
    console.log("[AutoWD] Skipped: Auto-WD disabled in settings");
    return { success: false, message: "Auto-WD disabled" };
  }

  const targetProduct = cfg.target_product || "DP1";
  const destNumber = cfg.dana_dest || "083127060539";
  const hargaMax = parseInt(cfg.harga_max || "1560");

  if (!destNumber) {
    const warn = "⚠️ [Auto-WD] Nomor Wallet penampung belum disetel! Gunakan perintah /setwallet untuk mengatur nomor tujuan.";
    await broadcastToAllAdmins(env, warn);
    return { success: false, message: warn };
  }

  // 2. Ambil Saldo Aplikasi Qiospay & Saldo QRIS
  const qrisBalance = parseInt(cfg.qris_balance || "0");
  const appBalance = parseInt(cfg.qiospay_app_balance || "0");
  const effectiveBalance = Math.max(appBalance, qrisBalance);

  // 3. Validasi Kecukupan Saldo
  if (effectiveBalance < hargaMax) {
    const logMsg = `Saldo QiosPay (Rp ${effectiveBalance.toLocaleString('id-ID')}) belum mencukupi untuk ${targetProduct} (Maks Rp ${hargaMax.toLocaleString('id-ID')}).`;
    console.log(`[AutoWD] ${logMsg}`);

    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'last_wd_status'").bind(logMsg).run();
    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'last_wd_attempt'").bind(Date.now().toString()).run();

    const tgMsg = `⏳ <b>[PENARIKAN KE WALLET DITANGGUHKAN]</b>\n\n` +
      `💼 <b>Saldo Aplikasi QiosPay:</b> <code>Rp ${appBalance.toLocaleString('id-ID')}</code>\n` +
      `💳 <b>Saldo Akun QRIS:</b> <code>Rp ${qrisBalance.toLocaleString('id-ID')}</code>\n` +
      `📦 <b>Target Produk:</b> <code>${targetProduct}</code>\n` +
      `💵 <b>Kebutuhan Saldo:</b> <code>Rp ${hargaMax.toLocaleString('id-ID')}</code>\n\n` +
      `<i>Alasan: Saldo belum mencapai batas harga modal produk. Saldo tetap aman di akun untuk siklus berikutnya.</i>`;
    await broadcastToAllAdmins(env, tgMsg);

    return { success: false, message: logMsg, qrisBalance, appBalance };
  }

  // 4. Validasi Secret PIN & Password
  const memberID = env.MEMBER_ID || "mansur";
  const pin = env.MEMBER_PIN || "";
  const password = env.MEMBER_PASSWORD || "";

  if (!pin || !password) {
    const missingSecretMsg = `⚠️ <b>KREDENSIAL H2H BELUM LENGKAP</b>\n\n` +
      `PIN Transaksi atau Password member QiosPay belum diatur di Cloudflare Worker Secret!\n\n` +
      `<b>Langkah Aktivasi:</b>\n` +
      `Simpan PIN dan Password akun QiosPay via CLI:\n` +
      `<code>npx wrangler secret put MEMBER_PIN</code>\n` +
      `<code>npx wrangler secret put MEMBER_PASSWORD</code>`;

    await broadcastToAllAdmins(env, missingSecretMsg);
    return { success: false, message: "Kredensial PIN/Password transaksi QiosPay belum disetel di secrets." };
  }

  // 5. Eksekusi H2H Trx Pembelian E-Wallet (Via Bridge Server IPv4 103.125.37.38)
  const refID = `WD_${Date.now()}`;
  const h2hBaseUrl = env.H2H_URL || "https://qiosh2h.89id.eu.org/api/h2h/trx";

  const queryParams = new URLSearchParams({
    memberID: memberID,
    product: targetProduct,
    dest: destNumber,
    refID: refID,
    pin: pin,
    password: password
  });

  if (hargaMax > 0) {
    queryParams.set("harga_max", hargaMax.toString());
  }

  const fullH2hUrl = `${h2hBaseUrl}?${queryParams.toString()}`;
  console.log(`[AutoWD] Calling H2H URL: ${h2hBaseUrl}?memberID=${memberID}&product=${targetProduct}&dest=${destNumber}&refID=${refID}`);

  try {
    const response = await fetch(fullH2hUrl);
    const rawResponse = await response.text();
    console.log("[AutoWD] H2H Raw Response:", rawResponse);

    // Parsing Saldo Aplikasi dari respon H2H
    const saldoMatch = rawResponse.match(/Saldo(?:\s+Rp\.?)?\s+([\d\.,]+)/i);
    if (saldoMatch && saldoMatch[1]) {
      const parsedSaldo = parseInt(saldoMatch[1].replace(/[^0-9]/g, ""));
      if (!isNaN(parsedSaldo)) {
        await env.DB.prepare("INSERT INTO config (key, value) VALUES ('qiospay_app_balance', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
          .bind(String(parsedSaldo)).run();
      }
    }

    const isSuccess = rawResponse.toLowerCase().includes("sukses") || rawResponse.toLowerCase().includes("proses");
    const statusText = isSuccess ? "BERHASIL" : "GAGAL";

    await env.DB.prepare(
      `INSERT INTO h2h_transactions (ref_id, product, dest, amount, status, message, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(refID, targetProduct, destNumber, hargaMax, statusText, rawResponse, rawResponse).run();

    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'last_wd_status'").bind(`${statusText}: ${rawResponse}`).run();
    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'last_wd_attempt'").bind(Date.now().toString()).run();

    // Notifikasi Telegram Realtime
    const emoji = isSuccess ? "✅" : "❌";
    const tgMsg = `${emoji} <b>[EKSEKUSI PENARIKAN KE WALLET]</b>\n\n` +
      `📦 <b>Produk:</b> <code>${targetProduct}</code>\n` +
      `📱 <b>Nomor Tujuan:</b> <code>${destNumber}</code>\n` +
      `🆔 <b>Ref ID:</b> <code>${refID}</code>\n` +
      `📊 <b>Status:</b> <b>${statusText}</b>\n` +
      `📝 <b>Respon Server:</b>\n<code>${escapeHtml(rawResponse)}</code>`;

    await broadcastToAllAdmins(env, tgMsg);

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
// MODUL 4: TELEGRAM OTP LOGIN & DASHBOARD API
// ============================================================================

async function handleRequestOtp(request, env) {
  const { telegram_id } = await request.json();
  const admin = await getAdminUser(env, telegram_id);

  if (!admin) {
    return new Response(JSON.stringify({ success: false, message: "ID Telegram tidak terdaftar sebagai Administrator!" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  await env.DB.prepare("INSERT INTO otp_sessions (telegram_id, otp_code, expires_at) VALUES (?, ?, ?)")
    .bind(telegram_id, otp, expiresAt).run();

  if (env.BOT_TOKEN) {
    const text = `🔐 <b>KODE OTP LOGIN DASHBOARD QIOSPAY</b>\n\n` +
      `Halo <b>${escapeHtml(admin.username || "Admin")}</b>,\n` +
      `Kode verifikasi Anda adalah:\n` +
      `👉 <code>${otp}</code> 👈\n\n` +
      `<i>Kode ini berlaku selama 5 menit. Jangan berikan kepada siapa pun!</i>`;
    await sendTelegramMessage(env.BOT_TOKEN, telegram_id, text);
  }

  return new Response(JSON.stringify({ success: true, message: `Kode OTP telah dikirimkan ke Telegram ID ${telegram_id}.` }), {
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

  const token = "qios_tok_" + crypto.randomUUID().replace(/-/g, "");
  await env.DB.prepare("UPDATE otp_sessions SET token = ? WHERE id = ?").bind(token, session.id).run();

  const admin = await getAdminUser(env, telegram_id);

  return new Response(JSON.stringify({ success: true, token, role: admin?.role || "admin", user: admin }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handleGetDashboardStats(request, env, corsHeaders) {
  if (!env.DB) return new Response("{}", { status: 500, headers: corsHeaders });

  const { results: mutations } = await env.DB.prepare("SELECT * FROM mutations ORDER BY id DESC LIMIT 15").all();
  const { results: h2hLogs } = await env.DB.prepare("SELECT * FROM h2h_transactions ORDER BY id DESC LIMIT 15").all();
  const { results: configs } = await env.DB.prepare("SELECT * FROM config").all();
  const cfg = {};
  for (const c of configs || []) cfg[c.key] = c.value;

  const { results: admins } = await env.DB.prepare("SELECT user_id, username, role, created_at FROM admins ORDER BY created_at ASC").all();

  const todayTotal = await env.DB.prepare("SELECT SUM(amount) as total FROM mutations WHERE date(created_at) = date('now')").first();
  const totalSuccessWd = await env.DB.prepare("SELECT COUNT(*) as count FROM h2h_transactions WHERE status = 'BERHASIL'").first();

  return new Response(JSON.stringify({
    config: cfg,
    today_qris_total: todayTotal?.total || 0,
    total_successful_wd: totalSuccessWd?.count || 0,
    qris_balance: parseInt(cfg.qris_balance || "0"),
    qiospay_app_balance: parseInt(cfg.qiospay_app_balance || "0"),
    recent_mutations: mutations || [],
    recent_h2h: h2hLogs || [],
    admins: admins || []
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

async function handleDashboardAdminManage(request, env) {
  const { action, user_id, username } = await request.json();
  if (!user_id) return new Response(JSON.stringify({ success: false, message: "User ID required" }), { status: 400 });

  const uid = Number(user_id);

  if (action === "add") {
    await env.DB.prepare(
      "INSERT INTO admins (user_id, username, role, added_by) VALUES (?, ?, 'admin', 0) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username"
    ).bind(uid, username || `Admin_${uid}`).run();

    return new Response(JSON.stringify({ success: true, message: `Admin ${uid} berhasil ditambahkan.` }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (action === "delete") {
    if (String(uid) === String(env.ADMIN_ID)) {
      return new Response(JSON.stringify({ success: false, message: "Owner utama tidak dapat dihapus!" }), { status: 400 });
    }
    await env.DB.prepare("DELETE FROM admins WHERE user_id = ?").bind(uid).run();
    return new Response(JSON.stringify({ success: true, message: `Admin ${uid} berhasil dihapus.` }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: false, message: "Invalid action" }), { status: 400 });
}

async function handleQrisSettleTrigger(request, env) {
  const syncRes = await syncQrisBalance(env);
  return new Response(JSON.stringify({
    success: true,
    message: `Sinkronisasi QRIS sukses. Saldo terkumpul: Rp ${syncRes.qrisBalance.toLocaleString('id-ID')}`,
    data: syncRes
  }), { headers: { "Content-Type": "application/json" } });
}

async function handleManualWdTrigger(request, env) {
  const result = await executeAutoWithdrawal(env, "MANUAL_DASHBOARD");
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
}

// ============================================================================
// MODUL 5: TELEGRAM BOT WEBHOOK (@qiospay2bot)
// ============================================================================

async function handleTelegramWebhook(request, env, ctx) {
  const update = await request.json();

  if (update.callback_query) {
    return await handleCallbackQuery(update.callback_query, env);
  }

  const msg = update.message;
  if (!msg) return new Response("OK");

  const chatId = msg.chat.id;
  const user = msg.from;
  const text = (msg.text || "").trim();

  // 1. Verifikasi Keamanan Multi-Admin
  const admin = await getAdminUser(env, user.id);
  if (!admin) {
    const unauth = `⛔ <b>AKSES DITOLAK</b>\n\n` +
      `ID Anda: <code>${user.id}</code> belum terdaftar sebagai administrator di sistem QiosPay ini.\n\n` +
      `<i>Hubungi Owner (@${escapeHtml(env.ADMIN_USERNAME || "Owner")}) untuk mendapatkan akses.</i>`;
    await sendTelegramMessage(env.BOT_TOKEN, chatId, unauth);
    return new Response("OK");
  }

  // 2. Command /start & /help
  if (text === "/start" || text === "/help") {
    const roleBadge = admin.role === "owner" ? "👑 OWNER" : "🛡️ ADMIN";
    const welcome = `🤖 <b>QIOSPAY AUTOMATION & DUAL ENGINE</b>\n` +
      `Status: <b>${roleBadge}</b> (<code>${user.id}</code>)\n\n` +
      `<b>⚡ Menu Operasional:</b>\n` +
      `1️⃣ <b>Tarik QRIS ➔ QiosPay:</b> Pindahkan saldo mutasi QRIS ke akun QiosPay.\n` +
      `2️⃣ <b>Tarik ke E-Wallet:</b> Eksekusi saldo QiosPay ke E-Wallet penampung.\n\n` +
      `<b>📱 Perintah Cepat:</b>\n` +
      `• <code>/status</code> — Cek saldo (QRIS & Aplikasi Qiospay) & status WD\n` +
      `• <code>/tarikqris</code> — Tarik saldo QRIS ke QiosPay\n` +
      `• <code>/wd</code> — Tarik saldo QiosPay ke E-Wallet\n` +
      `• <code>/setnomor [no]</code> — Atur nomor HP E-Wallet penampung\n` +
      `• <code>/setproduk</code> — Pilih produk & nominal E-Wallet\n` +
      `• <code>/qris [nominal]</code> — Buat QRIS Dinamis (Kode Unik 3 Menit)\n` +
      `• <code>/api</code> — Secret Key & panduan integrasi bot lain\n` +
      `• <code>/setkey [kunci]</code> — Ganti Secret Key API tunggal\n\n` +
      `<i>Gunakan tombol interaktif di bawah untuk navigasi cepat:</i>`;

    const dashUrl = `https://qiospay-automation.mansyurj168.workers.dev/?uid=${user.id}`;
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📊 Cek Dual Saldo", callback_data: "cb:status" },
          { text: "⚡ Tarik ke E-Wallet", callback_data: "cb:prompt_tarik_wallet" }
        ],
        [
          { text: "🔄 Tarik QRIS ➔ QiosPay", callback_data: "cb:tarik_qris_settle" },
          { text: "💳 Buat QRIS Dinamis", callback_data: "cb:qris_menu" }
        ],
        [
          { text: "📱 Set Nomor Tujuan", callback_data: "ew:input_phone" },
          { text: "⚙️ Pilih Produk E-Wallet", callback_data: "ew:menu" }
        ],
        [
          { text: "📥 Mutasi QRIS", callback_data: "cb:mutasi" },
          { text: "📤 Riwayat WD", callback_data: "cb:h2h" }
        ],
        [
          { text: "🔑 Secret Key & API", callback_data: "cb:api_info" },
          { text: "👥 Admin", callback_data: "cb:listadmin" }
        ],
        [
          { text: "🌐 Web Dashboard", url: dashUrl }
        ]
      ]
    };

    await sendTelegramMessage(env.BOT_TOKEN, chatId, welcome, inlineKeyboard);
    return new Response("OK");
  }

  // 3. Command /status (DUAL SALDO: QRIS & APLIKASI QIOSPAY)
  if (text === "/status") {
    await renderStatusMessage(env, chatId, user.id);
    return new Response("OK");
  }

  // 4. Command /setnomor (Alias: /setwallet, /setdana)
  if (text.startsWith("/setnomor") || text.startsWith("/setwallet") || text.startsWith("/setdana")) {
    const rawParam = text.replace(/^\/(?:setnomor|setwallet|setdana)/, "").trim();

    if (rawParam) {
      const cleanPhone = rawParam.replace(/[^0-9]/g, "");
      if (!/^08[0-9]{8,12}$/.test(cleanPhone)) {
        const errKb = {
          inline_keyboard: [[{ text: "🔙 Coba Lagi", callback_data: "ew:input_phone" }]]
        };
        await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ <b>Nomor tidak valid!</b>\nGunakan nomor HP Indonesia aktif (contoh: <code>/setnomor 083127060539</code>).", errKb);
        return new Response("OK");
      }

      await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'dana_dest'").bind(cleanPhone).run();

      const confirmMsg = `✅ <b>Nomor Tujuan E-Wallet Diperbarui!</b>\n\n` +
        `📱 <b>Nomor Aktif:</b> <code>${cleanPhone}</code>\n\n` +
        `Silakan pilih produk E-Wallet penampung di bawah ini:`;

      await sendTelegramMessage(env.BOT_TOKEN, chatId, confirmMsg, renderWalletCategoryKeyboard());
      return new Response("OK");
    }

    const promptMsg = `📱 <b>ATUR NOMOR HP TUJUAN E-WALLET</b>\n\n` +
      `Ketik nomor tujuan penarikan saldo Anda di chat:\n` +
      `👉 <code>/setnomor 083127060539</code> 👈\n\n` +
      `<i>Atau pilih produk nominal penarikan di bawah ini:</i>`;

    const kb = {
      inline_keyboard: [
        [{ text: "⚙️ Pilih Produk E-Wallet", callback_data: "ew:menu" }],
        [{ text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }]
      ]
    };
    await sendTelegramMessage(env.BOT_TOKEN, chatId, promptMsg, kb);
    return new Response("OK");
  }

  // 4.B Command /setproduk (Menu Pemilihan Produk E-Wallet)
  if (text === "/setproduk" || text === "/produk") {
    const promptMsg = `⚙️ <b>PILIH PRODUK & NOMINAL PENARIKAN E-WALLET</b>\n\n` +
      `<i>Pilih provider E-Wallet penampung dengan biaya modal resmi paling murah:</i>`;
    await sendTelegramMessage(env.BOT_TOKEN, chatId, promptMsg, renderWalletCategoryKeyboard());
    return new Response("OK");
  }

  // 5. Command /tarikqris (Tarik/Settle Saldo QRIS ke QiosPay)
  if (text === "/tarikqris") {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ Sedang menyinkronkan & menarik saldo mutasi QRIS ke akun QiosPay...");
    const syncRes = await syncQrisBalance(env);
    const msg = `✅ <b>PENARIKAN SALDO QRIS ➔ QIOSPAY SELESAI!</b>\n\n` +
      `💳 <b>Saldo QRIS:</b> <code>Rp ${syncRes.qrisBalance.toLocaleString('id-ID')}</code>\n` +
      `💼 <b>Saldo Akun QiosPay:</b> <code>Rp ${syncRes.qrisBalance.toLocaleString('id-ID')}</code>\n` +
      `📥 <b>Total Mutasi Masuk:</b> <code>${syncRes.newMutationsCount} transaksi</code>\n\n` +
      `<i>Saldo kini siap ditarik ke E-Wallet penampung Anda!</i>`;

    const kb = {
      inline_keyboard: [
        [{ text: "⚡ Tarik ke E-Wallet Sekarang", callback_data: "cb:prompt_tarik_wallet" }],
        [{ text: "📊 Cek Status", callback_data: "cb:status" }],
        [{ text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }]
      ]
    };
    await sendTelegramMessage(env.BOT_TOKEN, chatId, msg, kb);
    return new Response("OK");
  }

  // 6. Command /tarikwallet, /wd, /tarik (Konfirmasi Eksekusi ke E-Wallet)
  if (text === "/tarikwallet" || text === "/wd" || text === "/tarik") {
    await renderWithdrawConfirmPrompt(env, chatId);
    return new Response("OK");
  }

  // 7. Command /mutasi [limit]
  if (text.startsWith("/mutasi")) {
    const parts = text.split(/\s+/);
    const limit = Math.min(parseInt(parts[1] || "5"), 15);

    const { results } = await env.DB.prepare(
      "SELECT amount, buyer_name, issuer, balance, refid, created_at FROM mutations ORDER BY id DESC LIMIT ?"
    ).bind(limit).all();

    if (!results || results.length === 0) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "ℹ️ Belum ada data mutasi QRIS tersimpan di database D1.");
      return new Response("OK");
    }

    let mutText = `📥 <b>${results.length} MUTASI QRIS TERAKHIR:</b>\n\n`;
    results.forEach((m, i) => {
      mutText += `${i + 1}. <b>Rp ${m.amount.toLocaleString('id-ID')}</b> | <code>${escapeHtml(m.buyer_name)}</code>\n` +
        `   Ref: <code>${m.refid}</code> | Waktu: <code>${m.created_at}</code>\n\n`;
    });

    await sendTelegramMessage(env.BOT_TOKEN, chatId, mutText);
    return new Response("OK");
  }

  // 8. Command /h2h [limit]
  if (text.startsWith("/h2h")) {
    const parts = text.split(/\s+/);
    const limit = Math.min(parseInt(parts[1] || "5"), 15);

    const { results } = await env.DB.prepare(
      "SELECT ref_id, product, dest, amount, status, message, created_at FROM h2h_transactions ORDER BY id DESC LIMIT ?"
    ).bind(limit).all();

    if (!results || results.length === 0) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "ℹ️ Belum ada riwayat transaksi H2H.");
      return new Response("OK");
    }

    let h2hText = `📤 <b>${results.length} TRANSAKSI H2H TERAKHIR:</b>\n\n`;
    results.forEach((h, i) => {
      const emoji = h.status === "BERHASIL" ? "✅" : "❌";
      h2hText += `${i + 1}. ${emoji} <b>${h.product}</b> -> <code>${h.dest}</code>\n` +
        `   Status: <b>${h.status}</b> | Ref: <code>${h.ref_id}</code>\n` +
        `   Pesan: <i>${escapeHtml(h.message || "-")}</i>\n\n`;
    });

    await sendTelegramMessage(env.BOT_TOKEN, chatId, h2hText);
    return new Response("OK");
  }

  // 9. Command /qris [nominal] (QRIS Dinamis dengan Kode Unik & Validasi 3 Menit)
  if (text.startsWith("/qris")) {
    const parts = text.split(/\s+/);
    const amount = parts[1] ? parseInt(parts[1].replace(/[^0-9]/g, "")) : 0;

    if (amount <= 0) {
      const qrisPrompt = `💳 <b>BUAT QRIS DINAMIS DENGAN KODE UNIK:</b>\n\n` +
        `Sistem akan otomatis menambahkan kode unik acak dan memvalidasi pembayaran Anda dalam waktu <b>3 menit</b> (dengan toleransi proses perbankan di background).\n\n` +
        `Silakan pilih nominal cepat di bawah atau ketik manual:\n` +
        `👉 <code>/qris 10000</code>\n` +
        `👉 <code>/qris 25000</code>\n` +
        `👉 <code>/qris 50000</code>`;

      const kb = {
        inline_keyboard: [
          [
            { text: "Rp 5.000", callback_data: "cb:gen_qris:5000" },
            { text: "Rp 10.000", callback_data: "cb:gen_qris:10000" },
            { text: "Rp 20.000", callback_data: "cb:gen_qris:20000" }
          ],
          [
            { text: "Rp 50.000", callback_data: "cb:gen_qris:50000" },
            { text: "Rp 100.000", callback_data: "cb:gen_qris:100000" },
            { text: "Rp 250.000", callback_data: "cb:gen_qris:250000" }
          ],
          [{ text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }]
        ]
      };

      await sendTelegramMessage(env.BOT_TOKEN, chatId, qrisPrompt, kb);
      return new Response("OK");
    }

    try {
      const inv = await createUniqueQrisInvoice(env, amount, user.id, chatId);
      const expDate = new Date(inv.user_expires_at + (7 * 3600 * 1000)); // WIB (+7)
      const expTimeStr = expDate.toISOString().slice(11, 19);

      const caption = `💳 <b>TAGIHAN QRIS DINAMIS (KODE UNIK)</b>\n\n` +
        `🆔 <b>No. Tagihan:</b> <code>${inv.trx_id}</code>\n` +
        `💵 <b>Nominal Pokok:</b> <code>Rp ${inv.nominal_base.toLocaleString('id-ID')}</code>\n` +
        `🔢 <b>Kode Unik:</b> <code>Rp ${inv.unique_code}</code>\n` +
        `💰 <b>TOTAL HARUS DIBAYAR:</b>\n` +
        `👉 <b><code>Rp ${inv.nominal_total.toLocaleString('id-ID')}</code></b> 👈\n\n` +
        `⚠️ <b>PANDUAN PEMBAYARAN:</b>\n` +
        `• Wajib transfer <b>PERSIS</b> <code>Rp ${inv.nominal_total.toLocaleString('id-ID')}</code> sampai digit terakhir.\n` +
        `• Sistem akan <b>otomatis memvalidasi</b> pembayaran Anda.\n` +
        `⏳ <b>Batas Waktu:</b> <b>3 MENIT</b> (Hingga ${expTimeStr} WIB)\n` +
        `<i>(Jika lewat 3 menit belum dibayar, QRIS otomatis kedaluwarsa).</i>\n\n` +
        `📋 <b>String QRIS (1-Tap Copy):</b>\n<code>${inv.qris_string}</code>`;

      const kb = {
        inline_keyboard: [
          [
            { text: "🔄 Cek Status Pembayaran", callback_data: `cb:check_inv:${inv.trx_id}` },
            { text: "❌ Batalkan Tagihan", callback_data: `cb:cancel_inv:${inv.trx_id}` }
          ]
        ]
      };

      if (inv.qr_image_url) {
        await sendTelegramPhoto(env.BOT_TOKEN, chatId, inv.qr_image_url, caption, kb);
      } else {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, caption, kb);
      }
    } catch (err) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, `❌ Gagal membuat QRIS: ${err.message}`);
    }
    return new Response("OK");
  }

  // 10. Command /setsaldo <nominal> (Koreksi Saldo Real Aplikasi QiosPay Manual)
  if (text.startsWith("/setsaldo")) {
    const rawVal = text.replace("/setsaldo", "").trim().replace(/[^0-9]/g, "");
    if (!rawVal) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ Format: <code>/setsaldo 50000</code>\n(Gunakan untuk menyelaraskan saldo aplikasi Qiospay sebelum ada transaksi H2H)");
      return new Response("OK");
    }
    const valNum = parseInt(rawVal);
    await env.DB.prepare("INSERT INTO config (key, value) VALUES ('qiospay_app_balance', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(String(valNum)).run();

    await sendTelegramMessage(env.BOT_TOKEN, chatId, `💼 <b>Saldo Aplikasi QiosPay Diperbarui!</b>\n\nSaldo aplikasi saat ini disetel ke: <code>Rp ${valNum.toLocaleString('id-ID')}</code>\n\n<i>Catatan: Saldo ini akan otomatis tersinkronisasi ke nilai riil server saat transaksi H2H pertama berhasil dieksekusi.</i>`);
    return new Response("OK");
  }

  // 11. Command /autoon & /autooff
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

  // 11. Command /addadmin <id> [username]
  if (text.startsWith("/addadmin")) {
    const parts = text.split(/\s+/);
    const targetId = Number(parts[1]);
    const username = parts[2] || `Admin_${targetId}`;

    if (!targetId || isNaN(targetId)) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ Format: <code>/addadmin 123456789 useradmin</code>");
      return new Response("OK");
    }

    await env.DB.prepare(
      "INSERT INTO admins (user_id, username, role, added_by) VALUES (?, ?, 'admin', ?) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username"
    ).bind(targetId, username, user.id).run();

    await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ Berhasil menambahkan administrator:\n👤 ID: <code>${targetId}</code>\n🏷️ User: <code>${username}</code>\n🛡️ Role: <b>ADMIN</b>`);
    return new Response("OK");
  }

  // 12. Command /deladmin <id>
  if (text.startsWith("/deladmin")) {
    const parts = text.split(/\s+/);
    const targetId = Number(parts[1]);

    if (!targetId || isNaN(targetId)) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ Format: <code>/deladmin 123456789</code>");
      return new Response("OK");
    }

    if (String(targetId) === String(env.ADMIN_ID)) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "⛔ Super Admin / Owner tidak dapat dihapus!");
      return new Response("OK");
    }

    await env.DB.prepare("DELETE FROM admins WHERE user_id = ?").bind(targetId).run();
    await sendTelegramMessage(env.BOT_TOKEN, chatId, `🗑️ Administrator ID <code>${targetId}</code> telah dihapus dari sistem.`);
    return new Response("OK");
  }

  // 13. Command /listadmin
  if (text === "/listadmin") {
    const { results } = await env.DB.prepare("SELECT user_id, username, role, created_at FROM admins ORDER BY created_at ASC").all();

    let adminMsg = `👥 <b>DAFTAR ADMINISTRATOR QIOSPAY:</b>\n\n`;
    (results || []).forEach((a, i) => {
      const badge = a.role === "owner" ? "👑 Owner" : "🛡️ Admin";
      adminMsg += `${i + 1}. <b>${escapeHtml(a.username || "Admin")}</b> (<code>${a.user_id}</code>)\n` +
        `   Role: <b>${badge}</b> | Terdaftar: <code>${a.created_at || "-"}</code>\n\n`;
    });

    await sendTelegramMessage(env.BOT_TOKEN, chatId, adminMsg);
    return new Response("OK");
  }

  // 14. Command /api & /apikey (Panduan Private API & Secret Key Tunggal untuk Bot Lain)
  if (text === "/api" || text === "/apikey") {
    const singleKey = await getSingleSecretKey(env);
    const host = "https://qiospay-automation.mansyurj168.workers.dev";
    const apiMsg = `🌐 <b>PANDUAN PRIVATE API QRIS (UNTUK BOT LAIN)</b>\n\n` +
      `⚡ <i>Berjalan di Cloudflare Edge D1, respon kilat (10-30ms), bebas limit, dan aman dicek detikan.</i>\n\n` +
      `🔑 <b>SECRET KEY TUNGGAL AKTIF:</b>\n` +
      `👉 <code>${singleKey}</code> 👈\n\n` +
      `<i>(Hanya 1 kunci ini yang sah untuk otentikasi bot lain. Bisa diubah kapan saja)</i>\n\n` +
      `🔗 <b>Format URL Pemanggilan (GET):</b>\n\n` +
      `1️⃣ <b>Cek Mutasi per Nominal:</b>\n` +
      `<code>${host}/api/qris/mutasi?key=${singleKey}&nominal=10231</code>\n\n` +
      `2️⃣ <b>Cek Mutasi per Ref ID:</b>\n` +
      `<code>${host}/api/qris/mutasi?key=${singleKey}&refid=231695940439</code>\n\n` +
      `3️⃣ <b>Cek Tagihan Dinamis Kode Unik:</b>\n` +
      `<code>${host}/api/qris/check?key=${singleKey}&trx_id=INV12345</code>\n\n` +
      `4️⃣ <b>Generate QRIS Dinamis via URL:</b>\n` +
      `<code>${host}/api/qris/generate?key=${singleKey}&amount=10000</code>\n\n` +
      `💡 <i>Ketik <code>/setkey &lt;kunci_baru&gt;</code> di chat untuk mengganti secret key.</i>`;

    const kb = {
      inline_keyboard: [
        [
          { text: "🔑 Cara Ganti Secret Key", callback_data: "cb:prompt_setkey" },
          { text: "🔄 Refresh Key", callback_data: "cb:api_info" }
        ],
        [
          { text: "📥 Cek Mutasi QRIS", callback_data: "cb:mutasi" },
          { text: "💳 Buat QRIS Dinamis", callback_data: "cb:qris_menu" }
        ],
        [
          { text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }
        ]
      ]
    };

    await sendTelegramMessage(env.BOT_TOKEN, chatId, apiMsg, kb);
    return new Response("OK");
  }

  // 15. Command /setkey <kunci_baru> (Ubah Secret Key Tunggal untuk Bot Lain)
  if (text.startsWith("/setkey")) {
    const newKey = text.replace("/setkey", "").trim();
    if (!newKey) {
      const errKb = {
        inline_keyboard: [[{ text: "🔙 Kembali ke API", callback_data: "cb:api_info" }]]
      };
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ Format: <code>/setkey rahasia123</code>", errKb);
      return new Response("OK");
    }
    await env.DB.prepare("INSERT INTO config (key, value) VALUES ('api_secret', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(newKey).run();

    const okKb = {
      inline_keyboard: [
        [{ text: "🌐 Lihat Panduan API Baru", callback_data: "cb:api_info" }],
        [{ text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }]
      ]
    };
    await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ <b>Secret Key API Diperbarui!</b>\n\nSecret key tunggal aktif: <code>${newKey}</code>\n\n<i>Kunci lama otomatis tidak berlaku dan kunci baru ini langsung aktif 100%.</i>`, okKb);
    return new Response("OK");
  }

  return new Response("OK");
}

// ============================================================================
// MODUL INLINE KEYBOARD GENERATOR & CALLBACK QUERY HANDLER
// ============================================================================

async function renderStatusMessage(env, chatId, userId, messageId = null) {
  const configRows = await env.DB.prepare("SELECT key, value FROM config").all();
  const cfg = {};
  for (const r of (configRows.results || [])) cfg[r.key] = r.value;

  const lastMut = await env.DB.prepare("SELECT amount, balance, created_at FROM mutations ORDER BY id DESC LIMIT 1").first();
  const todayTotal = await env.DB.prepare("SELECT SUM(amount) as total FROM mutations WHERE date(created_at) = date('now')").first();
  const totalWd = await env.DB.prepare("SELECT COUNT(*) as count FROM h2h_transactions WHERE status = 'BERHASIL'").first();

  const qrisBalance = parseInt(cfg.qris_balance || lastMut?.balance || 0);
  const appBalance = parseInt(cfg.qiospay_app_balance || 0);

  const statusMsg = `📊 <b>STATUS AKUN & DUAL SALDO:</b>\n\n` +
    `💼 <b>Saldo Akun QiosPay:</b> <code>Rp ${appBalance.toLocaleString('id-ID')}</code>\n` +
    `💳 <b>Saldo Akun QRIS:</b> <code>Rp ${qrisBalance.toLocaleString('id-ID')}</code>\n` +
    `📈 <b>QRIS Masuk Hari Ini:</b> <code>Rp ${(todayTotal?.total || 0).toLocaleString('id-ID')}</code>\n` +
    `────────────────────────\n` +
    `📱 <b>Nomor Penampung:</b> <code>${cfg.dana_dest || "083127060539"}</code>\n` +
    `📦 <b>Target Produk:</b> <code>${cfg.target_product || "DP1"}</code>\n` +
    `💵 <b>Batas Harga Maks:</b> <code>Rp ${parseInt(cfg.harga_max || 1560).toLocaleString('id-ID')}</code>\n` +
    `⚙️ <b>Auto-WD ke E-Wallet:</b> <b>${cfg.auto_wd_enabled === "1" ? "AKTIF ✅" : "NONAKTIF ❌"}</b>\n` +
    `🕒 <b>Status WD Terakhir:</b> <code>${cfg.last_wd_status || "-"}</code>\n` +
    `✅ <b>Total WD Berhasil:</b> <code>${totalWd?.count || 0} kali</code>`;

  const dashUrl = `https://qiospay-automation.mansyurj168.workers.dev/?uid=${userId}`;
  const kb = {
    inline_keyboard: [
      [
        { text: "⚡ Tarik ke E-Wallet", callback_data: "cb:prompt_tarik_wallet" },
        { text: "🔄 Tarik QRIS ➔ QiosPay", callback_data: "cb:tarik_qris_settle" }
      ],
      [
        { text: "📱 Set Nomor Tujuan", callback_data: "ew:input_phone" },
        { text: "⚙️ Pilih Produk E-Wallet", callback_data: "ew:menu" }
      ],
      [
        { text: "🔄 Refresh Status", callback_data: "cb:status" },
        { text: "💳 Buat QRIS", callback_data: "cb:qris_menu" }
      ],
      [
        { text: "🔑 Secret Key & API", callback_data: "cb:api_info" },
        { text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }
      ],
      [
        { text: "🌐 Buka Web Dashboard", url: dashUrl }
      ]
    ]
  };

  if (messageId) {
    await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, statusMsg, kb);
  } else {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, statusMsg, kb);
  }
}

async function renderWithdrawConfirmPrompt(env, chatId, messageId = null) {
  const configRows = await env.DB.prepare("SELECT key, value FROM config").all();
  const cfg = {};
  for (const r of (configRows.results || [])) cfg[r.key] = r.value;

  const targetProduct = cfg.target_product || "DP1";
  const destNumber = cfg.dana_dest || "083127060539";
  const hargaMax = parseInt(cfg.harga_max || "1560");
  const appBalance = parseInt(cfg.qiospay_app_balance || "0");

  const promptText = `⚠️ <b>KONFIRMASI PENARIKAN SALDO H2H</b>\n\n` +
    `Anda akan mengeksekusi penarikan saldo QiosPay ke E-Wallet tujuan dengan detail berikut:\n\n` +
    `📦 <b>Target Produk:</b> <code>${targetProduct}</code>\n` +
    `📱 <b>Nomor Tujuan:</b> <code>${destNumber}</code>\n` +
    `💵 <b>Estimasi Biaya Maks:</b> <code>Rp ${hargaMax.toLocaleString('id-ID')}</code>\n` +
    `💼 <b>Saldo Aplikasi Tersedia:</b> <code>Rp ${appBalance.toLocaleString('id-ID')}</code>\n\n` +
    `<i>Apakah Anda yakin ingin mengeksekusi penarikan sekarang?</i>`;

  const kb = {
    inline_keyboard: [
      [
        { text: "✅ YA, EKSEKUSI SEKARANG", callback_data: "cb:confirm_tarik_wallet" },
        { text: "❌ BATALKAN", callback_data: "cb:status" }
      ]
    ]
  };

  if (messageId) {
    await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, promptText, kb);
  } else {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, promptText, kb);
  }
}

function renderWalletCategoryKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔷 DANA", callback_data: "ew:cat:dana" },
        { text: "🟠 ShopeePay", callback_data: "ew:cat:shopee" }
      ],
      [
        { text: "🟢 GoPay", callback_data: "ew:cat:gopay" },
        { text: "🟣 OVO", callback_data: "ew:cat:ovo" }
      ],
      [
        { text: "🔴 LinkAja", callback_data: "ew:cat:linkaja" },
        { text: "📱 Set Nomor Tujuan", callback_data: "ew:input_phone" }
      ],
      [
        { text: "🔙 Kembali ke Menu Utama", callback_data: "cb:menu_utama" }
      ]
    ]
  };
}

function renderProductNominalKeyboard(catKey) {
  const cat = EWALLET_CATALOG[catKey];
  if (!cat) return renderWalletCategoryKeyboard();

  const rows = [];
  cat.products.forEach(p => {
    rows.push([{
      text: `${cat.icon} ${p.name} (Rp ${p.price.toLocaleString('id-ID')})`,
      callback_data: `ew:set:${p.code}:${p.max}`
    }]);
  });

  rows.push([{ text: "🔙 Pilih E-Wallet Lain", callback_data: "ew:menu" }]);

  return { inline_keyboard: rows };
}

// Handler Callback Query Tombol Inline
async function handleCallbackQuery(cb, env) {
  const data = cb.data;
  const user = cb.from;
  const chatId = cb.message?.chat?.id || user.id;
  const messageId = cb.message?.message_id;

  const admin = await getAdminUser(env, user.id);
  if (!admin) {
    await answerCallbackQuery(env.BOT_TOKEN, cb.id, "⛔ Akses ditolak.");
    return new Response("OK");
  }

  await answerCallbackQuery(env.BOT_TOKEN, cb.id, "Memproses...");

  // 1. Menu Utama Callback
  if (data === "cb:menu_utama") {
    const roleBadge = admin.role === "owner" ? "👑 OWNER" : "🛡️ ADMIN";
    const welcome = `🤖 <b>QIOSPAY AUTOMATION & DUAL ENGINE</b>\n` +
      `Status: <b>${roleBadge}</b> (<code>${user.id}</code>)\n\n` +
      `Silakan pilih menu operasional di bawah ini:`;

    const dashUrl = `https://qiospay-automation.mansyurj168.workers.dev/?uid=${user.id}`;
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📊 Cek Dual Saldo", callback_data: "cb:status" },
          { text: "⚡ Tarik ke E-Wallet", callback_data: "cb:prompt_tarik_wallet" }
        ],
        [
          { text: "🔄 Tarik QRIS ➔ QiosPay", callback_data: "cb:tarik_qris_settle" },
          { text: "💳 Buat QRIS Dinamis", callback_data: "cb:qris_menu" }
        ],
        [
          { text: "📱 Set Nomor Tujuan", callback_data: "ew:input_phone" },
          { text: "⚙️ Pilih Produk E-Wallet", callback_data: "ew:menu" }
        ],
        [
          { text: "📥 Mutasi QRIS", callback_data: "cb:mutasi" },
          { text: "📤 Riwayat WD", callback_data: "cb:h2h" }
        ],
        [
          { text: "🔑 Secret Key & API", callback_data: "cb:api_info" },
          { text: "👥 Admin", callback_data: "cb:listadmin" }
        ],
        [
          { text: "🌐 Web Dashboard", url: dashUrl }
        ]
      ]
    };

    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, welcome, inlineKeyboard);
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, welcome, inlineKeyboard);
    }
  }

  // 2. Status Callback
  else if (data === "cb:status") {
    await renderStatusMessage(env, chatId, user.id, messageId);
  }

  // 3. Tombol 1: Tarik Saldo QRIS ke QiosPay (Settlement / Sync)
  else if (data === "cb:tarik_qris_settle") {
    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, "⏳ Sedang menyinkronkan & memindahkan saldo mutasi QRIS ke saldo aplikasi QiosPay...");
    }

    const syncRes = await syncQrisBalance(env);
    const msg = `✅ <b>PENARIKAN SALDO QRIS ➔ QIOSPAY BERHASIL!</b>\n\n` +
      `💳 <b>Saldo QRIS Terkumpul:</b> <code>Rp ${syncRes.qrisBalance.toLocaleString('id-ID')}</code>\n` +
      `💼 <b>Saldo Aplikasi QiosPay:</b> <code>Rp ${syncRes.qrisBalance.toLocaleString('id-ID')}</code>\n` +
      `📥 <b>Total Mutasi Masuk:</b> <code>${syncRes.newMutationsCount} transaksi</code>\n\n` +
      `<i>Saldo kini siap dicairkan ke E-Wallet penampung Anda!</i>`;

    const kb = {
      inline_keyboard: [
        [{ text: "⚡ Tarik ke E-Wallet Sekarang", callback_data: "cb:prompt_tarik_wallet" }],
        [{ text: "📊 Cek Status", callback_data: "cb:status" }]
      ]
    };

    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, msg, kb);
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, msg, kb);
    }
  }

  // 4. Tombol 2: Tampilkan Konfirmasi Tarik QiosPay ke Wallet (YES/NO Prompt)
  else if (data === "cb:prompt_tarik_wallet") {
    await renderWithdrawConfirmPrompt(env, chatId, messageId);
  }

  // 5. Eksekusi Tarik Setelah Diklik "YES"
  else if (data === "cb:confirm_tarik_wallet") {
    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, "⏳ Sedang mengeksekusi penarikan H2H ke nomor tujuan...");
    }

    const res = await executeAutoWithdrawal(env, `CONFIRMED_BUTTON_${user.id}`);
    if (!res.success) {
      const errAlert = `⚠️ <b>Eksekusi H2H Gagal / Ditangguhkan:</b>\n\n${res.message || res.error}`;
      const kb = {
        inline_keyboard: [
          [{ text: "🔄 Tarik QRIS ➔ QiosPay Dulu", callback_data: "cb:tarik_qris_settle" }],
          [{ text: "🔙 Kembali ke Status", callback_data: "cb:status" }]
        ]
      };
      if (messageId) {
        await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, errAlert, kb);
      } else {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, errAlert, kb);
      }
    }
  }

  // 6. E-Wallet Menu Callback
  else if (data === "ew:menu") {
    const promptMsg = `⚙️ <b>PENGATURAN E-WALLET PENAMPUNG (INLINE MODE)</b>\n\n` +
      `Silakan pilih jenis E-Wallet yang ingin Anda jadikan tujuan pencairan:`;

    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, promptMsg, renderWalletCategoryKeyboard());
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, promptMsg, renderWalletCategoryKeyboard());
    }
  }

  // 7. E-Wallet Category Selection (DANA, GoPay, OVO, ShopeePay, LinkAja)
  else if (data.startsWith("ew:cat:")) {
    const catKey = data.replace("ew:cat:", "");
    const cat = EWALLET_CATALOG[catKey];
    if (cat) {
      const catMsg = `${cat.icon} <b>PILIH NOMINAL ${cat.name.toUpperCase()} (H2H OTOMATIS)</b>\n\n` +
        `Pilih paket nominal penarikan yang Anda inginkan:`;

      if (messageId) {
        await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, catMsg, renderProductNominalKeyboard(catKey));
      } else {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, catMsg, renderProductNominalKeyboard(catKey));
      }
    }
  }

  // 8. Set Product & Harga Max via Inline Callback
  else if (data.startsWith("ew:set:")) {
    const [, , prodCode, maxPrice] = data.split(":");
    if (prodCode && maxPrice) {
      await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'target_product'").bind(prodCode).run();
      await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'harga_max'").bind(maxPrice).run();

      const lastDest = await env.DB.prepare("SELECT value FROM config WHERE key = 'dana_dest'").first();

      const successMsg = `✅ <b>PRODUK E-WALLET BERHASIL DIUBAH!</b>\n\n` +
        `📦 <b>Kode Produk:</b> <code>${prodCode}</code>\n` +
        `💵 <b>Harga Maks Proteksi:</b> <code>Rp ${parseInt(maxPrice).toLocaleString('id-ID')}</code>\n` +
        `📱 <b>Nomor Penampung:</b> <code>${lastDest?.value || "083127060539"}</code>\n\n` +
        `<i>Sistem akan otomatis mengeksekusi produk ini saat penarikan saldo dilakukan.</i>`;

      const kb = {
        inline_keyboard: [
          [
            { text: "⚡ Tarik ke Wallet Sekarang", callback_data: "cb:prompt_tarik_wallet" },
            { text: "📊 Cek Status", callback_data: "cb:status" }
          ],
          [
            { text: "🔄 Pilih Produk Lain", callback_data: "ew:menu" },
            { text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }
          ]
        ]
      };

      if (messageId) {
        await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, successMsg, kb);
      } else {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, successMsg, kb);
      }
    }
  }

  // 9. Panduan Input Nomor HP
  else if (data === "ew:input_phone") {
    const hintMsg = `📱 <b>CARA MENGUBAH NOMOR TUJUAN E-WALLET:</b>\n\n` +
      `Ketik perintah di chat seperti contoh berikut:\n` +
      `👉 <code>/setnomor 083127060539</code> 👈\n\n` +
      `<i>Sistem akan otomatis memvalidasi nomor telepon dan menyimpannya ke database.</i>`;

    const kb = {
      inline_keyboard: [
        [{ text: "⚙️ Pilih Produk E-Wallet", callback_data: "ew:menu" }],
        [{ text: "🔙 Kembali ke Menu Utama", callback_data: "cb:menu_utama" }]
      ]
    };

    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, hintMsg, kb);
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, hintMsg, kb);
    }
  }

  // 9.B Panduan Ubah Secret Key API Tunggal
  else if (data === "cb:prompt_setkey") {
    const singleKey = await getSingleSecretKey(env);
    const hintMsg = `🔑 <b>CARA MENGGANTI SECRET KEY API TUNGGAL:</b>\n\n` +
      `Secret Key Aktif Saat Ini: <code>${singleKey}</code>\n\n` +
      `Ketik perintah di chat untuk mengganti kunci baru:\n` +
      `👉 <code>/setkey rahasia123</code> 👈\n\n` +
      `<i>Setelah dikirim, bot lain yang menggunakan kunci lama akan otomatis ditolak dan wajib menggunakan kunci baru.</i>`;

    const kb = {
      inline_keyboard: [
        [{ text: "🌐 Kembali ke Info API", callback_data: "cb:api_info" }],
        [{ text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }]
      ]
    };

    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, hintMsg, kb);
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, hintMsg, kb);
    }
  }

  // 10. Mutasi QRIS
  else if (data === "cb:mutasi") {
    const { results } = await env.DB.prepare("SELECT amount, buyer_name, refid FROM mutations ORDER BY id DESC LIMIT 5").all();
    let text = "📥 <b>5 Mutasi QRIS Terakhir:</b>\n\n";
    (results || []).forEach((m, i) => {
      text += `${i + 1}. Rp ${m.amount.toLocaleString('id-ID')} | <code>${m.buyer_name}</code>\n`;
    });
    const kb = {
      inline_keyboard: [
        [{ text: "🔄 Refresh Mutasi", callback_data: "cb:mutasi" }],
        [{ text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }]
      ]
    };
    await sendTelegramMessage(env.BOT_TOKEN, chatId, text || "Belum ada mutasi tersimpan.", kb);
  }

  // 11. Riwayat H2H
  else if (data === "cb:h2h") {
    const { results } = await env.DB.prepare("SELECT product, dest, status FROM h2h_transactions ORDER BY id DESC LIMIT 5").all();
    let text = "📤 <b>5 Transaksi WD E-Wallet Terakhir:</b>\n\n";
    (results || []).forEach((h, i) => {
      text += `${i + 1}. ${h.product} -> <code>${h.dest}</code> [<b>${h.status}</b>]\n`;
    });
    const kb = {
      inline_keyboard: [
        [{ text: "🔄 Refresh Riwayat", callback_data: "cb:h2h" }],
        [{ text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }]
      ]
    };
    await sendTelegramMessage(env.BOT_TOKEN, chatId, text || "Belum ada transaksi H2H.", kb);
  }

  // 12.A Info API untuk Bot Lain
  else if (data === "cb:api_info") {
    const singleKey = await getSingleSecretKey(env);
    const host = "https://qiospay-automation.mansyurj168.workers.dev";
    const apiMsg = `🌐 <b>PANDUAN PRIVATE API QRIS (UNTUK BOT LAIN)</b>\n\n` +
      `⚡ <i>Berjalan di Cloudflare Edge D1, respon kilat (10-30ms), bebas limit, dan aman dicek detikan.</i>\n\n` +
      `🔑 <b>SECRET KEY TUNGGAL AKTIF:</b>\n` +
      `👉 <code>${singleKey}</code> 👈\n\n` +
      `<i>(Hanya 1 kunci ini yang sah untuk otentikasi bot lain. Bisa diubah kapan saja)</i>\n\n` +
      `🔗 <b>Format URL Pemanggilan (GET):</b>\n\n` +
      `1️⃣ <b>Cek Mutasi per Nominal:</b>\n` +
      `<code>${host}/api/qris/mutasi?key=${singleKey}&nominal=10231</code>\n\n` +
      `2️⃣ <b>Cek Mutasi per Ref ID:</b>\n` +
      `<code>${host}/api/qris/mutasi?key=${singleKey}&refid=231695940439</code>\n\n` +
      `3️⃣ <b>Cek Tagihan Dinamis Kode Unik:</b>\n` +
      `<code>${host}/api/qris/check?key=${singleKey}&trx_id=INV12345</code>\n\n` +
      `4️⃣ <b>Generate QRIS Dinamis via URL:</b>\n` +
      `<code>${host}/api/qris/generate?key=${singleKey}&amount=10000</code>\n\n` +
      `💡 <i>Ketik <code>/setkey &lt;kunci_baru&gt;</code> di chat untuk mengganti secret key.</i>`;

    const kb = {
      inline_keyboard: [
        [
          { text: "🔑 Cara Ganti Secret Key", callback_data: "cb:prompt_setkey" },
          { text: "🔄 Refresh Key", callback_data: "cb:api_info" }
        ],
        [
          { text: "📥 Cek Mutasi QRIS", callback_data: "cb:mutasi" },
          { text: "💳 Buat QRIS Dinamis", callback_data: "cb:qris_menu" }
        ],
        [
          { text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }
        ]
      ]
    };

    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, apiMsg, kb);
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, apiMsg, kb);
    }
  }

  // 12. Daftar Admin
  else if (data === "cb:listadmin") {
    const { results } = await env.DB.prepare("SELECT user_id, username, role FROM admins").all();
    let text = "👥 <b>Daftar Admin Pengelola:</b>\n\n";
    (results || []).forEach((a, i) => {
      text += `${i + 1}. <b>${a.username}</b> (<code>${a.user_id}</code>) - ${a.role}\n`;
    });
    await sendTelegramMessage(env.BOT_TOKEN, chatId, text);
  }

  // 13. QRIS Menu (Pilih Nominal Cepat & Kode Unik)
  else if (data === "cb:qris_menu") {
    const qrisPrompt = `💳 <b>BUAT QRIS DINAMIS DENGAN KODE UNIK:</b>\n\n` +
      `Sistem akan otomatis menambahkan kode unik acak untuk memvalidasi pembayaran Anda dalam waktu <b>3 menit</b> (dengan toleransi proses perbankan 1 menit di background).\n\n` +
      `Silakan pilih nominal cepat di bawah atau ketik manual (contoh: <code>/qris 15000</code>):`;

    const kb = {
      inline_keyboard: [
        [
          { text: "Rp 5.000", callback_data: "cb:gen_qris:5000" },
          { text: "Rp 10.000", callback_data: "cb:gen_qris:10000" },
          { text: "Rp 20.000", callback_data: "cb:gen_qris:20000" }
        ],
        [
          { text: "Rp 50.000", callback_data: "cb:gen_qris:50000" },
          { text: "Rp 100.000", callback_data: "cb:gen_qris:100000" },
          { text: "Rp 250.000", callback_data: "cb:gen_qris:250000" }
        ],
        [{ text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }]
      ]
    };

    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, qrisPrompt, kb);
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, qrisPrompt, kb);
    }
  }

  // 14. Action Generate QRIS dari Tombol Nominal Cepat
  else if (data.startsWith("cb:gen_qris:")) {
    const amtStr = data.replace("cb:gen_qris:", "");
    const amtNum = parseInt(amtStr) || 10000;

    try {
      const inv = await createUniqueQrisInvoice(env, amtNum, user.id, chatId);
      const expDate = new Date(inv.user_expires_at + (7 * 3600 * 1000)); // WIB (+7)
      const expTimeStr = expDate.toISOString().slice(11, 19);

      const caption = `💳 <b>TAGIHAN QRIS DINAMIS (KODE UNIK)</b>\n\n` +
        `🆔 <b>No. Tagihan:</b> <code>${inv.trx_id}</code>\n` +
        `💵 <b>Nominal Pokok:</b> <code>Rp ${inv.nominal_base.toLocaleString('id-ID')}</code>\n` +
        `🔢 <b>Kode Unik:</b> <code>Rp ${inv.unique_code}</code>\n` +
        `💰 <b>TOTAL HARUS DIBAYAR:</b>\n` +
        `👉 <b><code>Rp ${inv.nominal_total.toLocaleString('id-ID')}</code></b> 👈\n\n` +
        `⚠️ <b>PANDUAN PEMBAYARAN:</b>\n` +
        `• Wajib transfer <b>PERSIS</b> <code>Rp ${inv.nominal_total.toLocaleString('id-ID')}</code> sampai digit terakhir.\n` +
        `• Sistem akan <b>otomatis memvalidasi</b> pembayaran Anda.\n` +
        `⏳ <b>Batas Waktu:</b> <b>3 MENIT</b> (Hingga ${expTimeStr} WIB)\n` +
        `<i>(Jika lewat 3 menit belum dibayar, QRIS otomatis kedaluwarsa).</i>\n\n` +
        `📋 <b>String QRIS (1-Tap Copy):</b>\n<code>${inv.qris_string}</code>`;

      const kb = {
        inline_keyboard: [
          [
            { text: "🔄 Cek Status Pembayaran", callback_data: `cb:check_inv:${inv.trx_id}` },
            { text: "❌ Batalkan Tagihan", callback_data: `cb:cancel_inv:${inv.trx_id}` }
          ]
        ]
      };

      if (inv.qr_image_url) {
        await sendTelegramPhoto(env.BOT_TOKEN, chatId, inv.qr_image_url, caption, kb);
      } else {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, caption, kb);
      }
    } catch (err) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, `❌ Gagal membuat QRIS: ${err.message}`);
    }
  }

  // 15. Action Cek Status Tagihan QRIS Dinamis
  else if (data.startsWith("cb:check_inv:")) {
    const trxId = data.replace("cb:check_inv:", "");
    const inv = await env.DB.prepare("SELECT * FROM qris_invoices WHERE trx_id = ?").bind(trxId).first();
    if (!inv) {
      await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, "Tagihan tidak ditemukan.");
      return new Response("OK");
    }

    const now = Date.now();
    if (inv.status === "PAID") {
      const paidMsg = `✅ <b>TAGIHAN INI TELAH LUNAS!</b>\n\n` +
        `🆔 <b>Invoice:</b> <code>${inv.trx_id}</code>\n` +
        `💰 <b>Total Dibayar:</b> <code>Rp ${inv.nominal_total.toLocaleString('id-ID')}</code>\n` +
        `👤 <b>Pengirim:</b> <code>${escapeHtml(inv.buyer_name || "Pelanggan")}</code>\n` +
        `🆔 <b>Ref ID:</b> <code>${inv.paid_refid || "-"}</code>\n\n` +
        `<i>Status: Pembayaran telah berhasil diverifikasi otomatis oleh sistem!</i>`;
      await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, "Tagihan SUDAH LUNAS! ✅");
      if (messageId) {
        await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, paidMsg, null);
      }
    } else if (inv.status === "EXPIRED" || now > inv.user_expires_at) {
      const isGrace = now <= inv.grace_expires_at;
      const expMsg = `❌ <b>TAGIHAN TELAH KEDALUWARSA (EXPIRED)!</b>\n\n` +
        `🆔 <b>Invoice:</b> <code>${inv.trx_id}</code>\n` +
        `💵 <b>Total Tagihan:</b> <code>Rp ${inv.nominal_total.toLocaleString('id-ID')}</code>\n\n` +
        `⚠️ <i>Waktu pembayaran 3 menit telah berakhir. QRIS ini sudah tidak valid. Silakan buat tagihan baru.</i>` +
        (isGrace ? `\n\n🕒 <i>(Sistem masih memantau proses mutasi bank selama 1 menit...)</i>` : "");

      await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, "Tagihan telah kedaluwarsa!");
      if (messageId) {
        await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, expMsg, null);
      }
    } else {
      const remSec = Math.max(0, Math.floor((inv.user_expires_at - now) / 1000));
      const m = Math.floor(remSec / 60);
      const s = remSec % 60;
      const remStr = `${m}m ${s < 10 ? '0' : ''}${s}s`;

      await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, `⏳ Menunggu pembayaran. Sisa waktu: ${remStr}`);
    }
  }

  // 16. Action Batalkan Tagihan QRIS Dinamis
  else if (data.startsWith("cb:cancel_inv:")) {
    const trxId = data.replace("cb:cancel_inv:", "");
    await env.DB.prepare("UPDATE qris_invoices SET status = 'CANCELLED' WHERE trx_id = ?").bind(trxId).run();
    await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, "Tagihan berhasil dibatalkan.");
    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, `🚫 <b>TAGIHAN DIBATALKAN</b>\n\nNo. Tagihan <code>${trxId}</code> telah dibatalkan oleh pengguna. QRIS tidak lagi berlaku.`, null);
    }
  }

  return new Response("OK");
}

// Broadcast pesan penting ke seluruh admin terdaftar
async function broadcastToAllAdmins(env, text) {
  if (!env.BOT_TOKEN) return;
  const adminIds = new Set();
  if (env.ADMIN_ID) adminIds.add(String(env.ADMIN_ID));

  if (env.DB) {
    const { results } = await env.DB.prepare("SELECT user_id FROM admins").all();
    for (const r of (results || [])) adminIds.add(String(r.user_id));
  }

  for (const id of adminIds) {
    await sendTelegramMessage(env.BOT_TOKEN, id, text).catch(() => {});
  }
}

// ============================================================================
// MODUL 6: DASHBOARD HTML (TAILWIND CSS & TELEGRAM WEBAPP AUTO-FILL)
// ============================================================================

function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QiosPay Automation & QRIS Engine</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #080C15; color: #E2E8F0; }
    .glass { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .btn-gradient { background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); }
    .btn-emerald { background: linear-gradient(135deg, #10B981 0%, #059669 100%); }
    .btn-amber { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); }
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
          <span class="text-[10px] ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">DUAL-SALDO LIVE</span>
        </div>
      </div>
      <div class="flex items-center gap-4 text-xs">
        <div id="userBadge" class="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span id="loggedUserName">Admin</span>
        </div>
        <button onclick="logout()" class="text-slate-400 hover:text-rose-400 transition">Keluar</button>
      </div>
    </div>
  </nav>

  <!-- LOGIN MODAL (OTP TELEGRAM + AUTO FILL TELEGRAM ID) -->
  <div id="loginModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div class="glass max-w-md w-full rounded-2xl p-6 border border-slate-700/80 shadow-2xl">
      <div class="text-center mb-6">
        <div class="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto text-2xl mb-3">
          🔐
        </div>
        <h3 class="text-lg font-bold text-white">Login Multi-Admin Dashboard</h3>
        <p class="text-xs text-slate-400 mt-1" id="loginDesc">ID Telegram terisi otomatis. Klik tombol di bawah untuk meminta kode OTP.</p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Telegram User ID</label>
          <input type="text" id="tgUserId" placeholder="Contoh: 682723201" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500">
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

    <!-- METRICS CARDS (DUAL SALDO: QRIS & QIOSPAY APP + DUA TOMBOL TARIK) -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="glass p-5 rounded-2xl border-l-4 border-l-sky-500">
        <span class="text-xs text-slate-400 font-medium">Saldo Aplikasi QiosPay</span>
        <p id="appBalance" class="text-2xl font-bold text-sky-400 mt-1">Rp 0</p>
        <span class="text-[10px] text-slate-500">Saldo siap ditarik ke E-Wallet</span>
      </div>
      <div class="glass p-5 rounded-2xl border-l-4 border-l-emerald-500">
        <span class="text-xs text-slate-400 font-medium">Saldo Akun QRIS</span>
        <p id="qrisBalance" class="text-2xl font-bold text-emerald-400 mt-1">Rp 0</p>
        <span class="text-[10px] text-slate-500">Terkumpul dari scan QRIS</span>
      </div>
      <div class="glass p-5 rounded-2xl border-l-4 border-l-indigo-500">
        <span class="text-xs text-slate-400 font-medium">Target E-Wallet Penampung</span>
        <p id="danaDest" class="text-base font-bold text-white mt-1">083127060539</p>
        <span id="targetProd" class="text-[10px] text-sky-400 font-mono">DP1 (DANA 1k)</span>
      </div>
      <div class="glass p-5 rounded-2xl border-l-4 border-l-amber-500 flex flex-col justify-center gap-2">
        <button onclick="triggerQrisSettle()" id="btnQrisSettle" class="btn-amber py-2 px-3 rounded-xl text-xs font-bold text-white shadow">
          🔄 Tarik QRIS ➔ QiosPay
        </button>
        <button onclick="triggerManualWd()" id="btnTriggerWd" class="btn-gradient py-2 px-3 rounded-xl text-xs font-bold text-white shadow">
          ⚡ Tarik QiosPay ➔ Wallet
        </button>
      </div>
    </div>

    <!-- TABS NAVIGATION -->
    <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
      <button onclick="switchTab('tab-overview')" id="btn-tab-overview" class="px-4 py-2 text-xs font-bold rounded-xl bg-sky-500 text-white">📊 Mutasi & H2H</button>
      <button onclick="switchTab('tab-qris')" id="btn-tab-qris" class="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white">💳 Generate QRIS Dinamis</button>
      <button onclick="switchTab('tab-admin')" id="btn-tab-admin" class="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white">👥 Manajemen Admin</button>
      <button onclick="switchTab('tab-config')" id="btn-tab-config" class="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white">⚙️ Pengaturan E-Wallet</button>
    </div>

    <!-- TAB 1: OVERVIEW & TABLES -->
    <div id="tab-overview" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- MUTASI QRIS -->
        <div class="glass rounded-2xl p-5">
          <h4 class="text-xs font-bold text-white mb-3 flex items-center justify-between">
            <span class="flex items-center gap-2"><span>📥</span> Mutasi QRIS Realtime</span>
            <span class="text-[10px] text-slate-500 font-mono">D1 Cache Fast API</span>
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
          <h4 class="text-xs font-bold text-white mb-3 flex items-center justify-between">
            <span class="flex items-center gap-2"><span>📤</span> Riwayat Penarikan H2H ke E-Wallet</span>
            <span class="text-[10px] text-slate-500 font-mono">OtomaX Signature</span>
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
    </div>

    <!-- TAB 2: QRIS DYNAMIC GENERATOR -->
    <div id="tab-qris" class="hidden glass rounded-2xl p-6 space-y-6">
      <div class="max-w-xl">
        <h3 class="text-base font-bold text-white mb-2">💳 Generate QRIS Dinamis</h3>
        <p class="text-xs text-slate-400 mb-4">Ubah QRIS statis menjadi QRIS dinamis dengan nominal otomatis menggunakan kalkulasi CRC16-CCITT.</p>
        <div class="flex gap-3">
          <input type="number" id="genAmount" placeholder="Contoh: 5000" class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white">
          <button onclick="generateQris()" class="btn-gradient px-6 py-2.5 rounded-xl font-bold text-xs text-white">Generate QR</button>
        </div>
      </div>

      <div id="qrisResultArea" class="hidden pt-4 border-t border-slate-800 flex flex-col md:flex-row items-center gap-6">
        <div class="bg-white p-3 rounded-2xl shadow-xl">
          <img id="qrisImg" src="" alt="QR Code" class="w-64 h-64 object-contain">
        </div>
        <div class="flex-1 space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">String QRIS Hasil Generate (1-Tap Copy):</label>
            <textarea id="qrisStringText" rows="4" readonly class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-emerald-400"></textarea>
          </div>
          <button onclick="copyQrisString()" class="btn-emerald px-4 py-2 rounded-xl text-xs font-bold text-white">📋 Salin String QRIS</button>
        </div>
      </div>
    </div>

    <!-- TAB 3: MANAJEMEN ADMIN -->
    <div id="tab-admin" class="hidden glass rounded-2xl p-6 space-y-6">
      <div>
        <h3 class="text-base font-bold text-white mb-2">👥 Manajemen Administrator</h3>
        <p class="text-xs text-slate-400 mb-4">Tambahkan administrator baru yang berhak mengakses bot Telegram dan Web Dashboard ini.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl">
          <input type="number" id="newAdminId" placeholder="Telegram User ID (Contoh: 123456789)" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
          <input type="text" id="newAdminUser" placeholder="Username / Nama Admin" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
          <button onclick="addAdmin()" class="btn-emerald py-2 rounded-xl text-xs font-bold text-white">➕ Tambah Admin</button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-300">
          <thead class="text-[10px] uppercase text-slate-500 border-b border-slate-800">
            <tr>
              <th class="pb-2">User ID</th>
              <th class="pb-2">Nama / Username</th>
              <th class="pb-2">Role</th>
              <th class="pb-2">Aksi</th>
            </tr>
          </thead>
          <tbody id="adminTableBody" class="divide-y divide-slate-800/60 font-mono text-[11px]">
            <tr><td colspan="4" class="py-4 text-center text-slate-500">Memuat data admin...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: CONFIGURATION & SETTINGS -->
    <div id="tab-config" class="hidden glass rounded-2xl p-6 space-y-6">
      <h3 class="text-base font-bold text-white mb-2">⚙️ Pengaturan E-Wallet Penampung</h3>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div>
          <label class="block text-slate-400 mb-1">Nomor HP Penampung</label>
          <input type="text" id="cfgDanaDest" placeholder="083127060539" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white">
        </div>
        <div>
          <label class="block text-slate-400 mb-1">Produk E-Wallet Qiospay</label>
          <select id="cfgProduct" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white">
            <optgroup label="🔷 DANA (Uji Coba & Standar)">
              <option value="DP1">DANA 1k VIP (Rp 1.060)</option>
              <option value="DP2">DANA 2k VIP (Rp 2.060)</option>
              <option value="DP5">DANA 5k VIP (Rp 5.060)</option>
              <option value="DANA10">DANA 10k (Rp 10.055)</option>
              <option value="DANA20">DANA 20k (Rp 20.055)</option>
              <option value="DANA50">DANA 50k (Rp 50.055)</option>
              <option value="DANA100">DANA 100k (Rp 100.040)</option>
            </optgroup>
            <optgroup label="🟢 GoPay">
              <option value="GOPAY10">GoPay 10k (Rp 10.460)</option>
              <option value="GOPAY20">GoPay 20k (Rp 20.460)</option>
              <option value="GOPAY50">GoPay 50k (Rp 50.460)</option>
              <option value="GOPAY100">GoPay 100k (Rp 100.460)</option>
            </optgroup>
            <optgroup label="🟣 OVO">
              <option value="OVO10">OVO 10k (Rp 9.625)</option>
              <option value="OVO20">OVO 20k (Rp 19.125)</option>
              <option value="OVO50">OVO 50k (Rp 49.125)</option>
              <option value="OVO100">OVO 100k (Rp 99.125)</option>
            </optgroup>
            <optgroup label="🟠 ShopeePay">
              <option value="QSPAY10">ShopeePay 10k (Rp 10.139)</option>
              <option value="QSPAY20">ShopeePay 20k (Rp 20.139)</option>
              <option value="QSPAY50">ShopeePay 50k (Rp 50.300)</option>
              <option value="QSPAY100">ShopeePay 100k (Rp 100.300)</option>
            </optgroup>
            <optgroup label="🔴 LinkAja">
              <option value="LA10">LinkAja 10k (Rp 9.635)</option>
              <option value="LA20">LinkAja 20k (Rp 19.635)</option>
              <option value="LA50">LinkAja 50k (Rp 49.635)</option>
              <option value="LA100">LinkAja 100k (Rp 99.635)</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label class="block text-slate-400 mb-1">Batas Harga Max (IDR)</label>
          <input type="number" id="cfgHargaMax" value="1560" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white">
        </div>
        <div class="flex items-end">
          <button onclick="saveConfig()" class="w-full btn-emerald py-2 rounded-xl text-xs font-bold text-white">
            💾 Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>

  </main>

  <!-- CLIENT SCRIPT -->
  <script>
    // AUTO-FILL TELEGRAM USER ID JIKA DIBUKA DI DALAM TELEGRAM BROWSER / LINK DENGAN PARAMETER
    window.addEventListener('DOMContentLoaded', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const uidFromQuery = urlParams.get('uid');
      const uidFromTgSdk = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      const detectedUid = uidFromQuery || uidFromTgSdk;

      if (detectedUid) {
        const idInput = document.getElementById('tgUserId');
        idInput.value = detectedUid;
        const desc = document.getElementById('loginDesc');
        desc.innerHTML = 'ID Telegram terdeteksi otomatis: <b class=\"text-sky-400\">' + detectedUid + '</b>. Klik tombol di bawah untuk meminta kode OTP.';
      }
    });

    function switchTab(tabId) {
      ['tab-overview', 'tab-qris', 'tab-admin', 'tab-config'].forEach(t => {
        document.getElementById(t).classList.add('hidden');
        document.getElementById('btn-' + t).className = 'px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white';
      });
      document.getElementById(tabId).classList.remove('hidden');
      document.getElementById('btn-' + tabId).className = 'px-4 py-2 text-xs font-bold rounded-xl bg-sky-500 text-white';
    }

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
          localStorage.setItem('qios_user', JSON.stringify(data.user));
          document.getElementById('loginModal').classList.add('hidden');
          setupUserBadge(data.user);
          loadDashboardData();
        } else {
          msg.innerText = data.message;
        }
      } catch (e) {
        msg.innerText = 'Error: ' + e.message;
      }
    }

    function setupUserBadge(user) {
      if (!user) return;
      document.getElementById('userBadge').classList.remove('hidden');
      document.getElementById('loggedUserName').innerText = user.username + ' (' + user.role + ')';
    }

    function logout() {
      localStorage.removeItem('qios_token');
      localStorage.removeItem('qios_user');
      location.reload();
    }

    async function loadDashboardData() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();

        // Cards (Dual Saldo)
        document.getElementById('appBalance').innerText = 'Rp ' + (data.qiospay_app_balance || 0).toLocaleString('id-ID');
        document.getElementById('qrisBalance').innerText = 'Rp ' + (data.qris_balance || 0).toLocaleString('id-ID');
        document.getElementById('danaDest').innerText = data.config.dana_dest || '083127060539';
        document.getElementById('targetProd').innerText = data.config.target_product || 'DP1';

        // Inputs
        document.getElementById('cfgDanaDest').value = data.config.dana_dest || '083127060539';
        document.getElementById('cfgProduct').value = data.config.target_product || 'DP1';
        document.getElementById('cfgHargaMax').value = data.config.harga_max || '1560';

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

        // Admins Table
        const aBody = document.getElementById('adminTableBody');
        if (data.admins.length === 0) {
          aBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">Tidak ada admin tambahan.</td></tr>';
        } else {
          aBody.innerHTML = data.admins.map(a => \`
            <tr>
              <td class="py-2.5 text-white">\${a.user_id}</td>
              <td class="py-2.5 text-sky-400 font-semibold">\${a.username || '-'}</td>
              <td class="py-2.5">\${a.role === 'owner' ? '<span class=\"text-amber-400\">OWNER</span>' : '<span class=\"text-emerald-400\">ADMIN</span>'}</td>
              <td class="py-2.5">
                \${a.role !== 'owner' ? \`<button onclick=\"deleteAdmin('\${a.user_id}')\" class=\"text-rose-400 hover:underline\">Hapus</button>\` : '-'}
              </td>
            </tr>
          \`).join('');
        }
      } catch (e) {
        console.error("Dashboard Load Error:", e);
      }
    }

    async function generateQris() {
      const amount = document.getElementById('genAmount').value.trim();
      try {
        const res = await fetch('/api/qris/generate?amount=' + amount);
        const json = await res.json();
        if (json.status === 'success') {
          document.getElementById('qrisResultArea').classList.remove('hidden');
          document.getElementById('qrisImg').src = json.data.qr_image_url;
          document.getElementById('qrisStringText').value = json.data.qris_string;
        }
      } catch (e) {
        alert('Gagal generate: ' + e.message);
      }
    }

    function copyQrisString() {
      const copyText = document.getElementById('qrisStringText');
      copyText.select();
      navigator.clipboard.writeText(copyText.value);
      alert('String QRIS berhasil disalin!');
    }

    async function addAdmin() {
      const uid = document.getElementById('newAdminId').value.trim();
      const uname = document.getElementById('newAdminUser').value.trim();
      if (!uid) return alert('Masukkan Telegram ID');

      try {
        const res = await fetch('/api/dashboard/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', user_id: uid, username: uname })
        });
        const data = await res.json();
        alert(data.message || 'Admin ditambahkan');
        loadDashboardData();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function deleteAdmin(uid) {
      if (!confirm('Yakin ingin menghapus admin ID ' + uid + '?')) return;
      try {
        const res = await fetch('/api/dashboard/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', user_id: uid })
        });
        const data = await res.json();
        alert(data.message || 'Admin dihapus');
        loadDashboardData();
      } catch (e) {
        alert('Error: ' + e.message);
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

    async function triggerQrisSettle() {
      const btn = document.getElementById('btnQrisSettle');
      btn.disabled = true;
      btn.innerText = 'Menyinkronkan...';

      try {
        const res = await fetch('/api/dashboard/trigger-qris-settle', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Sinkronisasi QRIS sukses!');
        loadDashboardData();
      } catch (e) {
        alert('Error: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.innerText = '🔄 Tarik QRIS ➔ QiosPay';
      }
    }

    async function triggerManualWd() {
      if (!confirm('Apakah Anda yakin ingin mengeksekusi penarikan saldo QiosPay ke E-Wallet penampung sekarang?')) return;

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
        btn.innerText = '⚡ Tarik QiosPay ➔ Wallet';
      }
    }

    // Auto-check session on load
    if (localStorage.getItem('qios_token')) {
      document.getElementById('loginModal').classList.add('hidden');
      try {
        const u = JSON.parse(localStorage.getItem('qios_user'));
        setupUserBadge(u);
      } catch(_) {}
      loadDashboardData();
      setInterval(loadDashboardData, 10000);
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// MODUL 7: UTILS & TELEGRAM SENDER
// ============================================================================

async function sendTelegramMessage(botToken, chatId, text, replyMarkup = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    return await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Failed sending Telegram message:", e);
  }
}

async function editTelegramMessage(botToken, chatId, messageId, text, replyMarkup = null) {
  try {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    return await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Failed editing Telegram message:", e);
  }
}

async function sendTelegramPhoto(botToken, chatId, photoUrl, caption = "", replyMarkup = null) {
  try {
    const payload = {
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: "HTML"
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    return await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Failed sending Telegram photo:", e);
  }
}

async function answerCallbackQuery(botToken, callbackQueryId, text = "") {
  try {
    return await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      })
    });
  } catch (e) {
    console.error("Failed answering callback query:", e);
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
