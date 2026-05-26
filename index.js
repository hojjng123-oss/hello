const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("서버 정상작동!");
});

app.post("/search", async (req, res) => {

  try {

    const keyword = req.body.keyword || "";

    res.json({
      success: true,
      keyword,
      result: "검색 테스트 성공"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: error.message
    });

  }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER RUNNING ON ${PORT}`);
});
