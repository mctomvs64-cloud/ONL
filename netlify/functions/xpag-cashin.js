// ============================================================
// XPag Cash-In — Netlify Serverless Function
// ============================================================
// Cria uma cobranca SPEI/CLABE MXN na XPag.
//
// Env vars (arquivo .env local ou Netlify dashboard -> Env vars):
//   XPAG_CLIENT_ID     = "tomvs_46029384"
//   XPAG_CLIENT_SECRET = "2ob5g70i6042fmva9qon019q"
//   XPAG_WEBHOOK_URL   = "https://webhook.site/SEU-UUID"  (opcional)
//   XPAG_TEST_MODE     = "true"  (opcional — mostra badge de teste no modal, mas usa API real)
// ============================================================

const XPAG_BASE_URL = "https://api.xpag.global";

// Map de moedas e planos com valores seguros no servidor
const PLANS = {
  BRL: {
    weekly:    { amount: 24.99,  description: "VIP Semanal BR" },
    monthly:   { amount: 64.99,  description: "VIP Mensal BR" },
    annual:    { amount: 197.99, description: "VIP Anual BR" },
    vip_basic: { amount: 29.99,  description: "VIP Basico BR" }
  },
  MXN: {
    weekly:    { amount: 79.00,  description: "VIP Semanal MX" },
    monthly:   { amount: 199.00, description: "VIP Mensal MX" },
    annual:    { amount: 599.00, description: "VIP Anual MX" },
    vip_basic: { amount: 119.00, description: "VIP Basico MX" }
  },
  USD: {
    weekly:    { amount: 14.99,  description: "VIP Weekly USD" },
    monthly:   { amount: 44.99,  description: "VIP Monthly USD" },
    annual:    { amount: 124.99, description: "VIP Annual USD" },
    vip_basic: { amount: 5.99,   description: "VIP Basic USD" }
  },
  COP: {
    weekly:    { amount: 59900,  description: "VIP Semanal COP" },
    monthly:   { amount: 189900, description: "VIP Mensal COP" },
    annual:    { amount: 499900, description: "VIP Anual COP" },
    vip_basic: { amount: 79900,  description: "VIP Basico COP" }
  }
};

exports.handler = async function (event, context) {
  // CORS
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

  // Parse body
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

  const { plan, currency, external_id, payer_phone } = body;
  const targetCurrency = currency || "MXN"; // Fallback pra MXN se nao vier

  if (!PLANS[targetCurrency] || !PLANS[targetCurrency][plan]) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Plano ou moeda invalidos." })
    };
  }

  // Credenciais (sempre via env vars)
  const clientId     = process.env.XPAG_CLIENT_ID     || "";
  const clientSecret = process.env.XPAG_CLIENT_SECRET || "";
  const webhookUrl   = process.env.XPAG_WEBHOOK_URL   || "";
  const isTestMode   = process.env.XPAG_TEST_MODE === "true"; // badge visual apenas

  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Env vars XPAG_CLIENT_ID e XPAG_CLIENT_SECRET nao configuradas" })
    };
  }

  // Montar payload XPag
  const planData = PLANS[targetCurrency][plan];
  const txExternalId = external_id || (`${targetCurrency}-${plan.toUpperCase()}-${Date.now()}`);

  // XPag suporta USDT para dolares
  const xpagCurrency = targetCurrency === "USD" ? "USDT" : targetCurrency;

  const xpagPayload = {
    currency:    xpagCurrency,
    amount:      planData.amount,
    description: planData.description,
    external_id: txExternalId,
    name:        "Cliente VIP"
  };
  
  if (webhookUrl) xpagPayload.webhook_url = webhookUrl;

  // Chamar API XPag
  let xpagRes, xpagData;
  try {
    xpagRes = await fetch(XPAG_BASE_URL + "/cashin", {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        "X-Client-Id":     clientId,
        "X-Client-Secret": clientSecret
      },
      body: JSON.stringify(xpagPayload)
    });
    xpagData = await xpagRes.json();
  } catch (fetchErr) {
    console.error("[xpag-cashin] fetch error:", fetchErr);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Erro de conexao com a XPag. Tente novamente." })
    };
  }

  // Erro da XPag
  if (!xpagData.ok) {
    console.error("[xpag-cashin] XPag error:", xpagData);
    return {
      statusCode: xpagRes.status || 422,
      headers: corsHeaders,
      body: JSON.stringify({
        ok:         false,
        error:      xpagData.error || "Erro ao gerar cobranca",
        error_code: xpagData.error_code || "cashin_failed",
        sandbox:    isSandbox
      })
    };
  }

  // Sucesso — retorna os dados do pagamento correspondente a moeda
  console.log(`[xpag-cashin] OK: ${xpagData.transaction_id} | ${targetCurrency} ${xpagData.amount}`);
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ok:             true,
      test_mode:      isTestMode,
      currency:       targetCurrency,
      amount:         xpagData.amount,
      clabe:          xpagData.clabe || "",
      qr_code:        xpagData.copy_paste || xpagData.code || xpagData.qr || "",
      qr_url:         xpagData.qr_url || "",
      checkout_url:   xpagData.checkout_url || "", // COP retorna checkout_url
      bank_name:      xpagData.bank_name || "",
      beneficiary:    xpagData.beneficiary || "",
      transaction_id: xpagData.transaction_id,
      request_number: xpagData.request_number,
      status:         xpagData.status || "pending",
      external_id:    txExternalId
    })
  };
};
