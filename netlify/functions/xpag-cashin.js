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

// Planos MXN com valores em pesos (float)
const MXN_PLANS = {
  weekly:    { amount: 79.00,   description: "VIP Semanal 7 Dias + Chat Privado" },
  monthly:   { amount: 199.00,  description: "VIP Mensal + Chamadas de Video" },
  annual:    { amount: 599.00,  description: "VIP Anual + Video Chamadas + Saida VIP" },
  vip_basic: { amount: 119.00,  description: "VIP Basico" }
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

  const { plan, external_id } = body;

  if (!plan || !MXN_PLANS[plan]) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Plano invalido. Use: weekly, monthly, annual ou vip_basic" })
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
  const planData = MXN_PLANS[plan];
  const txExternalId = external_id || ("MX-" + plan.toUpperCase() + "-" + Date.now());

  const xpagPayload = {
    currency:    "MXN",
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

  // Sucesso — retorna CLABE + dados de exibicao
  console.log("[xpag-cashin] OK:", xpagData.transaction_id, "|", xpagData.clabe, "| MXN", xpagData.amount);
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ok:             true,
      test_mode:      isTestMode,   // badge visual no modal se XPAG_TEST_MODE=true
      clabe:          xpagData.clabe,
      reference:      xpagData.reference,
      amount:         xpagData.amount,
      currency:       "MXN",
      bank_name:      xpagData.bank_name   || "STP",
      beneficiary:    xpagData.beneficiary || "Zypher",
      transaction_id: xpagData.transaction_id,
      request_number: xpagData.request_number,
      status:         xpagData.status      || "pending",
      external_id:    txExternalId
    })
  };
};
