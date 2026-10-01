'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * 「问小机器人」聊天面板：GrokBot 气泡里「再点一下」打开。
 * 原生 <dialog>，交互惯例镜像站内搜索（site-search）。
 *
 * 协议：POST /api/ask 回 NDJSON 流——{"t":"d","v":增量} / {"t":"s",sources} /
 * {"t":"e",message}；GET /api/ask 查开关。回答由 AI 依据站内内容生成，
 * 面板底部常驻免责一行。
 */

type Source = { title: string; path: string };

const EXAMPLES = ['这个站是怎么搭起来的？', '字体分片是什么？', '站长能做什么？'];

/** 限流等待时间的人性化显示：3068 秒读不懂，51 分钟才读得懂。 */
function formatRetry(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  if (sec < 3600) return `${Math.ceil(sec / 60)} 分钟`;
  return `${Math.ceil(sec / 3600)} 个小时`;
}

/** 把回答里的 [标题](路径) 引用渲染成真链接（LLM 输出的是 markdown 原文）。
    只放行站内相对路径，外链保持原文——回答的引用只该指向站内。 */
function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)]*\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = /^\[([^\]]+)\]\((\/[^)]*)\)$/.exec(part);
        if (!match) return part;
        return (
          <a key={i} href={match[2]}>
            {match[1]}
          </a>
        );
      })}
    </>
  );
}

export function BotChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** 面板内的上一问：随下一问传给后端做指代消解（「那第二步呢？」）。 */
  const lastQuestionRef = useRef<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'streaming' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.showModal();
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      abortRef.current?.abort();
    };
  }, [open]);

  function close() {
    dialogRef.current?.close();
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || phase === 'streaming') return;
    setQuestion(q);
    setAnswer('');
    setSources(null);
    setErrorText('');
    setPhase('streaming');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, previous: lastQuestionRef.current ?? undefined }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          retryAfterSec?: number;
        };
        setErrorText(
          data.error === 'rate-limited' || data.error === 'rate-limited-global'
            ? `问得太快啦，让我缓缓——约 ${formatRetry(data.retryAfterSec ?? 60)}后再来。`
            : '我这边脑子短路了，过一会儿再试。',
        );
        setPhase('error');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      lastQuestionRef.current = q;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            t: 'd' | 's' | 'e';
            v?: string;
            sources?: Source[];
            text?: string;
            message?: string;
          };
          if (event.t === 'd' && event.v) setAnswer((current) => current + event.v);
          else if (event.t === 's') {
            if (event.text) setAnswer(event.text);
            setSources(event.sources ?? []);
          } else if (event.t === 'e') {
            setErrorText(event.message ?? '回答到一半断了。');
            setPhase('error');
          }
        }
      }
      setPhase((current) => (current === 'error' ? current : 'idle'));
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setErrorText('网络出了点问题，再试一次。');
        setPhase('error');
      }
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="bot-chat-modal"
      aria-label="向小信提问"
      onClose={() => {
        setPhase('idle');
        // 上一问的指代链只在本会话内有效——关掉面板即作废，
        // 否则重开后问新话题，检索会被陈旧的 previous 带偏
        lastQuestionRef.current = null;
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <div className="bot-chat-head">
        {/* oxlint-disable-next-line next/no-img-element -- 吉祥物头像贴图，本地静态资源。 */}
        <img src="/grokbot-thinking-nav.webp" alt="" width={30} height={30} />
        <strong>问小信</strong>
        <button type="button" className="bot-chat-close" onClick={close} aria-label="关闭提问">
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="bot-chat-log" aria-live="polite">
        {phase === 'idle' && !answer && (
          <div className="bot-chat-hint">
            <p>我是小信，可以依据站里的文章和项目回答问题，比如：</p>
            <div className="bot-chat-examples">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => send(example)}>
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
        {question && (
          <p className="bot-chat-question">
            <span>你问</span>
            {question}
          </p>
        )}
        {(answer || phase === 'streaming') && (
          <div className="bot-chat-answer">
            <AnswerText text={answer} />
            {phase === 'streaming' && <span className="bot-chat-cursor" aria-hidden="true" />}
          </div>
        )}
        {sources && sources.length > 0 && phase !== 'streaming' && (
          <div className="bot-chat-sources">
            来源：
            {sources.map((source) => (
              <a key={source.path} href={source.path}>
                {source.title}
              </a>
            ))}
          </div>
        )}
        {phase === 'error' && <p className="bot-chat-error">{errorText}</p>}
      </div>

      <form
        className="bot-chat-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          send(question);
        }}
      >
        <input
          ref={inputRef}
          className="bot-chat-input"
          type="text"
          value={question}
          maxLength={300}
          placeholder={
            phase === 'streaming' ? '小信正在想……' : '问问站里写过的事（Enter 发送）'
          }
          aria-label="向小信提问"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button
          type="submit"
          className="bot-chat-send"
          disabled={phase === 'streaming' || !question.trim()}
        >
          发送
        </button>
      </form>
      <p className="bot-chat-note">回答由 AI 依据站内文章生成，可能出错；答不出的它会直说。</p>
    </dialog>
  );
}
