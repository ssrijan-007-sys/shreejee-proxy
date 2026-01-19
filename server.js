require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==============================
// Health Check
// ==============================
app.get("/", (req, res) => {
  res.send("ShreeJee Delhivery Proxy Running ✅");
});

// ==============================
// CREATE ORDER / MANIFEST
// ==============================
app.post("/create-order", async (req, res) => {
  try {
    const response = await axios.post(
      "https://track.delhivery.com/api/cmu/create.json",
      req.body,
      {
        headers: {
          "Authorization": `Token ${process.env.DELHIVERY_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Delhivery Create Order Failed",
      details: error.response?.data || error.message
    });
  }
});

// ==============================
// TRACK ORDER
// ==============================
app.get("/track/:awb", async (req, res) => {
  try {
    const { awb } = req.params;

    const response = await axios.get(
      `https://track.delhivery.com/api/v1/packages/json/?waybill=${awb}`,
      {
        headers: {
          "Authorization": `Token ${process.env.DELHIVERY_API_KEY}`
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Tracking Failed",
      details: error.response?.data || error.message
    });
  }
});

// ==============================
// CANCEL ORDER
// ==============================
app.post("/cancel", async (req, res) => {
  try {
    const response = await axios.post(
      "https://track.delhivery.com/api/p/edit",
      req.body,
      {
        headers: {
          "Authorization": `Token ${process.env.DELHIVERY_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Cancel Failed",
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy running on http://localhost:${PORT}`);
});
