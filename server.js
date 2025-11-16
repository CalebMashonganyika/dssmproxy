import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// =============================
//  SECURITY KEY MIDDLEWARE
// =============================
app.use((req, res, next) => {
  const key = req.headers["x-paynow-key"];
  if (!key || key !== process.env.PROXY_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// =============================
//  TEST ROUTE
// =============================
app.get("/", (req, res) => {
  res.json({ status: "Paynow Proxy Running" });
});

// =============================
//  POST /paynow/initiate
// =============================
app.post("/paynow/initiate", async (req, res) => {
  try {
    const { amount, email, phone } = req.body;

    if (!amount || !email || !phone) {
      return res.status(400).json({ error: "Missing amount, email, or phone" });
    }

    // Prepare Paynow POST params (x-www-form-urlencoded)
    const params = new URLSearchParams({
      id: process.env.PAYNOW_INTEGRATION_ID,
      reference: "DSSM-" + Date.now(),
      amount: amount.toString(),
      authemail: email, // FIXED: Changed from authEmail to authemail
      phone: phone,
      returnurl: process.env.RETURN_URL,
      resulturl: process.env.RESULT_URL,
    });

    console.log("Paynow request params:", Object.fromEntries(params));

    // Initiate transaction with Paynow
    const response = await fetch(
      "https://www.paynow.co.zw/interface/initiatetransaction",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );

    const text = await response.text();
    console.log("Paynow raw response:", text);

    const data = Object.fromEntries(new URLSearchParams(text));
    console.log("Paynow parsed response:", data);

    res.json({ success: true, ...data });
  } catch (err) {
    console.error("INITIATE ERROR:", err);
    res.status(500).json({ success: false, error: "Failed to initiate payment" });
  }
});

// =============================
//  GET /paynow/status?pollUrl=...
// =============================
app.get("/paynow/status", async (req, res) => {
  try {
    const pollUrl = req.query.pollUrl;
    if (!pollUrl) {
      return res.status(400).json({ error: "Missing pollUrl parameter" });
    }

    console.log("Checking payment status for:", pollUrl);

    const response = await fetch(pollUrl);
    const text = await response.text();
    console.log("Status raw response:", text);

    const data = Object.fromEntries(new URLSearchParams(text));
    console.log("Status parsed response:", data);

    res.json({ success: true, ...data });
  } catch (err) {
    console.error("STATUS ERROR:", err);
    res.status(500).json({ success: false, error: "Failed to fetch payment status" });
  }
});

// =============================
//  START SERVER
// =============================
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`DSSM Proxy running on port ${port}`);
});
