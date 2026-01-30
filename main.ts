// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const DELHIVERY_API_KEY = Deno.env.get("DELHIVERY_API_KEY");

if (!DELHIVERY_API_KEY) {
  console.error("❌ DELHIVERY_API_KEY not found");
}

/* ==============================
   CORS HEADERS
============================== */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const method = req.method;

  /* ==============================
     HEALTH CHECK
  ============================== */
  if (url.pathname === "/" && method === "GET") {
    return new Response("ShreeJee Delhivery Proxy Running Successfully✅", {
      headers: corsHeaders,
    });
  }

 // ==============================
// FETCH WAYBILLS (BULK)
// ==============================
if (url.pathname === "/fetch-waybills" && method === "POST") {
  try {
    const { count } = await req.json();

    const response = await fetch(
      `https://track.delhivery.com/waybill/api/bulk/json/?count=${count}`,
      {
        headers: {
          Authorization: `Token ${DELHIVERY_API_KEY}`,
        },
      }
    );

    const text = await response.text();

    const waybills = text
      .replace(/"/g, "")
      .split(",")
      .map(wb => wb.trim())
      .filter(Boolean);

    console.log("Fetched waybills:", waybills.length);

    return Response.json(
      { waybills, count: waybills.length },
      { headers: corsHeaders }
    );

  } catch (err) {
    return Response.json(
      { error: "Waybill fetch failed", details: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}



  /* ==============================
   CREATE ORDER / MANIFEST
============================== */
if (url.pathname === "/create-order" && method === "POST") {
  try {
    const body = await req.json();

    console.log("📦 /create-order received payload:", body);

    const formBody =
      "format=json&data=" +
      encodeURIComponent(JSON.stringify(body));

    const response = await fetch(
      "https://track.delhivery.com/api/cmu/create.json",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${DELHIVERY_API_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: formBody
      }
    );

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("📤 Delhivery response:", data);

    return Response.json(data, { headers: corsHeaders });

  } catch (err) {
    console.error("❌ Create order error:", err);
    return Response.json(
      { error: "Create Order Failed", details: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

  /* ==============================
     PINCODE SERVICEABILITY
  ============================== */
  if (url.pathname === "/serviceability" && method === "GET") {
    try {
      const pin = url.searchParams.get("pin");
      if (!pin) {
        return Response.json(
          { error: "pin is required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const response = await fetch(
        `https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${pin}`,
        {
          headers: {
            Authorization: `Token ${DELHIVERY_API_KEY}`,
          },
        }
      );
    

      const data = await response.json();
      return Response.json(data, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: "Serviceability check failed", details: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  /* ==============================
     TRACK SHIPMENT
  ============================== */
  if (url.pathname.startsWith("/track/") && method === "GET") {
    try {
      const awb = url.pathname.split("/")[2];

      const response = await fetch(
        `https://track.delhivery.com/api/v1/packages/json/?waybill=${awb}`,
        {
          headers: {
            Authorization: `Token ${DELHIVERY_API_KEY}`,
          },
        }
      );

      const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("📤 Delhivery response:", data);
    
      return Response.json(data, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: "Tracking failed", details: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  /* ==============================
     UPDATE SHIPMENT
  ============================== */
  // EDIT SHIPMENT
if (req.url.includes("/edit-shipment")) {
  const body = await req.json();

  const res = await fetch("https://staging-express.delhivery.com/api/p/edit", {
    method: "POST",
    headers: {
      "Authorization": `Token ${DENO_DELHIVERY_TOKEN}`,
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("📤 Delhivery response:", data);

  return new Response(await res.text(), {headers: {"content-type":"application/json"}});
}


// CANCEL SHIPMENT
if (req.url.includes("/cancel-shipment")) {
  const body = await req.json();

  const res = await fetch("https://staging-express.delhivery.com/api/p/edit", {
    method: "POST",
    headers: {
      "Authorization": `Token ${DENO_DELHIVERY_TOKEN}`,
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ waybill: body.waybill, cancellation: "true" })
  });

  const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("📤 Delhivery response:", data);
  return new Response(await res.text(), {headers: {"content-type":"application/json"}});
}

  return new Response("Not Found", { status: 404, headers: corsHeaders });
});
