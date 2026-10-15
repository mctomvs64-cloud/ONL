// ============================================================
// IronPay Checkout — Netlify Serverless Function
// ============================================================
// Cria uma transação PIX via IronPay para TODAS as moedas.
// IronPay é um gateway brasileiro nativo — os bancos não bloqueiam.
//
// Fluxo:
//   1. Frontend envia { plan, currency, customer_name, customer_phone }
//   2. Esta função cria a transação na IronPay via POST /transactions
//   3. Retorna o QR Code PIX / checkout_url para o cliente pagar
//
// API IronPay:
//   Base URL: https://api.ironpayapp.com.br/api/public/v1
//   Auth: api_token no body
//   Valores em centavos
// ============================================================

const IRONPAY_BASE = "https://api.ironpayapp.com.br/api/public/v1";
const IRONPAY_TOKEN = "2ox8phHYN9DUVMLdRl06uRr6FgprkMA9fMKI6FhX9CbK9EINvo09Uv49p4bp";
const PRODUCT_HASH = "cy381vdbuj"; // Evelyn Oliver VIP Global

// Planos com valores em centavos para cada moeda
const PLANS = {
  BRL: {
    weekly:    { price: 999,    title: "VIP Semanal" },
    monthly:   { price: 6499,   title: "VIP Mensal" },
    annual:    { price: 19799,  title: "VIP Anual" },
    vip_basic: { price: 2999,   title: "VIP Básico" }
  },
  MXN: {
    weekly:    { price: 5500,   title: "VIP Semanal MX" },
    monthly:   { price: 13900,  title: "VIP Mensal MX" },
    annual:    { price: 41900,  title: "VIP Anual MX" },
    vip_basic: { price: 8300,   title: "VIP Básico MX" }
  },
  USD: {
    weekly:    { price: 1499,   title: "VIP Weekly" },
    monthly:   { price: 4499,   title: "VIP Monthly" },
    annual:    { price: 12499,  title: "VIP Annual" },
    vip_basic: { price: 599,    title: "VIP Basic" }
  },
  COP: {
    weekly:    { price: 41900,  title: "VIP Semanal COP" },
    monthly:   { price: 132900, title: "VIP Mensal COP" },
    annual:    { price: 349900, title: "VIP Anual COP" },
    vip_basic: { price: 55900,  title: "VIP Básico COP" }
  },
  EUR: {
    weekly:    { price: 1499,   title: "VIP Weekly EUR" },
    monthly:   { price: 4499,   title: "VIP Monthly EUR" },
    annual:    { price: 12499,  title: "VIP Annual EUR" },
    vip_basic: { price: 599,    title: "VIP Basic EUR" }
  },
  GBP: {
    weekly:    { price: 1499,   title: "VIP Weekly GBP" },
    monthly:   { price: 4499,   title: "VIP Monthly GBP" },
    annual:    { price: 12499,  title: "VIP Annual GBP" },
    vip_basic: { price: 599,    title: "VIP Basic GBP" }
  }
};

exports.handler = async function (event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Method not allowed" })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Invalid JSON" })
    };
  }

  const { plan, currency, customer_name, customer_phone } = body;
  const targetCurrency = currency || "BRL";

  if (!PLANS[targetCurrency] || !PLANS[targetCurrency][plan]) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Plano ou moeda inválidos." })
    };
  }

  const planData = PLANS[targetCurrency][plan];

  // ── Criar transação na IronPay ──────────────────────────────
  const txPayload = {
    api_token: IRONPAY_TOKEN,
    product_hash: PRODUCT_HASH,
    payment_method: "pix",
    amount: planData.price,
    title: planData.title,
    currency: targetCurrency,
    customer: {
      name:  customer_name || "Cliente VIP",
      phone: customer_phone || "",
      email: "cliente@premiumvip.com"
    }
  };

  let ironRes, ironData;
  try {
    ironRes = await fetch(IRONPAY_BASE + "/transactions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Accept":        "application/json"
      },
      body: JSON.stringify(txPayload)
    });
    ironData = await ironRes.json();
  } catch (fetchErr) {
    console.error("[ironpay] fetch error:", fetchErr);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Erro de conexão com o gateway. Tente novamente." })
    };
  }

  console.log("[ironpay] Response status:", ironRes.status, "Body:", JSON.stringify(ironData));

  // Verificar erro
  if (!ironRes.ok || ironData.error) {
    console.error("[ironpay] Error:", ironData);
    return {
      statusCode: ironRes.status || 422,
      headers: corsHeaders,
      body: JSON.stringify({
        ok:    false,
        error: ironData.message || ironData.error || "Erro ao gerar cobrança no gateway."
      })
    };
  }

  // ── Sucesso — Extrair dados de pagamento ────────────────────
  // IronPay pode retornar: pix_code, qr_code, checkout_url, hash, etc.
  const txHash = ironData.hash || ironData.transaction_hash || ironData.id || "";
  const pixCode = ironData.pix_code || ironData.copy_paste || ironData.qr_code || ironData.code || "";
  const qrUrl = ironData.qr_url || ironData.qr_code_url || ironData.qr_image || "";
  const checkoutUrl = ironData.checkout_url || ironData.payment_url || ironData.url || "";
  const status = ironData.status || "pending";

  console.log(`[ironpay] OK: ${txHash} | ${targetCurrency} ${planData.price} | status: ${status}`);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ok:             true,
      gateway:        "ironpay",
      currency:       targetCurrency,
      amount:         planData.price,
      qr_code:        pixCode,
      qr_url:         qrUrl,
      checkout_url:   checkoutUrl,
      transaction_id: txHash,
      status:         status,
      raw:            ironData  // Pass full response for debugging
    })
  };
};
