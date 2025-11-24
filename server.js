import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer";

const app = express();

// Allow Base44 + your frontend to call the service
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));

// --- API KEY SECURITY MIDDLEWARE ---
app.use((req, res, next) => {
  const clientKey = req.headers["x-api-key"];
  const serverKey = process.env.API_KEY;

  if (!serverKey) {
    console.error("ERROR: Missing API_KEY in environment variables");
    return res.status(500).json({ error: "Server misconfigured: missing API_KEY" });
  }

  if (clientKey !== serverKey) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  next();
});

// --- MAIN PDF GENERATION ENDPOINT ---
app.post("/generate-pdf", async (req, res) => {
  const { html, filename = "resume.pdf" } = req.body;

  if (!html) {
    return res.status(400).json({ error: "Missing HTML content" });
  }

  try {
    console.log("Launching Chromium...");

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-web-security",
        "--disable-features=IsolateOrigins",
        "--disable-site-isolation-trials"
      ]
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0"
    });

    console.log("Generating PDF...");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" }
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    });

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF ERROR:", err);
    res.status(500).json({
      error: "PDF generation failed",
      details: err.message
    });
  }
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 PDF microservice running on port ${PORT}`);
});
