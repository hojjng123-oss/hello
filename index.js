const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("PLAYWRIGHT HTML PARSER RUNNING");
});

function normalize(url) {
  return (url || "")
    .toString()
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/^http:\/\//, "https://")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");
}

function cleanText(text) {
  return (text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function countKeyword(text, keyword) {
  if (!keyword) return 0;

  const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(safeKeyword, "g")) || []).length;
}

function parseNaverBlogHtml(html) {
  const elements = [];

  const titleTags = html.matchAll(
    /<[^>]*class="[^"]*se-title-text[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/g
  );

  for (const match of titleTags) {
    const text = cleanText(match[1]);
    if (text) elements.push(`^^^${text}`);
  }

  const quotationTags = html.matchAll(
    /<[^>]*class="[^"]*se-section-quotation[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  );

  for (const match of quotationTags) {
    const text = cleanText(match[1]);
    if (text) elements.push(`^^^${text}`);
  }

  const sectionTags = html.matchAll(
    /<[^>]*class="[^"]*se-section-text[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  );

  for (const match of sectionTags) {
    const inner = match[1];

    const pTags = inner.matchAll(
      /<p[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g
    );

    const lines = [];

    for (const p of pTags) {
      const text = cleanText(p[1]);
      if (text) lines.push(text);
    }

    const combined = lines.join(" ").trim();

    if (combined) {
      elements.push(`|||${combined}`);
    }
  }

  const tableTags = html.matchAll(
    /<[^>]*class="[^"]*se-section-table[^"]*"[^>]*>/g
  );

  for (const match of tableTags) {
    elements.push("###TABLE###");
  }

  const content = elements.join("");

  return {
    content,
    paragraph_count: elements.filter((e) => e.startsWith("|||")).length,
    heading_count: elements.filter((e) => e.startsWith("^^^")).length,
    table_count: elements.filter((e) => e.startsWith("###")).length
  };
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
      viewport: {
        width: 1366,
        height: 900
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
              /^https:\/\/blog\.naver\.com\/[^\/]+\/\d+/.test(href) ||
              /^https:\/\/m\.blog\.naver\.com\/[^\/]+\/\d+/.test(href)
            );
          }

          if (targetType === "cafe") {
            return /^https:\/\/cafe\.naver\.com\/[^\/]+\/\d+/.test(href);
          }

          return false;
        });
    }, targetType);

    const uniqueLinks = [...new Set(links.map(normalize))];
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

    await page.waitForTimeout(3000);

    const frame = page.frame({ name: "mainFrame" });
    const targetPage = frame || page;

    const html = await targetPage.content();

    const parsed = parseNaverBlogHtml(html);

    const pageTitle = await targetPage.title().catch(() => "");

    const noSpaceText = parsed.content.replace(/\s/g, "");

    res.json({
      success: true,
      keyword,
      targetType,
      rank: 1,
      url: topUrl,
      title: pageTitle,
      content: parsed.content,
      contentLength: parsed.content.length,
      noSpaceLength: noSpaceText.length,
      paragraphCount: parsed.paragraph_count,
      headingCount: parsed.heading_count,
      tableCount: parsed.table_count,
      keywordCount: countKeyword(parsed.content, keyword)
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
  console.log(`PLAYWRIGHT HTML PARSER RUNNING ON ${PORT}`);
});
