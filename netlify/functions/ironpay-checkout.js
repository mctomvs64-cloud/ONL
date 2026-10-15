// ============================================================
// IronPay Checkout — Netlify Serverless Function
// ============================================================
// Processa pagamentos via IronPay para TODAS as moedas e planos.
// Para BRL: Gera transação PIX instantânea com QR Code e Copia-e-Cola.
// Para outras moedas (MXN, USD, EUR, GBP, COP): Fornece checkout seguro com cartão.
//
// API IronPay:
//   Base URL: https://api.ironpayapp.com.br/api/public/v1
//   Auth: api_token
// ============================================================

const IRONPAY_BASE = "https://api.ironpayapp.com.br/api/public/v1";
const IRONPAY_TOKEN = "2ox8phHYN9DUVMLdRl06uRr6FgprkMA9fMKI6FhX9CbK9EINvo09Uv49p4bp";
const PRODUCT_HASH = "cy381vdbuj"; // Evelyn Oliver VIP Global

// Mapeamento de ofertas ativas na IronPay
const PLANS = {
  BRL: {
    weekly:    { offer_hash: "uispe", price: 2499,   title: "VIP Semanal BR" },
    monthly:   { offer_hash: "taymw", price: 6499,   title: "VIP Mensal BR" },
    annual:    { offer_hash: "llmx1", price: 19799,  title: "VIP Anual BR" },
    vip_basic: { offer_hash: "2pgah", price: 2999,   title: "VIP Básico BR" }
  },
  MXN: {
    weekly:    { offer_hash: "bjkly", price: 7900,   title: "VIP Semanal MXN" },
    monthly:   { offer_hash: "apkip", price: 19900,  title: "VIP Mensal MXN" },
    annual:    { offer_hash: "ba2cd", price: 59900,  title: "VIP Anual MXN" },
    vip_basic: { offer_hash: "hdsdg", price: 9900,   title: "VIP Básico MXN" }
  },
  USD: {
    weekly:    { offer_hash: "ukglt", price: 699,    title: "VIP Weekly USD" },
    monthly:   { offer_hash: "czdmn", price: 1499,   title: "VIP Monthly USD" },
    annual:    { offer_hash: "fyx25", price: 4499,   title: "VIP Annual USD" },
    vip_basic: { offer_hash: "zosre", price: 500,    title: "VIP Basic USD" }
  },
  EUR: {
    weekly:    { offer_hash: "kxkue", price: 699,    title: "VIP Weekly EUR" },
    monthly:   { offer_hash: "wqiic", price: 1499,   title: "VIP Monthly EUR" },
    annual:    { offer_hash: "a03xl", price: 4499,   title: "VIP Annual EUR" },
    vip_basic: { offer_hash: "2r4n3", price: 500,    title: "VIP Basic EUR" }
  },
  GBP: {
    weekly:    { offer_hash: "ggynu", price: 599,    title: "VIP Weekly GBP" },
    monthly:   { offer_hash: "xnivj", price: 1299,   title: "VIP Monthly GBP" },
    annual:    { offer_hash: "thsff", price: 3499,   title: "VIP Annual GBP" },
    vip_basic: { offer_hash: "yj3w3", price: 500,    title: "VIP Basic GBP" }
  },
  COP: {
    weekly:    { offer_hash: "cdwxv", price: 41900,  title: "VIP Semanal COP" },
    monthly:   { offer_hash: "j72wp", price: 132900, title: "VIP Mensal COP" },
    annual:    { offer_hash: "hlzs6", price: 349900, title: "VIP Anual COP" },
    vip_basic: { offer_hash: "deazn", price: 55900,  title: "VIP Básico COP" }
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
  const targetCurrency = (currency || "BRL").toUpperCase();

  const currencyPlans = PLANS[targetCurrency] || PLANS.BRL;
  const planData = currencyPlans[plan] || currencyPlans.weekly;

  const checkoutUrl = `https://go.ironpayapp.com.br/${planData.offer_hash}`;

  // Se não for BRL (internacional: MXN, USD, EUR, GBP, COP), direciona direto para o checkout com cartão
  if (targetCurrency !== "BRL") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok:             true,
        gateway:        "ironpay",
        currency:       targetCurrency,
        amount:         planData.price / 100,
        checkout_url:   checkoutUrl,
        transaction_id: planData.offer_hash,
        status:         "pending"
      })
    };
  }

  // ── Para BRL: Criar transação PIX na IronPay ─────────────────
  const txPayload = {
    api_token:      IRONPAY_TOKEN,
    offer_hash:     planData.offer_hash,
    amount:         planData.price,
    currency:       "BRL",
    payment_method: "pix",
    description:    planData.title,
    postback_url:   "https://t.me/Premiumvipglobalbot",
    customer: {
      name:     customer_name || "Assinante VIP",
      email:    "assinante@vip.com",
      phone:    customer_phone || "",
      document: "00000000000"
    },
    cart: [
      {
        title:          planData.title,
        price:          planData.price,
        quantity:       1,
        product_hash:   PRODUCT_HASH,
        operation_type: 1
      }
    ]
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

  // Se a criação PIX direta retornar erro, fallback gracioso para o checkout oficial da oferta
  if (!ironRes.ok || ironData.error || ironData.success === false) {
    console.warn("[ironpay] PIX direct failed, fallback to checkout URL:", ironData);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok:             true,
        gateway:        "ironpay",
        currency:       targetCurrency,
        amount:         planData.price / 100,
        checkout_url:   checkoutUrl,
        transaction_id: planData.offer_hash,
        status:         "pending"
      })
    };
  }

  // ── Sucesso PIX ──────────────────────────────────────────────
  const txHash = ironData.hash || ironData.transaction || ironData.id || planData.offer_hash;
  const pixCode = (ironData.pix && ironData.pix.pix_qr_code) || ironData.pix_code || ironData.qr_code || "";
  const qrUrl = pixCode ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}` : "";
  const status = ironData.payment_status || ironData.status || "waiting_payment";

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ok:             true,
      gateway:        "ironpay",
      currency:       targetCurrency,
      amount:         planData.price / 100,
      qr_code:        pixCode,
      qr_url:         qrUrl,
      checkout_url:   (ironData.offer && ironData.offer.url) || checkoutUrl,
      transaction_id: txHash,
      status:         status
    })
  };
};
