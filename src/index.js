/**
 * QIOSPAY AUTOMATION & QRIS ENGINE
 * Powered by Cloudflare Workers & Cloudflare D1 Database
 * Multi-Admin Role Support & Advanced QRIS Features
 */

export default {
  // 1. HTTP REQUEST ROUTER
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers for API
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

      // 10. Dashboard API: Trigger Manual WD Now
      if (path === "/api/dashboard/trigger-wd" && request.method === "POST") {
        return await handleManualWdTrigger(request, env);
      }

      // 11. Web Dashboard Frontend HTML
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

    // 1. Simpan ke database D1
    if (env.DB) {
      await env.DB.prepare(
        `INSERT INTO mutations (refid, amount, buyer_name, issuer, balance, type, date_str, raw_payload)
         VALUES (?, ?, ?, ?, ?, 'CR', ?, ?)
         ON CONFLICT(refid) DO UPDATE SET balance = excluded.balance`
      ).bind(refid, amount, buyerName, issuer, balance, dateStr, JSON.stringify(payload)).run();
    }

    // 2. Kirim Notifikasi Realtime ke Seluruh Admin Terdaftar
    if (env.BOT_TOKEN && env.DB) {
      const msg = `💰 <b>DANA QRIS MASUK!</b>\n\n` +
        `💵 <b>Nominal:</b> <code>Rp ${amount.toLocaleString('id-ID')}</code>\n` +
        `👤 <b>Pengirim:</b> <code>${escapeHtml(buyerName)}</code>\n` +
        `🏦 <b>Issuer:</b> <code>${issuer}</code>\n` +
        `💳 <b>Saldo Terkini:</b> <code>Rp ${balance.toLocaleString('id-ID')}</code>\n` +
        `🆔 <b>Ref ID:</b> <code>${refid}</code>\n` +
        `🕒 <b>Waktu:</b> <code>${dateStr}</code>`;

      ctx.waitUntil(broadcastToAllAdmins(env, msg));
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
  // 1. Buang 4 karakter CRC lama di belakang
  let qrBase = staticQr.trim().slice(0, -4);
  // 2. Ubah indikator point of initiation dari statis (11) menjadi dinamis (12)
  qrBase = qrBase.replace("010211", "010212");

  // 3. Pecah di tag 5802ID
  const parts = qrBase.split("5802ID");
  if (parts.length < 2) return { qris_string: staticQr, amount: 0 };

  // 4. Format tag 54: 54 + 2-digit panjang nominal + nominal
  const nominalTag = "54" + String(amtStr.length).padStart(2, "0") + amtStr + "5802ID";
  const reconstructed = parts[0].trim() + nominalTag + parts[1].trim();

  // 5. Hitung CRC16 baru
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
// MODUL 3: LOGIKA AUTO-WITHDRAW & H2H TRANSAKSI SETIAP 12 JAM
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
    await broadcastToAllAdmins(env, warn);
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

    const tgMsg = `⏳ <b>[AUTO-WD 12 JAM: DILEWATI]</b>\n\n` +
      `💳 <b>Saldo Tersedia:</b> <code>Rp ${currentBalance.toLocaleString('id-ID')}</code>\n` +
      `📦 <b>Target Produk:</b> <code>${targetProduct}</code>\n` +
      `💵 <b>Kebutuhan Saldo:</b> <code>Rp ${hargaMax.toLocaleString('id-ID')}</code>\n\n` +
      `<i>Alasan: Saldo belum mencapai batas minimal. Dana tetap aman di akun untuk siklus 12 jam berikutnya.</i>`;
    await broadcastToAllAdmins(env, tgMsg);

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
    const emoji = isSuccess ? "✅" : "❌";
    const tgMsg = `${emoji} <b>[EKSEKUSI AUTO-WD H2H]</b>\n\n` +
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

  // Generate OTP 6 digit
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 menit

  await env.DB.prepare("INSERT INTO otp_sessions (telegram_id, otp_code, expires_at) VALUES (?, ?, ?)")
    .bind(telegram_id, otp, expiresAt).run();

  // Kirim OTP via Telegram Bot langsung ke admin yang bersangkutan
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

  // Buat auth token
  const token = "qios_tok_" + crypto.randomUUID().replace(/-/g, "");
  await env.DB.prepare("UPDATE otp_sessions SET token = ? WHERE id = ?").bind(token, session.id).run();

  const admin = await getAdminUser(env, telegram_id);

  return new Response(JSON.stringify({ success: true, token, role: admin?.role || "admin", user: admin }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handleGetDashboardStats(request, env, corsHeaders) {
  if (!env.DB) return new Response("{}", { status: 500, headers: corsHeaders });

  // 1. Mutasi QRIS terakhir
  const { results: mutations } = await env.DB.prepare("SELECT * FROM mutations ORDER BY id DESC LIMIT 15").all();
  // 2. Transaksi H2H terakhir
  const { results: h2hLogs } = await env.DB.prepare("SELECT * FROM h2h_transactions ORDER BY id DESC LIMIT 15").all();
  // 3. Konfigurasi
  const { results: configs } = await env.DB.prepare("SELECT * FROM config").all();
  const cfg = {};
  for (const c of configs || []) cfg[c.key] = c.value;

  // 4. Daftar Admin
  const { results: admins } = await env.DB.prepare("SELECT user_id, username, role, created_at FROM admins ORDER BY id ASC").all();

  // 5. Hitung Saldo & Mutasi Hari Ini
  const todayTotal = await env.DB.prepare("SELECT SUM(amount) as total FROM mutations WHERE date(created_at) = date('now')").first();
  const totalSuccessWd = await env.DB.prepare("SELECT COUNT(*) as count FROM h2h_transactions WHERE status = 'BERHASIL'").first();

  return new Response(JSON.stringify({
    config: cfg,
    today_qris_total: todayTotal?.total || 0,
    total_successful_wd: totalSuccessWd?.count || 0,
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

async function handleManualWdTrigger(request, env) {
  const result = await executeAutoWithdrawal(env, "MANUAL_DASHBOARD");
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
}

// ============================================================================
// MODUL 5: TELEGRAM BOT WEBHOOK (@qiospay2bot) DENGAN MULTI-ADMIN
// ============================================================================

async function handleTelegramWebhook(request, env, ctx) {
  const update = await request.json();

  // A. Handle Callback Query (Klik tombol inline keyboard)
  if (update.callback_query) {
    return await handleCallbackQuery(update.callback_query, env);
  }

  const msg = update.message;
  if (!msg) return new Response("OK");

  const chatId = msg.chat.id;
  const user = msg.from;
  const text = (msg.text || "").trim();

  // 1. Verifikasi Multi-Admin
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
      `<b>⚡ Perintah Utama:</b>\n` +
      `• <code>/status</code> — Cek saldo, konfigurasi & mutasi terkini\n` +
      `• <code>/tarik</code> — Paksa eksekusi penarikan H2H ke DANA sekarang\n` +
      `• <code>/mutasi [limit]</code> — Lihat daftar mutasi QRIS masuk terkini\n` +
      `• <code>/h2h [limit]</code> — Lihat riwayat eksekusi H2H ke DANA\n` +
      `• <code>/qris [nominal]</code> — Generate QRIS dinamis langsung\n\n` +
      `<b>⚙️ Pengaturan H2H:</b>\n` +
      `• <code>/setdana 08xxx</code> — Ganti nomor DANA penampung\n` +
      `• <code>/setproduk DANA100</code> — Ganti target produk H2H\n` +
      `• <code>/setharga 100500</code> — Set toleransi harga maksimum\n` +
      `• <code>/autoon</code> / <code>/autooff</code> — Sakelar penarikan 12 jam\n\n` +
      `<b>👥 Manajemen Administrator:</b>\n` +
      `• <code>/addadmin &lt;id&gt; [username]</code> — Tambah admin baru\n` +
      `• <code>/deladmin &lt;id&gt;</code> — Hapus admin\n` +
      `• <code>/listadmin</code> — Lihat semua admin terdaftar`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📊 Cek Status", callback_data: "cb:status" },
          { text: "⚡ Tarik Sekarang", callback_data: "cb:tarik" }
        ],
        [
          { text: "📥 Mutasi QRIS", callback_data: "cb:mutasi" },
          { text: "📤 Riwayat H2H", callback_data: "cb:h2h" }
        ],
        [
          { text: "👥 Daftar Admin", callback_data: "cb:listadmin" },
          { text: "🌐 Buka Web Dashboard", url: "https://qiospay-automation.mansyurj168.workers.dev" }
        ]
      ]
    };

    await sendTelegramMessage(env.BOT_TOKEN, chatId, welcome, inlineKeyboard);
    return new Response("OK");
  }

  // 3. Command /status
  if (text === "/status") {
    const configRows = await env.DB.prepare("SELECT key, value FROM config").all();
    const cfg = {};
    for (const r of (configRows.results || [])) cfg[r.key] = r.value;

    const lastMut = await env.DB.prepare("SELECT amount, balance, created_at FROM mutations ORDER BY id DESC LIMIT 1").first();
    const todayTotal = await env.DB.prepare("SELECT SUM(amount) as total FROM mutations WHERE date(created_at) = date('now')").first();
    const totalWd = await env.DB.prepare("SELECT COUNT(*) as count FROM h2h_transactions WHERE status = 'BERHASIL'").first();

    const statusMsg = `📊 <b>STATUS QIOSPAY AUTOMATION:</b>\n\n` +
      `📱 <b>Nomor DANA Penampung:</b> <code>${cfg.dana_dest || "Belum disetel"}</code>\n` +
      `📦 <b>Target Produk:</b> <code>${cfg.target_product || "DANA100"}</code>\n` +
      `💵 <b>Harga Maks:</b> <code>Rp ${parseInt(cfg.harga_max || 100500).toLocaleString('id-ID')}</code>\n` +
      `⚙️ <b>Auto-WD (12 Jam):</b> <b>${cfg.auto_wd_enabled === "1" ? "AKTIF ✅" : "NONAKTIF ❌"}</b>\n` +
      `🕒 <b>Status Terakhir:</b> <code>${cfg.last_wd_status || "-"}</code>\n\n` +
      `💳 <b>Saldo Terakhir:</b> <code>Rp ${parseInt(lastMut?.balance || 0).toLocaleString('id-ID')}</code>\n` +
      `📈 <b>Dana QRIS Masuk Hari Ini:</b> <code>Rp ${(todayTotal?.total || 0).toLocaleString('id-ID')}</code>\n` +
      `✅ <b>Total WD Berhasil:</b> <code>${totalWd?.count || 0} kali</code>`;

    const kb = {
      inline_keyboard: [
        [{ text: "⚡ Tarik Saldo Sekarang", callback_data: "cb:tarik" }],
        [{ text: "🔄 Refresh Status", callback_data: "cb:status" }]
      ]
    };

    await sendTelegramMessage(env.BOT_TOKEN, chatId, statusMsg, kb);
    return new Response("OK");
  }

  // 4. Command /tarik
  if (text === "/tarik") {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ Sedang memproses eksekusi penarikan H2H ke DANA...");
    const res = await executeAutoWithdrawal(env, `TELEGRAM_USER_${user.id}`);
    if (!res.success) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, `⚠️ <b>Eksekusi Gagal:</b>\n${res.message || res.error}`);
    }
    return new Response("OK");
  }

  // 5. Command /mutasi [limit]
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

  // 6. Command /h2h [limit]
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

  // 7. Command /qris [nominal]
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

  // 8. Command /setdana
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

  // 9. Command /setproduk
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

  // 10. Command /setharga
  if (text.startsWith("/setharga")) {
    const price = text.replace("/setharga", "").trim().replace(/[^0-9]/g, "");
    if (!price) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "⚠️ Format: <code>/setharga 100500</code>");
      return new Response("OK");
    }
    await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'harga_max'").bind(price).run();
    await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ Batas harga maksimal diperbarui ke: <code>Rp ${parseInt(price).toLocaleString('id-ID')}</code>`);
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

  // 12. Command /addadmin <id> [username]
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

  // 13. Command /deladmin <id>
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

  // 14. Command /listadmin
  if (text === "/listadmin") {
    const { results } = await env.DB.prepare("SELECT user_id, username, role, created_at FROM admins ORDER BY id ASC").all();

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

// Handler Callback Query Tombol Inline
async function handleCallbackQuery(cb, env) {
  const data = cb.data;
  const user = cb.from;
  const chatId = cb.message?.chat?.id || user.id;

  const admin = await getAdminUser(env, user.id);
  if (!admin) {
    await answerCallbackQuery(env.BOT_TOKEN, cb.id, "⛔ Akses ditolak.");
    return new Response("OK");
  }

  await answerCallbackQuery(env.BOT_TOKEN, cb.id, "Memproses...");

  if (data === "cb:status") {
    const configRows = await env.DB.prepare("SELECT key, value FROM config").all();
    const cfg = {};
    for (const r of (configRows.results || [])) cfg[r.key] = r.value;

    const lastMut = await env.DB.prepare("SELECT amount, balance FROM mutations ORDER BY id DESC LIMIT 1").first();

    const statusMsg = `📊 <b>STATUS REALTIME:</b>\n\n` +
      `📱 <b>DANA:</b> <code>${cfg.dana_dest || "-"}</code>\n` +
      `📦 <b>Produk:</b> <code>${cfg.target_product || "DANA100"}</code>\n` +
      `💵 <b>Harga Maks:</b> <code>Rp ${parseInt(cfg.harga_max || 100500).toLocaleString('id-ID')}</code>\n` +
      `⚙️ <b>Auto-WD:</b> <b>${cfg.auto_wd_enabled === "1" ? "AKTIF ✅" : "NONAKTIF ❌"}</b>\n` +
      `💳 <b>Saldo Terakhir:</b> <code>Rp ${parseInt(lastMut?.balance || 0).toLocaleString('id-ID')}</code>`;

    await sendTelegramMessage(env.BOT_TOKEN, chatId, statusMsg);
  } else if (data === "cb:tarik") {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "⏳ Mengeksekusi penarikan H2H...");
    await executeAutoWithdrawal(env, `BUTTON_${user.id}`);
  } else if (data === "cb:mutasi") {
    const { results } = await env.DB.prepare("SELECT amount, buyer_name, refid FROM mutations ORDER BY id DESC LIMIT 5").all();
    let text = "📥 <b>5 Mutasi Terakhir:</b>\n";
    (results || []).forEach(m => {
      text += `• Rp ${m.amount.toLocaleString('id-ID')} | <code>${m.buyer_name}</code>\n`;
    });
    await sendTelegramMessage(env.BOT_TOKEN, chatId, text || "Belum ada mutasi.");
  } else if (data === "cb:h2h") {
    const { results } = await env.DB.prepare("SELECT product, dest, status FROM h2h_transactions ORDER BY id DESC LIMIT 5").all();
    let text = "📤 <b>5 Transaksi H2H Terakhir:</b>\n";
    (results || []).forEach(h => {
      text += `• ${h.product} -> ${h.dest} [<b>${h.status}</b>]\n`;
    });
    await sendTelegramMessage(env.BOT_TOKEN, chatId, text || "Belum ada transaksi.");
  } else if (data === "cb:listadmin") {
    const { results } = await env.DB.prepare("SELECT user_id, username, role FROM admins").all();
    let text = "👥 <b>Daftar Admin:</b>\n";
    (results || []).forEach(a => {
      text += `• <b>${a.username}</b> (<code>${a.user_id}</code>) - ${a.role}\n`;
    });
    await sendTelegramMessage(env.BOT_TOKEN, chatId, text);
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
// MODUL 6: DASHBOARD HTML (TAILWIND CSS & DARK MODERN TECH)
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
    .btn-rose { background: linear-gradient(135deg, #F43F5E 0%, #E11D48 100%); }
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
          <span class="text-[10px] ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">MULTI-ADMIN LIVE</span>
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

  <!-- LOGIN MODAL (OTP TELEGRAM) -->
  <div id="loginModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div class="glass max-w-md w-full rounded-2xl p-6 border border-slate-700/80 shadow-2xl">
      <div class="text-center mb-6">
        <div class="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto text-2xl mb-3">
          🔐
        </div>
        <h3 class="text-lg font-bold text-white">Login Multi-Admin Dashboard</h3>
        <p class="text-xs text-slate-400 mt-1">Masukkan User ID Telegram yang terdaftar sebagai admin untuk menerima kode OTP.</p>
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

    <!-- TABS NAVIGATION -->
    <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
      <button onclick="switchTab('tab-overview')" id="btn-tab-overview" class="px-4 py-2 text-xs font-bold rounded-xl bg-sky-500 text-white">📊 Mutasi & H2H</button>
      <button onclick="switchTab('tab-qris')" id="btn-tab-qris" class="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white">💳 Generate QRIS Dinamis</button>
      <button onclick="switchTab('tab-admin')" id="btn-tab-admin" class="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white">👥 Manajemen Admin</button>
      <button onclick="switchTab('tab-config')" id="btn-tab-config" class="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white">⚙️ Pengaturan H2H</button>
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
            <span class="flex items-center gap-2"><span>📤</span> Riwayat Penarikan H2H ke DANA</span>
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
          <input type="number" id="genAmount" placeholder="Contoh: 50000" class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white">
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
      <h3 class="text-base font-bold text-white mb-2">⚙️ Pengaturan Auto-Withdraw ke DANA</h3>
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
            <option value="SHOPEE100">SHOPEE100 (ShopeePay 100k)</option>
            <option value="GOPAY100">GOPAY100 (GoPay 100k)</option>
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

  </main>

  <!-- CLIENT SCRIPT -->
  <script>
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
