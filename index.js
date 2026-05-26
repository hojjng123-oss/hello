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

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

app.post("/search", async (req, res) => {

  try {

    const keyword = req.body.keyword || "";
    const targetType = (req.body.targetType || "blog").toLowerCase();

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

    const hrefMatches = [
      ...html.matchAll(/href=["']([^"']+)["']/gi)
    ];

    const allLinks = unique(
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

            return (
              /^https:\/\/cafe\.naver\.com\/[^\/]+\/\d+$/.test(link)
            );

          }

          return false;

        })
        .filter((link) =>
          !link.includes("search.naver.com") &&
          !link.includes("adcr") &&
          !link.includes("javascript")
        )
    );

    res.json({
      success: true,
      keyword,
      targetType,
      totalLinks: allLinks.length,
      links: allLinks.slice(0, 20)
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
