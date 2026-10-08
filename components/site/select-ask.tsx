'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * 划词即问：在正文里选中一段文字，浮出「问问小信」按钮。
 * 点击把这段话连同文章标题打包成问题，经 nav-buddy 的预填链路
 * 打开聊天面板直接提问（事件名 xwsx:ask）。
 *
 * 只在 .article-body 内生效；滚动/缩放即收起，避免按钮钉在过期的
 * 选区位置上。MIN_CHARS 挡住双击选词的碎片段——选一个词还不够
 * 构成一个值得问的问题。
 */

const MIN_CHARS = 6;
const MAX_SNIPPET = 120;
export const ASK_EVENT = 'xwsx:ask';

type Pop = { x: number; y: number; question: string };

export function SelectAsk() {
  const [pop, setPop] = useState<Pop | null>(null);
  const lastRef = useRef('');

  useEffect(() => {
    function readSelection() {
      const selection = window.getSelection();
      const text = selection?.toString().replace(/\s+/g, ' ').trim() ?? '';
      if (!selection || selection.isCollapsed || text.length < MIN_CHARS) {
        lastRef.current = '';
        setPop(null);
        return;
      }
      // 只认正文：输入框、目录、聊天面板里的选中一概不碰
      if (!selection.anchorNode?.parentElement?.closest('.article-body')) {
        lastRef.current = '';
        setPop(null);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (!rect.width) return;
      const title =
        document.querySelector('.article-detail h1')?.textContent?.trim() ?? '';
      const snippet =
        text.slice(0, MAX_SNIPPET) + (text.length > MAX_SNIPPET ? '……' : '');
      const question = `我在读《${title}》，这段话：「${snippet}」——这段在说什么？`;
      // 同一个选区反复触发 selectionchange 时别重渲染（拖拽选择时高频）
      const next = `${Math.round(rect.left)},${Math.round(rect.top)},${question}`;
      if (next === lastRef.current) return;
      lastRef.current = next;
      setPop({
        x: Math.min(Math.max(rect.left + rect.width / 2, 70), window.innerWidth - 70),
        y: Math.max(rect.top - 46, 8),
        question,
      });
    }
    function onHide() {
      lastRef.current = '';
      setPop(null);
    }
    document.addEventListener('selectionchange', readSelection);
    window.addEventListener('scroll', onHide, { passive: true });
    window.addEventListener('resize', onHide);
    return () => {
      document.removeEventListener('selectionchange', readSelection);
      window.removeEventListener('scroll', onHide);
      window.removeEventListener('resize', onHide);
    };
  }, []);

  function ask() {
    if (!pop) return;
    window.dispatchEvent(
      new CustomEvent(ASK_EVENT, { detail: { question: pop.question } }),
    );
    window.getSelection()?.removeAllRanges();
    setPop(null);
  }

  if (!pop) return null;
  return (
    <button
      type="button"
      className="select-ask-pop"
      style={{ left: pop.x, top: pop.y }}
      // 按住按钮的那一刻浏览器会清掉选区、触发 selectionchange——
      // 按钮自己先消失，click 永远轮不到。preventDefault 保住选区。
      onMouseDown={(event) => event.preventDefault()}
      onClick={ask}
    >
      <Sparkles size={13} aria-hidden="true" />
      问问小信
    </button>
  );
}
