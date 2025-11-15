require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SECRET = process.env.SECRET;
const TARGET_BASE = process.env.TARGET_BASE;

let browser; // reused browser instance

// ---------- Launch Browser ----------
async function getBrowser() {
    if (browser && browser.isConnected()) return browser;

    browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
            "--single-process"
        ]
    });

    return browser;
}

// ---------- Proxy Route ----------
app.all('/proxy/*', async (req, res) => {
    try {
        // Authenticate
        const clientSecret = req.headers['x-proxy-secret'];
        if (clientSecret !== SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Build target URL
        const path = req.params[0]; 
        const targetUrl = `${TARGET_BASE}/${path}`;

        const browser = await getBrowser();
        const page = await browser.newPage();

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
        );

        let responseBody;

        if (req.method === "POST") {
            // POST request through puppeteer
            responseBody = await page.evaluate(
                async (url, body) => {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams(body)
                    });
                    return await res.text();
                },
                targetUrl,
                req.body
            );
        } else {
            // GET request
            await page.goto(targetUrl, { waitUntil: "networkidle0" });
            responseBody = await page.content();
        }

        await page.close();

        res.send(responseBody);

    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).json({ error: error.toString() });
    }
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`DSSM Proxy running on port ${PORT}`);
});
