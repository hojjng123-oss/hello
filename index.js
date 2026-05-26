const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("서버 정상작동!");
});

app.post("/search", async (req, res) => {

  const keyword = req.body.keyword || "";

  res.json({
    success: true,
    keyword,
    result: "검색 테스트 성공"
  });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER RUNNING");
});
