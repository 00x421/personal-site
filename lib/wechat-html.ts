import { Marked } from 'marked';

/**
 * Markdown → 公众号正文 HTML。
 *
 * 公众号编辑器会剥掉 class、<style> 与外部样式表，一切观感必须
 * 内联在标签上。这里用 marked 的自定义渲染器直接产出带排版样式的
 * 标签，色彩沿用站点纸墨语汇：墨黑标题、印章红引用条、紫罗兰强调、
 * 深色代码块。中文字体交给微信终端自己（公众号内无网页字体一说）。
 *
 * 正文里的链接：未认证订阅号渲染为不可点击，样式保留（将来认证即亮），
 * 重要的网址由发文脚本在文末以纯文本再给一遍。
 */

const renderer = {
  heading({ tokens, depth }: { tokens: unknown[]; depth: number }) {
    const text = (this as any).parser.parseInline(tokens);
    if (depth === 2) {
      return `<h2 style="margin:30px 0 14px;padding-bottom:8px;border-bottom:1px solid #e5e2da;font-size:17px;font-weight:700;color:#1a1a1a;">${text}</h2>`;
    }
    if (depth === 3) {
      return `<h3 style="margin:24px 0 10px;font-size:15.5px;font-weight:700;color:#1a1a1a;">${text}</h3>`;
    }
    return `<h${depth} style="margin:20px 0 10px;font-size:15px;font-weight:700;color:#1a1a1a;">${text}</h${depth}>`;
  },
  paragraph({ tokens }: { tokens: unknown[] }) {
    const text = (this as any).parser.parseInline(tokens);
    return `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.85;color:#3f3e3b;text-align:justify;">${text}</p>`;
  },
  blockquote({ tokens }: { tokens: unknown[] }) {
    const inner = (this as any).parser.parse(tokens);
    return `<blockquote style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #b23b2e;background:#f7f5f0;font-size:13.5px;line-height:1.8;color:#6b6963;">${inner}</blockquote>`;
  },
  code({ text }: { text: string }) {
    return `<pre style="margin:0 0 14px;padding:13px 14px;background:#282c34;border-radius:6px;font-size:12.5px;line-height:1.7;color:#abb2bf;white-space:pre-wrap;word-break:break-all;"><code>${text}</code></pre>`;
  },
  codespan({ text }: { text: string }) {
    return `<code style="padding:2px 5px;border-radius:3px;background:#f0efeb;color:#c0392b;font-family:Menlo,Consolas,monospace;font-size:13px;">${text}</code>`;
  },
  list({ items, ordered }: { items: { tokens: unknown[] }[]; ordered: boolean }) {
    const parse = (this as any).parser;
    const tag = ordered ? 'ol' : 'ul';
    const body = items
      .map(
        (item) =>
          `<li style="margin:6px 0;font-size:14.5px;line-height:1.85;color:#3f3e3b;">${parse.parse(item.tokens)}</li>`,
      )
      .join('');
    return `<${tag} style="margin:0 0 14px;padding-left:22px;">${body}</${tag}>`;
  },
  link({ href, tokens }: { href: string; tokens: unknown[] }) {
    const text = (this as any).parser.parseInline(tokens);
    return `<a href="${href}" style="color:#6355ce;border-bottom:1px solid #d9d4f7;text-decoration:none;">${text}</a>`;
  },
  hr() {
    return `<hr style="margin:22px 0;border:0;border-top:1px dashed #d8d5cd;">`;
  },
};

const rendererForWechat = new Marked();
rendererForWechat.use({ renderer });

export function markdownToWechatHtml(markdown: string): string {
  return rendererForWechat.parse(markdown.trim()) as string;
}
