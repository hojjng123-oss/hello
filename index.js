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
    const keyword = req.body.keyword || "";
    const targetType = (req.body.targetType || "blog").toLowerCase();

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
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

    const links = await page.$$eval("a", (els, targetType) => {
      return els
        .map((el) => el.href)
        .filter((href) => {
          if (!href) return false;

          if (targetType === "blog") {
            return (
              href.includes("blog.naver.com/") &&
              /\/\d+/.test(href)
            );
          }

          if (targetType === "cafe") {
            return (
              href.includes("cafe.naver.com/") &&
              /\/\d+/.test(href)
            );
          }

          return false;
        });
    }, targetType);

    const uniqueLinks = [...new Set(links)];
    const topUrl = uniqueLinks[0];

    if (!topUrl) {
      return res.json({
        success: false,
        message: "상위 링크를 찾지 못했습니다."
      });
    }

    await page.goto(topUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    const frame = page.frame({ name: "mainFrame" });

    const targetPage = frame || page;

    let title = "";
    let content = "";

    try {
      title = await targetPage.locator(".se-title-text").first().innerText({ timeout: 5000 });
    } catch (e) {
      title = await targetPage.title();
    }

    try {
      content = await targetPage.locator(".se-main-container").first().innerText({ timeout: 5000 });
    } catch (e) {
      try {
        content = await targetPage.locator("#postViewArea").first().innerText({ timeout: 5000 });
      } catch (e2) {
        content = "";
      }
    }

    const noSpaceText = content.replace(/\s/g, "");
    const paragraphs = content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    const keywordCount = keyword
      ? (content.match(new RegExp(keyword, "g")) || []).length
      : 0;

    res.json({
      success: true,
      keyword,
      targetType,
      rank: 1,
      url: topUrl,
      title,
      content,
      contentLength: content.length,
      noSpaceLength: noSpaceText.length,
      paragraphCount: paragraphs.length,
      keywordCount
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PLAYWRIGHT SERVER RUNNING ON ${PORT}`);
});
