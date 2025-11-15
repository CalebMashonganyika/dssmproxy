require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SECRET = process.env.SECRET;
const TARGET_BASE = process.env.TARGET_BASE;

async function createBrowser() {
    return await puppeteer.launch({
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
}

app.all('/proxy/*', async (req, res) => {
    try {
        // Validate secret
        const clientSecret = req.headers['x-proxy-secret'];
        if (clientSecret !== SECRET) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const path = req.params[0]; // everything after /proxy/
        const targetUrl = `${TARGET_BASE}/${path}`;

        const browser = await createBrowser();
        const page = await browser.newPage();

        let responseBody;

        if (req.method === "POST") {
            // Submit POST through puppeteer
            responseBody = await page.evaluate(
                async (url, body) => {
                    const result = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams(body)
                    });
                    return await result.text();
                },
                targetUrl,
                req.body
            );
        } else {
            // Normal GET
            await page.goto(targetUrl, { waitUntil: "networkidle0" });
            responseBody = await page.content();
        }

        await browser.close();
        res.send(responseBody);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.toString() });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`DSSM Proxy running on port ${PORT}`);
});
