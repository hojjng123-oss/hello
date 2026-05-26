async function fetchTitle(url) {

  try {

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      }
    });

    const html = await response.text();

    // 블로그 iframe 찾기
    const iframeMatch = html.match(
      /<iframe[^>]+id=["']mainFrame["'][^>]+src=["']([^"']+)["']/i
    );

    let finalHtml = html;

    // iframe 있으면 내부 페이지 다시 요청
    if (iframeMatch && iframeMatch[1]) {

      const iframeUrl =
        "https://blog.naver.com" + iframeMatch[1];

      const iframeResponse = await fetch(iframeUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
        }
      });

      finalHtml = await iframeResponse.text();

    }

    // og:title 우선
    const ogTitle =
      finalHtml.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      )?.[1];

    // title 태그 fallback
    const titleTag =
      finalHtml.match(/<title[^>]*>(.*?)<\/title>/is)?.[1];

    const rawTitle = ogTitle || titleTag || "";

    return cleanText(rawTitle);

  } catch (error) {

    return "";

  }

}
