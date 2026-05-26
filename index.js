const express = require("express");
const { chromium } = require("playwright");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("PLAYWRIGHT MOBILE BLOG PARSER RUNNING");
});

function countKeyword(text, keyword) {
  if (!keyword) return 0;

  const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return (text.match(new RegExp(safeKeyword, "g")) || []).length;
}

function convertToMobileBlog(url) {

  const match = url.match(
    /^https:\/\/blog\.naver\.com\/([^\/]+)\/(\d+)$/
  );

  if (!match) return url;

  const blogId = match[1];
  const logNo = match[2];

  return `https://m.blog.naver.com/${blogId}/${logNo}`;
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
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1",
      viewport: {
        width: 390,
        height: 844
      }
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
        message: "상위 링크를 찾지 못했습니다."
      });

    }

    const mobileUrl = convertToMobileBlog(topUrl);

    await page.goto(mobileUrl, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    let title = "";
    let content = "";
    let debugSelector = "";

    try {

      title = await page
        .locator(".se_textarea")
        .first()
        .innerText({ timeout: 5000 });

    } catch (e) {

      try {

        title = await page.title();

      } catch (e2) {}

    }

    const selectors = [
      ".se-main-container",
      ".post_ct",
      ".se_component_wrap",
      ".post_view",
      ".end_container",
      "body"
    ];

    for (const selector of selectors) {

      try {

        const text = await page
          .locator(selector)
          .first()
          .innerText({ timeout: 5000 });

        if (
          text &&
          text.trim().length > content.length
        ) {

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
      mobileUrl,
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
  console.log(`PLAYWRIGHT MOBILE BLOG PARSER RUNNING ON ${PORT}`);
});
