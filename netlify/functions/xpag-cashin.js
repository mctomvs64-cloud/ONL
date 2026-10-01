// ============================================================
// XPag Cash-In — Netlify Serverless Function
// ============================================================
// Cria uma cobranca SPEI/CLABE MXN na XPag.
// Credenciais ficam APENAS no servidor (env vars no painel Netlify).
//
// Env vars necessarias (Netlify dashboard -> Site settings -> Env):
//   XPAG_ENV           = "sandbox"     (trocar para "production" quando quiser ir ao ar)
//   XPAG_CLIENT_ID     = "tomvs_46029384"             (producao)
//   XPAG_CLIENT_SECRET = "2ob5g70i6042fmva9qon019q"   (producao)
//   XPAG_WEBHOOK_URL   = "https://webhook.site/SEU-UUID"
// ============================================================

const XPAG_BASE_URL = "https://api.xpag.global";

// Credenciais de Sandbox (publicas — nao movem dinheiro real)
const SANDBOX_CLIENT_ID     = "xpagsandbox_00000000";
const SANDBOX_CLIENT_SECRET = "202620262026202620262026";

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

  // Ambiente: sandbox (padrao) ou production
  const isSandbox = (process.env.XPAG_ENV || "sandbox") !== "production";

  const clientId     = isSandbox ? SANDBOX_CLIENT_ID     : (process.env.XPAG_CLIENT_ID     || "");
  const clientSecret = isSandbox ? SANDBOX_CLIENT_SECRET : (process.env.XPAG_CLIENT_SECRET || "");
  const webhookUrl   = process.env.XPAG_WEBHOOK_URL || "";

  if (!isSandbox && (!clientId || !clientSecret)) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Credenciais de producao nao configuradas" })
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
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ok:             true,
      sandbox:        isSandbox,
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
