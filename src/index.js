/**
 * QIOSPAY AUTOMATION & QRIS ENGINE
 * Powered by Cloudflare Workers & Cloudflare D1 Database
 * Multi-Admin Role Support, Dual Withdrawal Controls & In-App Auto-Fill
 */

// KATALOG LENGKAP E-WALLET & PRODUK H2H QIOSPAY (TERMASUK DENOMINASI MIKRO UNTUK UJI COBA)
const EWALLET_CATALOG = {
  dana: {
    name: "DANA",
    icon: "🔷",
    products: [
      { code: "DP1", name: "DANA 1.000 (VIP)", price: 1060, max: 1560 },
      { code: "DP2", name: "DANA 2.000 (VIP)", price: 2060, max: 2560 },
      { code: "DP5", name: "DANA 5.000 (VIP)", price: 5060, max: 5560 },
      { code: "DANA10", name: "DANA 10.000", price: 10055, max: 10555 },
      { code: "DANA20", name: "DANA 20.000", price: 20055, max: 20555 },
      { code: "DANA50", name: "DANA 50.000", price: 50055, max: 50555 },
      { code: "DANA100", name: "DANA 100.000", price: 100040, max: 100540 }
    ]
  },
  gopay: {
    name: "GoPay",
    icon: "🟢",
    products: [
      { code: "GOPAY10", name: "GoPay 10.000", price: 10460, max: 10960 },
      { code: "GOPAY20", name: "GoPay 20.000", price: 20460, max: 20960 },
      { code: "GOPAY50", name: "GoPay 50.000", price: 50460, max: 50960 },
      { code: "GOPAY100", name: "GoPay 100.000", price: 100460, max: 100960 }
    ]
  },
  ovo: {
    name: "OVO",
    icon: "🟣",
    products: [
      { code: "OVO10", name: "OVO 10.000", price: 9625, max: 10125 },
      { code: "OVO20", name: "OVO 20.000", price: 19125, max: 19625 },
      { code: "OVO50", name: "OVO 50.000", price: 49125, max: 49625 },
      { code: "OVO100", name: "OVO 100.000", price: 99125, max: 99625 }
    ]
  },
  shopee: {
    name: "ShopeePay",
    icon: "🟠",
    products: [
      { code: "QSPAY10", name: "ShopeePay 10.000", price: 10139, max: 10639 },
      { code: "QSPAY20", name: "ShopeePay 20.000", price: 20139, max: 20639 },
      { code: "QSPAY50", name: "ShopeePay 50.000", price: 50300, max: 50800 },
      { code: "QSPAY100", name: "ShopeePay 100.000", price: 100300, max: 100800 }
    ]
  },
  linkaja: {
    name: "LinkAja",
    icon: "🔴",
    products: [
      { code: "LA10", name: "LinkAja 10.000", price: 9635, max: 10135 },
      { code: "LA20", name: "LinkAja 20.000", price: 19635, max: 20135 },
      { code: "LA50", name: "LinkAja 50.000", price: 49635, max: 50135 },
      { code: "LA100", name: "LinkAja 100.000", price: 99635, max: 100135 }
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
      // 1. Webhook Callback QRIS dari Qiospay
      if (path === "/api/callback/qris" && request.method === "POST") {
        return await handleQrisCallback(request, env, ctx);
      }

      // 2. Private Mutasi API (Bebas limit untuk bot lain)
      if (path === "/api/qris/mutasi" && request.method === "GET") {
        return await handleGetMutasi(url, env, corsHeaders);
      }

      // 3. Dynamic QRIS Generator API
      if (path === "/api/qris/generate" && (request.method === "GET" || request.method === "POST")) {
        return await handleGenerateQrisApi(request, url, env, corsHeaders);
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
    const payload = await request.json();
    console.log("📥 Received QRIS Callback:", JSON.stringify(payload));

    const data = payload.data || payload;
    const refid = String(data.refid || data.issuer_reff || "MUT_" + Date.now());
    const amount = parseInt(data.amount || 0);
    const buyerName = data.name || data.buyer_name || "Pelanggan QRIS";
    const issuer = String(data.issuer || data.brand_name || "-");
    const balance = parseInt(data.balance || 0);
    const dateStr = data.time || data.date || new Date().toISOString();

    if (env.DB) {
      await env.DB.prepare(
        `INSERT INTO mutations (refid, amount, buyer_name, issuer, balance, type, date_str, raw_payload)
         VALUES (?, ?, ?, ?, ?, 'CR', ?, ?)
         ON CONFLICT(refid) DO UPDATE SET balance = excluded.balance`
      ).bind(refid, amount, buyerName, issuer, balance, dateStr, JSON.stringify(payload)).run();

      await env.DB.prepare(
        "INSERT INTO config (key, value) VALUES ('qris_balance', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(String(balance)).run();
    }

    if (env.BOT_TOKEN && env.DB) {
      const msg = `💰 <b>DANA QRIS MASUK!</b>\n\n` +
        `💵 <b>Nominal:</b> <code>Rp ${amount.toLocaleString('id-ID')}</code>\n` +
        `👤 <b>Pengirim:</b> <code>${escapeHtml(buyerName)}</code>\n` +
        `🏦 <b>Issuer:</b> <code>${issuer}</code>\n` +
        `💳 <b>Saldo QRIS Terkini:</b> <code>Rp ${balance.toLocaleString('id-ID')}</code>\n` +
        `🆔 <b>Ref ID:</b> <code>${refid}</code>\n` +
        `🕒 <b>Waktu:</b> <code>${dateStr}</code>`;

      ctx.waitUntil(broadcastToAllAdmins(env, msg));
    }

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

async function handleGenerateQrisApi(request, url, env, corsHeaders) {
  let amount = url.searchParams.get("amount");
  if (request.method === "POST") {
    try {
      const body = await request.json();
      if (body.amount) amount = body.amount;
    } catch (_) {}
  }

  const staticQr = env.QRIS_STRING || "00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214804083792887370303UMI51440014ID.CO.QRIS.WWW0215ID20254684996570303UMI5204653353033605802ID5925Premium In Aja Payment Qp6007CILACAP61055321162070703A01630499E8";
  const result = generateDynamicQris(staticQr, amount);

  return new Response(JSON.stringify({
    status: "success",
    data: result
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

      // Update qris_balance & update qiospay_app_balance agar mencerminkan saldo yang siap dicairkan
      await env.DB.prepare("INSERT INTO config (key, value) VALUES ('qris_balance', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(String(qrisBalance)).run();

      await env.DB.prepare("INSERT INTO config (key, value) VALUES ('qiospay_app_balance', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
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

  // 5. Eksekusi H2H Trx Pembelian E-Wallet
  const refID = `WD_${Date.now()}`;
  const h2hBaseUrl = env.H2H_URL || "https://qiospay.id/api/h2h/trx";
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
    const welcome = `🤖 <b>QIOSPAY QRIS & AUTO-WD ENGINE</b>\n` +
      `Status Akun: <b>${roleBadge}</b> (<code>${user.id}</code>)\n\n` +
      `<b>⚡ Menu Cepat Penarikan Saldo:</b>\n` +
      `1️⃣ <b>Tarik QRIS ➔ QiosPay:</b> Memindahkan dana terkumpul dari QRIS ke saldo aplikasi.\n` +
      `2️⃣ <b>Tarik QiosPay ➔ Wallet:</b> Menarik saldo aplikasi ke DANA/E-Wallet via H2H.\n\n` +
      `<b>📱 Perintah Operasional:</b>\n` +
      `• <code>/status</code> — Cek saldo (QRIS & Aplikasi Qiospay) & status WD\n` +
      `• <code>/setwallet</code> — Atur E-Wallet & Nomor Penampung (Mode Inline)\n` +
      `• <code>/tarikqris</code> — Tarik & sinkronkan saldo QRIS ke QiosPay\n` +
      `• <code>/tarikwallet</code> — Tarik saldo QiosPay ke DANA penampung\n` +
      `• <code>/mutasi [limit]</code> — Lihat daftar mutasi QRIS masuk terkini\n` +
      `• <code>/h2h [limit]</code> — Lihat riwayat eksekusi H2H ke E-Wallet\n` +
      `• <code>/qris [nominal]</code> — Generate QRIS dinamis langsung\n\n` +
      `<b>👥 Manajemen Administrator:</b>\n` +
      `• <code>/addadmin &lt;id&gt; [username]</code> — Tambah admin baru\n` +
      `• <code>/deladmin &lt;id&gt;</code> — Hapus admin\n` +
      `• <code>/listadmin</code> — Lihat semua admin terdaftar`;

    const dashUrl = `https://qiospay-automation.mansyurj168.workers.dev/?uid=${user.id}`;
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📊 Cek Status & Dual Saldo", callback_data: "cb:status" }
        ],
        [
          { text: "🔄 Tarik QRIS ➔ QiosPay", callback_data: "cb:tarik_qris_settle" },
          { text: "⚡ Tarik QiosPay ➔ Wallet", callback_data: "cb:prompt_tarik_wallet" }
        ],
        [
          { text: "⚙️ Set E-Wallet & Produk", callback_data: "ew:menu" },
          { text: "💳 QRIS Dinamis", callback_data: "cb:qris_menu" }
        ],
        [
          { text: "📥 Mutasi QRIS", callback_data: "cb:mutasi" },
          { text: "📤 Riwayat H2H", callback_data: "cb:h2h" }
        ],
        [
          { text: "👥 Daftar Admin", callback_data: "cb:listadmin" },
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

  // 4. Command /setwallet & /setdana (INLINE MODE + INPUT PHONE)
  if (text.startsWith("/setwallet") || text.startsWith("/setdana")) {
    const rawParam = text.replace(/^\/(?:setwallet|setdana)/, "").trim();

    if (rawParam) {
      const cleanPhone = rawParam.replace(/[^0-9]/g, "");
      if (!/^08[0-9]{8,12}$/.test(cleanPhone)) {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ <b>Nomor tidak valid!</b> Gunakan format angka Indonesia yang benar (contoh: <code>/setwallet 083127060539</code>).");
        return new Response("OK");
      }

      await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'dana_dest'").bind(cleanPhone).run();

      const confirmMsg = `✅ <b>Nomor E-Wallet Penampung Diperbarui!</b>\n\n` +
        `📱 <b>Nomor Tujuan:</b> <code>${cleanPhone}</code>\n\n` +
        `Silakan pilih produk E-Wallet dan nominal target penarikan di bawah ini:`;

      await sendTelegramMessage(env.BOT_TOKEN, chatId, confirmMsg, renderWalletCategoryKeyboard());
      return new Response("OK");
    }

    const promptMsg = `⚙️ <b>PENGATURAN E-WALLET PENAMPUNG (INLINE MODE)</b>\n\n` +
      `Pilih jenis E-Wallet yang ingin Anda jadikan tujuan pencairan saldo otomatis:`;

    await sendTelegramMessage(env.BOT_TOKEN, chatId, promptMsg, renderWalletCategoryKeyboard());
    return new Response("OK");
  }

  // 5. Command /tarikqris (Tarik/Settle Saldo QRIS ke QiosPay)
  if (text === "/tarikqris") {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ Sedang menyinkronkan & menarik saldo mutasi QRIS ke saldo aplikasi QiosPay...");
    const syncRes = await syncQrisBalance(env);
    const msg = `✅ <b>PENARIKAN SALDO QRIS ➔ QIOSPAY BERHASIL!</b>\n\n` +
      `💳 <b>Saldo QRIS Terkumpul:</b> <code>Rp ${syncRes.qrisBalance.toLocaleString('id-ID')}</code>\n` +
      `💼 <b>Saldo Aplikasi QiosPay:</b> <code>Rp ${syncRes.qrisBalance.toLocaleString('id-ID')}</code>\n` +
      `📥 <b>Total Mutasi Diperbarui:</b> <code>${syncRes.newMutationsCount} transaksi</code>\n\n` +
      `<i>Saldo kini siap ditarik ke E-Wallet/DANA penampung Anda!</i>`;

    const kb = {
      inline_keyboard: [
        [{ text: "⚡ Tarik ke E-Wallet Sekarang", callback_data: "cb:prompt_tarik_wallet" }],
        [{ text: "📊 Cek Status", callback_data: "cb:status" }]
      ]
    };
    await sendTelegramMessage(env.BOT_TOKEN, chatId, msg, kb);
    return new Response("OK");
  }

  // 6. Command /tarikwallet atau /tarik (Prompt Konfirmasi Logika YES / NO)
  if (text === "/tarikwallet" || text === "/tarik") {
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

  // 9. Command /qris [nominal]
  if (text.startsWith("/qris")) {
    const parts = text.split(/\s+/);
    const amount = parts[1] ? parseInt(parts[1].replace(/[^0-9]/g, "")) : 0;

    const staticQr = env.QRIS_STRING || "00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214804083792887370303UMI51440014ID.CO.QRIS.WWW0215ID20254684996570303UMI5204653353033605802ID5925Premium In Aja Payment Qp6007CILACAP61055321162070703A01630499E8";
    const qrData = generateDynamicQris(staticQr, amount);

    const caption = `💳 <b>QRIS PEMBAYARAN ${amount > 0 ? "DINAMIS" : "STATIS"}</b>\n\n` +
      `💵 <b>Nominal:</b> <code>${amount > 0 ? "Rp " + amount.toLocaleString('id-ID') : "Bebas Masukkan Nominal"}</code>\n` +
      `🏷️ <b>Merchant:</b> <code>Premium In Aja Payment</code>\n\n` +
      `📋 <b>String QRIS (1-Tap Copy):</b>\n<code>${qrData.qris_string}</code>`;

    if (qrData.qr_image_url) {
      await sendTelegramPhoto(env.BOT_TOKEN, chatId, qrData.qr_image_url, caption);
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, caption);
    }
    return new Response("OK");
  }

  // 10. Command /autoon & /autooff
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

  const statusMsg = `📊 <b>INFORMASI STATUS & DUAL SALDO:</b>\n\n` +
    `💼 <b>Saldo Aplikasi QiosPay:</b> <code>Rp ${appBalance.toLocaleString('id-ID')}</code>\n` +
    `💳 <b>Saldo Akun QRIS:</b> <code>Rp ${qrisBalance.toLocaleString('id-ID')}</code>\n` +
    `📈 <b>Dana QRIS Masuk Hari Ini:</b> <code>Rp ${(todayTotal?.total || 0).toLocaleString('id-ID')}</code>\n` +
    `────────────────────────\n` +
    `📱 <b>Nomor Penampung:</b> <code>${cfg.dana_dest || "083127060539"}</code>\n` +
    `📦 <b>Target Produk:</b> <code>${cfg.target_product || "DP1"}</code>\n` +
    `💵 <b>Harga Maks Proteksi:</b> <code>Rp ${parseInt(cfg.harga_max || 1560).toLocaleString('id-ID')}</code>\n` +
    `⚙️ <b>Auto-WD (12 Jam):</b> <b>${cfg.auto_wd_enabled === "1" ? "AKTIF ✅" : "NONAKTIF ❌"}</b>\n` +
    `🕒 <b>Status Terakhir:</b> <code>${cfg.last_wd_status || "-"}</code>\n` +
    `✅ <b>Total WD Berhasil:</b> <code>${totalWd?.count || 0} kali</code>`;

  const dashUrl = `https://qiospay-automation.mansyurj168.workers.dev/?uid=${userId}`;
  const kb = {
    inline_keyboard: [
      [
        { text: "🔄 Tarik QRIS ➔ QiosPay", callback_data: "cb:tarik_qris_settle" },
        { text: "⚡ Tarik QiosPay ➔ Wallet", callback_data: "cb:prompt_tarik_wallet" }
      ],
      [
        { text: "⚙️ Ubah E-Wallet", callback_data: "ew:menu" },
        { text: "🔄 Refresh Status", callback_data: "cb:status" }
      ],
      [
        { text: "🌐 Web Dashboard", url: dashUrl }
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
        { text: "🟢 GoPay", callback_data: "ew:cat:gopay" }
      ],
      [
        { text: "🟣 OVO", callback_data: "ew:cat:ovo" },
        { text: "🟠 ShopeePay", callback_data: "ew:cat:shopee" }
      ],
      [
        { text: "🔴 LinkAja", callback_data: "ew:cat:linkaja" },
        { text: "✏️ Input No HP", callback_data: "ew:input_phone" }
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
    const welcome = `🤖 <b>QIOSPAY QRIS & AUTO-WD ENGINE</b>\n` +
      `Status Akun: <b>${roleBadge}</b> (<code>${user.id}</code>)\n\n` +
      `Silakan pilih menu operasional di bawah ini:`;

    const dashUrl = `https://qiospay-automation.mansyurj168.workers.dev/?uid=${user.id}`;
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📊 Cek Status & Dual Saldo", callback_data: "cb:status" }
        ],
        [
          { text: "🔄 Tarik QRIS ➔ QiosPay", callback_data: "cb:tarik_qris_settle" },
          { text: "⚡ Tarik QiosPay ➔ Wallet", callback_data: "cb:prompt_tarik_wallet" }
        ],
        [
          { text: "⚙️ Set E-Wallet & Produk", callback_data: "ew:menu" },
          { text: "💳 QRIS Dinamis", callback_data: "cb:qris_menu" }
        ],
        [
          { text: "📥 Mutasi QRIS", callback_data: "cb:mutasi" },
          { text: "📤 Riwayat H2H", callback_data: "cb:h2h" }
        ],
        [
          { text: "👥 Daftar Admin", callback_data: "cb:listadmin" },
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
    const hintMsg = `📱 <b>CARA MENGUBAH NOMOR E-WALLET PENAMPUNG:</b>\n\n` +
      `Ketik perintah di chat seperti contoh berikut:\n` +
      `👉 <code>/setwallet 083127060539</code> 👈\n\n` +
      `<i>Sistem akan otomatis memvalidasi nomor telepon dan menyimpannya ke database.</i>`;

    const kb = {
      inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "ew:menu" }]]
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
    await sendTelegramMessage(env.BOT_TOKEN, chatId, text || "Belum ada mutasi tersimpan.");
  }

  // 11. Riwayat H2H
  else if (data === "cb:h2h") {
    const { results } = await env.DB.prepare("SELECT product, dest, status FROM h2h_transactions ORDER BY id DESC LIMIT 5").all();
    let text = "📤 <b>5 Transaksi H2H Terakhir:</b>\n\n";
    (results || []).forEach((h, i) => {
      text += `${i + 1}. ${h.product} -> <code>${h.dest}</code> [<b>${h.status}</b>]\n`;
    });
    await sendTelegramMessage(env.BOT_TOKEN, chatId, text || "Belum ada transaksi H2H.");
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

  // 13. QRIS Menu
  else if (data === "cb:qris_menu") {
    const qrisInfo = `💳 <b>FITUR GENERATE QRIS DINAMIS:</b>\n\n` +
      `Untuk generate QRIS dengan nominal tertentu, ketik di chat:\n` +
      `👉 <code>/qris 5000</code>\n` +
      `👉 <code>/qris 50000</code>\n\n` +
      `<i>Bot akan langsung membuat string QRIS dan gambar QR Code siap scan!</i>`;

    const kb = {
      inline_keyboard: [[{ text: "🔙 Menu Utama", callback_data: "cb:menu_utama" }]]
    };

    if (messageId) {
      await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, qrisInfo, kb);
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, qrisInfo, kb);
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

async function sendTelegramPhoto(botToken, chatId, photoUrl, caption = "") {
  try {
    return await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: "HTML"
      })
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
