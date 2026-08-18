import { describe, expect, it } from "vitest";
import { ExternalSyncService } from "./external-sync.service";

describe("ExternalSyncService parsing heuristics", () => {
  const service = new ExternalSyncService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it("prefers the body title and body image over header chrome", () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="示例站">
          <meta property="og:title" content="示例站 - 首页">
          <meta property="og:image" content="https://example.com/logo.png">
          <title>示例站 - 首页</title>
        </head>
        <body>
          <header>
            <h1>示例站</h1>
            <img src="/logo.png" alt="站点logo" width="64" height="64">
          </header>
          <main>
            <article>
              <h1>真正的正文标题</h1>
              <p>这里是正文内容。</p>
              <img src="/uploads/body-image.jpg" alt="正文配图" width="1200" height="800">
            </article>
          </main>
        </body>
      </html>
    `;

    const item = (service as any).parseArticleHtml(
      html,
      "https://example.com/posts/1",
    );
    expect(item.title).toBe("真正的正文标题");
    expect(item.images[0]).toBe("https://example.com/uploads/body-image.jpg");
  });

  it("removes repeated site names from title tags when body title is missing", () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="PbootCMS">
          <title>PbootCMS - 近期针对 PbootCMS 被入侵后的 SEO 劫持/黑链跳转</title>
        </head>
        <body>
          <main>
            <p>正文内容。</p>
          </main>
        </body>
      </html>
    `;

    const item = (service as any).parseArticleHtml(
      html,
      "https://pbootcms.com/articles/abc",
    );
    expect(item.title).toBe("近期针对 PbootCMS 被入侵后的 SEO 劫持/黑链跳转");
  });
});
