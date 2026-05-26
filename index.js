const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("PLAYWRIGHT SERVER RUNNING");
});

function countKeyword(text, keyword) {
  if (!keyword) return 0;

  const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(safeKeyword, "g")) || []).length;
}

app.post("/search", async (req, res) => {
  let browser;

  try {
    const keyword = req.body.keyword || "";
    const targetType = (req.body.targetType || "blog").toLowerCase();

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      viewport: { width: 1366, height: 900 }
    });

    const searchUrl =
      "https://search.naver.com/search.naver?query=" +
      encodeURIComponent(keyword);

    await page.goto(searchUrl, {
      waitUntil: "networkidle",
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
        keyword,
        targetType,
        message: "상위 링크를 찾지 못했습니다."
      });
    }

    await page.goto(topUrl, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    const frame = page.frame({ name: "mainFrame" });
    const targetPage = frame || page;

    let title = "";
    let content = "";
    let debugSelector = "";

    try {
      title = await targetPage.title();
    } catch (e) {
      title = "";
    }

    const selectors = [
      ".se-main-container",
      "#postViewArea",
      ".se_component_wrap",
      ".post-view",
      ".post_ct",
      "body"
    ];

    for (const selector of selectors) {
      try {
        const text = await targetPage
          .locator(selector)
          .first()
          .innerText({ timeout: 7000 });

        if (text && text.trim().length > content.length) {
          content = text.trim();
          debugSelector = selector;
        }
      } catch (e) {}
    }

    const noSpaceText = content.replace(/\s/g, "");

    const paragraphs = content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

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
      keywordCount: countKeyword(content, keyword),
      debugSelector
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
