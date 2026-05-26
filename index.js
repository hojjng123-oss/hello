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
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueByUrl(items) {
  const seen = new Set();

  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function getTitleNearLink(html, rawUrl) {
  const escaped = rawUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const index = html.search(new RegExp(escaped));

  if (index === -1) return "";

  const start = Math.max(0, index - 1500);
  const end = Math.min(html.length, index + 2500);
  const chunk = html.slice(start, end);

  const titlePatterns = [
    /<a[^>]*href=["'][^"']+["'][^>]*>(.*?)<\/a>/is,
    /<mark[^>]*>(.*?)<\/mark>/is,
    /<strong[^>]*>(.*?)<\/strong>/is,
    /<span[^>]*>(.*?)<\/span>/is
  ];

  for (const pattern of titlePatterns) {
    const match = chunk.match(pattern);
    const title = cleanText(match?.[1] || "");

    if (
      title &&
      title.length >= 4 &&
      !title.includes("네이버") &&
      !title.includes("블로그") &&
      !title.includes("카페")
    ) {
      return title;
    }
  }

  return "";
}

app.post("/search", async (req, res) => {
  try {
    const keyword = req.body.keyword || "";

    const searchUrl =
      "https://search.naver.com/search.naver?query=" +
      encodeURIComponent(keyword);

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      }
    });

    const html = await response.text();

    const hrefMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)];

    const rawItems = hrefMatches
      .map((m) => {
        const rawUrl = m[1];
        const url = normalize(rawUrl);

        return {
          rawUrl,
          url,
          type: url.includes("cafe.naver.com") ? "cafe" : "blog"
        };
      })
      .filter((item) =>
        item.url.includes("blog.naver.com/") ||
        item.url.includes("m.blog.naver.com/") ||
        item.url.includes("cafe.naver.com/")
      )
      .filter((item) =>
        !item.url.includes("search.naver.com") &&
        !item.url.includes("adcr") &&
        !item.url.includes("javascript")
      )
      .filter((item) =>
        /^https:\/\/blog\.naver\.com\/[^\/]+\/\d+$/.test(item.url) ||
        /^https:\/\/m\.blog\.naver\.com\/[^\/]+\/\d+$/.test(item.url) ||
        /^https:\/\/cafe\.naver\.com\/[^\/]+\/\d+$/.test(item.url)
      );

    const items = uniqueByUrl(rawItems)
      .slice(0, 20)
      .map((item, index) => ({
        rank: index + 1,
        type: item.type,
        url: item.url,
        title: getTitleNearLink(html, item.rawUrl) || ""
      }));

    res.json({
      success: true,
      keyword,
      searchUrl,
      totalLinks: items.length,
      results: items,
      blogResults: items.filter((item) => item.type === "blog"),
      cafeResults: items.filter((item) => item.type === "cafe")
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
