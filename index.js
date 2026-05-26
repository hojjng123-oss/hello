const express = require("express");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("서버 정상작동!");
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
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countKeyword(text, keyword) {
  if (!keyword) return 0;
  return (text.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    }
  });

  return await response.text();
}

async function parseBlogContent(url) {
  const firstHtml = await fetchHtml(url);

  const iframeMatch = firstHtml.match(
    /<iframe[^>]+id=["']mainFrame["'][^>]+src=["']([^"']+)["']/i
  );

  let finalHtml = firstHtml;

  if (iframeMatch && iframeMatch[1]) {
    const iframeUrl = "https://blog.naver.com" + iframeMatch[1];
    finalHtml = await fetchHtml(iframeUrl);
  }

  const title =
    finalHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    finalHtml.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] ||
    "";

  const contentMatch =
    finalHtml.match(/<div[^>]+class=["'][^"']*se-main-container[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i) ||
    finalHtml.match(/<div[^>]+id=["']postViewArea["'][^>]*>([\s\S]*?)<\/div>/i);

  const rawContent = contentMatch?.[1] || finalHtml;
  const content = cleanText(rawContent);

  return {
    title: cleanText(title),
    content
  };
}

app.post("/search", async (req, res) => {
  try {
    const keyword = req.body.keyword || "";
    const targetType = (req.body.targetType || "blog").toLowerCase();

    const searchUrl =
      "https://search.naver.com/search.naver?query=" +
      encodeURIComponent(keyword);

    const html = await fetchHtml(searchUrl);
    const hrefMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)];

    const links = [...new Set(
      hrefMatches
        .map((m) => normalize(m[1]))
        .filter((link) => {
          if (targetType === "blog") {
            return (
              /^https:\/\/blog\.naver\.com\/[^\/]+\/\d+$/.test(link) ||
              /^https:\/\/m\.blog\.naver\.com\/[^\/]+\/\d+$/.test(link)
            );
          }

          if (targetType === "cafe") {
            return /^https:\/\/cafe\.naver\.com\/[^\/]+\/\d+$/.test(link);
          }

          return false;
        })
    )];

    const topUrl = links[0];

    if (!topUrl) {
      return res.json({
        success: false,
        keyword,
        message: "상위 링크를 찾지 못했습니다."
      });
    }

    const parsed = await parseBlogContent(topUrl);

    const noSpaceText = parsed.content.replace(/\s/g, "");
    const paragraphs = parsed.content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    res.json({
      success: true,
      keyword,
      targetType,
      rank: 1,
      url: topUrl,
      title: parsed.title,
      content: parsed.content,
      contentLength: parsed.content.length,
      noSpaceLength: noSpaceText.length,
      paragraphCount: paragraphs.length,
      keywordCount: countKeyword(parsed.content, keyword)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER RUNNING ON ${PORT}`);
});
