import Prism from 'prismjs';
// .js 扩展名让纯 Node ESM（generate-og.ts）也能解析这些 CJS 组件。
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';

/** 纯 JS 实现，Workers 运行时无需 WASM；语言有限时退化为转义文本。 */
function escapeHtml(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function highlightCode(code: string, lang?: string): string {
  if (!lang) return escapeHtml(code);
  const grammar = Prism.languages[lang];
  if (!grammar) return escapeHtml(code);
  return Prism.highlight(code, grammar, lang);
}
