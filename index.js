const express = require("express");
const { chromium } = require("playwright");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("PLAYWRIGHT SERVER RUNNING");
});

app.post("/search", async (req, res) => {
  let browser;

  try {
    const keyword = req.body.keyword || "재경관리사";

    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage();

    const searchUrl =
      "https://search.naver.com/search.naver?query=" +
      encodeURIComponent(keyword);

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    const links = await page.$$eval("a", (elements) => {
      return elements
        .map((el) => el.href)
        .filter(
          (href) =>
            href &&
            href.includes("blog.naver.com") &&
            /\d+$/.test(href)
        );
    });

    const uniqueLinks = [...new Set(links)];

    res.json({
      success: true,
      keyword,
      count: uniqueLinks.length,
      links: uniqueLinks.slice(0, 10)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });

  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PLAYWRIGHT SERVER RUNNING ON ${PORT}`);
});
