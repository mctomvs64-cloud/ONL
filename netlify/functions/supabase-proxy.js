// ============================================================
// Supabase Admin Proxy — Netlify Serverless Function
// ============================================================
// Proxies admin-level Supabase requests so the service_role key
// never appears in client-side code.
//
// Env vars (Netlify dashboard → Env vars):
//   SUPABASE_URL          = "https://icjaadpiwzhyoccgdejl.supabase.co"
//   SUPABASE_SERVICE_KEY  = "<service_role JWT>"
// ============================================================

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

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "SUPABASE_URL and SUPABASE_SERVICE_KEY env vars not configured" })
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

  const { action, password } = body;

  // Simple password gate for admin actions
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "99083160";
  if (password !== ADMIN_PASSWORD) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Unauthorized" })
    };
  }

  const headers = {
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };

  try {
    if (action === "get_events") {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/analytics_events?select=*&order=created_at.desc`,
        { headers }
      );
      const data = await res.json();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true, data })
      };
    }

    if (action === "get_leads") {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/leads?select=*&order=created_at.desc`,
        { headers }
      );
      const data = await res.json();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true, data })
      };
    }

    if (action === "count_leads") {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/leads?select=*`,
        { headers: { ...headers, "Prefer": "count=exact", "Range": "0-0" } }
      );
      const countHeader = res.headers.get("content-range");
      const count = countHeader ? parseInt(countHeader.split("/")[1]) : 0;
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true, count })
      };
    }

    if (action === "delete_event") {
      const { event_id } = body;
      const res = await fetch(
        `${supabaseUrl}/rest/v1/analytics_events?id=eq.${event_id}`,
        { method: "DELETE", headers }
      );
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true })
      };
    }

    if (action === "delete_lead") {
      const { lead_id } = body;
      const res = await fetch(
        `${supabaseUrl}/rest/v1/leads?id=eq.${lead_id}`,
        { method: "DELETE", headers }
      );
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true })
      };
    }

    if (action === "reset") {
      // Call the RPC function
      const res = await fetch(
        `${supabaseUrl}/rest/v1/rpc/reset_id_counters`,
        { method: "POST", headers, body: JSON.stringify({}) }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Reset RPC failed");
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true, message: "All data reset successfully" })
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Unknown action: " + action })
    };

  } catch (err) {
    console.error("[supabase-proxy] Error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
