// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const DELHIVERY_API_KEY = Deno.env.get("DELHIVERY_API_KEY");

if (!DELHIVERY_API_KEY) {
  console.error("❌ DELHIVERY_API_KEY not found");
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const method = req.method;

  // ==============================
  // Health Check
  // ==============================
  if (url.pathname === "/" && method === "GET") {
    return new Response("ShreeJee Delhivery Proxy Running ✅");
  }

  // ==============================
  // CREATE ORDER / MANIFEST
  // ==============================
  if (url.pathname === "/create-order" && method === "POST") {
    try {
      const body = await req.json();

      const response = await fetch(
        "https://track.delhivery.com/api/cmu/create.json",
        {
          method: "POST",
          headers: {
            "Authorization": `Token ${DELHIVERY_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();
      return Response.json(data, { headers: corsHeaders });

    } catch (err) {
      return Response.json(
        { error: "Delhivery Create Order Failed", details: err.message },
        { status: 500 , headers}
      );
    }
  }

  // ==============================
  // TRACK ORDER
  // ==============================
  if (url.pathname.startsWith("/track/") && method === "GET") {
    try {
      const awb = url.pathname.split("/")[2];

      const response = await fetch(
        `https://track.delhivery.com/api/v1/packages/json/?waybill=${awb}`,
        {
          headers: {
            "Authorization": `Token ${DELHIVERY_API_KEY}`
          }
        }
      );

      const data = await response.json();
      return Response.json(data, { headers: corsHeaders });

    } catch (err) {
      return Response.json(
        { error: "Tracking Failed", details: err.message },
        { status: 500 }
      );
    }
  }

  // ==============================
  // CANCEL ORDER
  // ==============================
  if (url.pathname === "/cancel" && method === "POST") {
    try {
      const body = await req.json();

      const response = await fetch(
        "https://track.delhivery.com/api/p/edit",
        {
          method: "POST",
          headers: {
            "Authorization": `Token ${DELHIVERY_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();
      return Response.json(data, { headers: corsHeaders });

    } catch (err) {
      return Response.json(
        { error: "Cancel Failed", details: err.message },
        { status: 500 }
      );
    }
  }
  // ==============================
// ASSIGN AWB
// ==============================
if (url.pathname === "/assign-awb" && method === "POST") {
  try {
    const body = await req.json();

    if (!body.order_id) {
      return Response.json(
        { error: "order_id is required" },
        { status: 400 , headers}
      );
    }

    const response = await fetch(
      "https://track.delhivery.com/api/p/edit",
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${DELHIVERY_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          order_id: body.order_id,
          action: "assign"
        })
      }
    );

    const text = await response.text();

let data;
try {
  data = JSON.parse(text);
} catch {
  return Response.json(
    {
      error: "Delhivery returned non-JSON response",
      raw: text
    },
    { status: 500, headers }
  );
}

    return Response.json(data , { headers: corsHeaders });
  } catch (err) {
    return Response.json(
      { error: "AWB Assignment Failed", details: err.message },
      { status: 500, headers }
    );
  }
}


  return new Response("Not Found", { status: 404 });
});
