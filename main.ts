// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import "https://deno.land/x/dotenv/load.ts";
import { normalizeDelhiveryStatus } from "./tracking-utils.ts";



const DELHIVERY_API_KEY = Deno.env.get("DELHIVERY_API_KEY");

if (!DELHIVERY_API_KEY) {
  console.error("❌ DELHIVERY_API_KEY not found");
}

Deno.cron("Track Shipments", "*/4 * * * *", async () => {
  console.log("⏱ Tracking cron running");

  try {
    const telecallers = await fbGet("Telecallers");
    if (!telecallers) return;

    const activeOrders: any[] = [];

    for (const tc of Object.values(telecallers)) {
      for (const phoneGroup of Object.values(tc.Orders || {})) {
        for (const order of Object.values(phoneGroup as any)) {
          if (
            order.awb &&
            !["DELIVERED", "RTO - RETURNED", "CANCELLED"].includes(order.status)
          ) {
            activeOrders.push(order);
          }
        }
      }
    }

    if (!activeOrders.length) return;

    for (let i = 0; i < activeOrders.length; i += 50) {
      const batch = activeOrders.slice(i, i + 50);
      const waybills = batch.map(o => o.awb).join(",");

      const res = await fetch(
        `https://track.delhivery.com/api/v1/packages/json/?waybill=${waybills}`,
        {
          headers: {
            Authorization: `Token ${Deno.env.get("DELHIVERY_API_KEY")}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await res.json();

      for (const pkg of data?.ShipmentData || []) {
        const awb = pkg?.Shipment?.Waybill;
        const rawStatus = pkg?.Shipment?.Status?.Status;
        const scans = pkg?.Shipment?.Scans || [];

        const status = normalizeDelhiveryStatus(rawStatus);

        // 🔄 Update orders
        for (const tcKey of Object.keys(telecallers)) {
          const orders = telecallers[tcKey].Orders || {};

          for (const phone of Object.keys(orders)) {
            for (const orderId of Object.keys(orders[phone])) {
              if (orders[phone][orderId].awb === awb) {
                await fbPatch(
                  `Telecallers/${tcKey}/Orders/${phone}/${orderId}`,
                  {
                    status,
                    lastTrackedAt: Date.now(),
                  }
                );

                await fbSet(`Tracking/${awb}`, {
                  status,
                  scans,
                  updatedAt: Date.now(),
                });
              }
            }
          }
        }
      }
    }

  } catch (err) {
    console.error("❌ Tracking cron failed:", err);
  }
});



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
   TRACK SHIPMENTS (SINGLE / BULK)
============================== */
if (url.pathname === "/track" && method === "GET") {
  try {
    const waybills = url.searchParams.get("waybills"); // comma separated
    const orderIds = url.searchParams.get("order_ids"); // optional

    if (!waybills && !orderIds) {
      return Response.json(
        { error: "waybills or order_ids required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const response = await fetch(
      `https://track.delhivery.com/api/v1/packages/json/?` +
        `waybill=${waybills || ""}&ref_ids=${orderIds || ""}`,
      {
        headers: {
          Authorization: `Token ${DELHIVERY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
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
  if (url.pathname === "/update-shipment" && method === "POST") {
    try {
      const body = await req.json();

      const response = await fetch(
        "https://track.delhivery.com/api/p/edit",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${DELHIVERY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();
      return Response.json(data, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: "Shipment update failed", details: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  /* ==============================
     CANCEL SHIPMENT
  ============================== */
  /* ==============================
   CANCEL SHIPMENT
============================== */
if (url.pathname === "/cancel-shipment" && method === "POST") {
  try {
    const body = await req.json();

    const response = await fetch(
      "https://track.delhivery.com/api/p/edit",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${DELHIVERY_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          waybill: body.waybill,
          cancellation: "true"
        }),
      }
    );

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } 
    catch { data = { raw: text }; }

    console.log("❌ Cancel response:", data);

    return Response.json(data, { headers: corsHeaders });

  } catch (err) {
    return Response.json(
      { error: "Cancel shipment failed", details: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}


  return new Response("Not Found", { status: 404, headers: corsHeaders });
});

