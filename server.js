require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SECRET = process.env.SECRET;
const TARGET_BASE = process.env.TARGET_BASE;

app.all('/proxy/*', async (req, res) => {
    try {
        // Check secret header
        const clientSecret = req.headers['x-proxy-secret'];
        if (clientSecret !== SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const path = req.params[0]; // everything after /proxy/
        const targetUrl = `${TARGET_BASE}/${path}`;

        // Launch Puppeteer to bypass Cloudflare
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // If POST, we can submit via fetch inside the page
        let responseBody;

        if (req.method === 'POST') {
            // Use page.evaluate to do fetch POST
            responseBody = await page.evaluate(
                async (url, body) => {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams(body)
                    });
                    return res.text();
                },
                targetUrl,
                req.body
            );
        } else {
            await page.goto(targetUrl, { waitUntil: 'networkidle0' });
            responseBody = await page.content(); // HTML content
        }

        await browser.close();

        res.send(responseBody);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.toString() });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Dssm proxy running on port ${PORT}`);
});
