const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("서버 정상작동!");
});

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

    res.json({
      success: true,
      keyword,
      searchUrl,
      htmlLength: html.length,
      preview: html.slice(0, 500)
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
