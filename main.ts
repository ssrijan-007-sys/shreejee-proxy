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
  if (req.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
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
        { status: 500 }
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

  return new Response("Not Found", { status: 404 });
});
