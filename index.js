async function fetchTitle(url) {
  try {
    let targetUrl = url;

    const blogMatch = url.match(/^https:\/\/blog\.naver\.com\/([^\/]+)\/(\d+)$/);

    if (blogMatch) {
      const blogId = blogMatch[1];
      const logNo = blogMatch[2];
      targetUrl = `https://m.blog.naver.com/${blogId}/${logNo}`;
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1"
      }
    });

    const html = await response.text();

    const ogTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];

    const titleTag = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1];

    return cleanText(ogTitle || titleTag || "");
  } catch (error) {
    return "";
  }
}
