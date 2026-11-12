import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RevealScene } from '@/components/site/reveal-scene';
import { measureDurationMs } from '@/lib/reveal-motion';

export const metadata: Metadata = {
  title: '把内容画出来 — 实验',
  description:
    '几个指针先量好位置，元素才被一个字一个字写出来。一个还没放进正式页面的实验页。',
  alternates: { canonical: '/lab' },
  // 实验页不进索引：它只是把别处的效果演一遍，自己没有可被搜到的信息。
  robots: { index: false, follow: false },
};

/**
 * 在首屏绘制**之前**给 `<html>` 打上播放标记。
 *
 * 这是整页最要紧的一行：样式表里所有「先藏起来」的规则都挂在
 * `html[data-rv-play='1']` 下。脚本跑不了（关闭 JS）、系统开了「减少动态效果」，
 * 属性就不存在，于是隐藏规则一条都不匹配——页面就是一张排版正常、直接可读的静态页。
 * 参考站把 `visibility: hidden` 直接写在样式里，脚本一挂就是空白；内容站不能这样。
 */
const playScript = `(function(){try{if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.dataset.rvPlay='1';}}catch(e){}})();`;

/** 徽章与量框时长的取样尺寸。 */
const SAMPLE = { width: 240, height: 96 };
const measureMs = measureDurationMs(SAMPLE.width, SAMPLE.height);

/**
 * 打字节奏的四个数：基准 50ms，空格后 ×1.5、标点后 ×1.9，
 * 打错一次（多打 1–2 个 + 停 240–460ms + 逐字退格 + 停 110ms）约 420ms。
 * 前三个是按模型的加权系数算出来的，不是手抄的观感值。
 */
const BASE_MS = 50;
const stages = [
  { label: '普通', ms: BASE_MS },
  { label: '空格后', ms: Math.round(BASE_MS * 1.5) },
  { label: '标点后', ms: Math.round(BASE_MS * 1.9) },
  { label: '打错回退', ms: 420 },
];
const stageMax = Math.max(...stages.map((stage) => stage.ms));

/**
 * 页面上的中文一律只用字体分片里有的字（1113 个码位，见 lib/glyph-coverage.ts）。
 * 缺字浏览器不会报错，只会静默回退到访客本机字体——衬线标题里混进宋体就是这么来的。
 */
const cards = [
  {
    label: 'PEN / 笔形',
    value: '5 种',
    note: 'arrow · cross · ibeam · resize · pen',
  },
  {
    label: 'HANDS / 指针',
    value: '4–14 支',
    note: '按视口面积给，桌面约 12 支',
  },
  {
    label: 'TRAVEL / 移动',
    value: '对数',
    note: '先冲过一点，再回到目标',
  },
];

const notes = [
  {
    title: '没有 JS，它就是一张普通页面',
    body: '「先藏起来」这条规则只写在 html[data-rv-play=1] 下，而这个属性由一段页内脚本在首屏绘制前加上，且只在系统没有开启「减少动态效果」时才加。关掉 JS、开了减少动态效果、或者抓取程序来读，拿到的都是完整可读的静态内容，不是空白。',
  },
  {
    title: '写字是节奏，不是逐次显示',
    body: '每个字之间的间隔围绕 50ms 跳动，空格后停 1.5 倍、标点后停 1.9 倍、大写字母慢一点；大约每 60 个字会打错一次——先打错键、多打一两个字、停一下、再一个个退掉。整段再按长度压缩，长段落不会拖成 5 秒。人写字的不平均，就在这些地方。',
  },
  {
    title: '指针不走直线',
    body: '移动用时只看距离的对数，所以近处不会一下就过去、远处也不会拖很长。每次移动先「冲过头」一点点再回到目标，走的是带转角的两段路；arrow 笔形会跟着行进方向慢慢转。三条加起来，手才不像补间动画。',
  },
  {
    title: '逐字显示不动 DOM',
    body: '用 CSS Custom Highlight 把「还没写到」的那一段设成透明，写出进度靠移动 Range 的起点。整块文字从头到尾没有被拆成一个个节点，所以不可能重排、也不会把拉丁词拆出新的断行点。',
  },
  {
    title: '徽章上的数字是真的',
    body: '选框宽高与徽章读数来自同一个取整后的尺寸，文字框更是每次都按 Range 的实测范围画——写着写着行数变多，框会跟着长。这类效果的全部信用都在这一点上。',
  },
  {
    title: '刻意没进首屏',
    body: '这套东西会把文字出现的时间往后推，而首屏 LCP 要的正是这段时间。所以它只能出现在首屏以下、读者已经准备好的位置。',
  },
];

export default function LabPage() {
  return (
    <main className="article-page">
      <div className="article-shell">
        <script dangerouslySetInnerHTML={{ __html: playScript }} />
        <Link href="/#top" className="back-link">
          <ArrowLeft size={15} /> 返回首页
        </Link>

        <header className="lab-head">
          <span className="section-index">LAB / 01</span>
          <h1>
            把内容，<em>写</em>出来。
          </h1>
          <p className="lab-lede">
            一个还没放进正式页面的实验：指针先移过来、按住、拖出选框，尺寸徽章跟着边长边报数，
            框画满的那一刻内容才开始一个字一个字被写出来。十几支指针同时在干活。
          </p>
        </header>

        <RevealScene className="lab-scene" replayable>
          <div className="lab-stage" data-rv-section>
            <div className="lab-intro">
              <h2 className="lab-title" data-rv="type">
                一个字，一个字。
              </h2>

              <p className="lab-block" data-rv="text">
                指针先到，内容后到。它落在左上角按下，向右下拖出一处选框，框的边与角落跟着手长出来。
                框一旦画满，这段文字才一个字一个字被写出来：写到哪里，指针就在哪里；打错字会退回去重写。
              </p>
            </div>
          </div>

          <div className="lab-stage" data-rv-section>
            <div className="lab-cards">
              {cards.map((card) => (
                <div className="lab-card" key={card.label} data-rv="frame">
                  <span className="lab-card-label" data-rv-text>
                    {card.label}
                  </span>
                  <strong data-rv-text>{card.value}</strong>
                  <span className="lab-card-note" data-rv-text>
                    {card.note}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lab-stage" data-rv-section>
            <div className="lab-metric">
              <span
                className="lab-metric-value"
                data-rv="count"
                data-rv-count={measureMs}
              >
                {measureMs}
              </span>
              <span className="lab-metric-unit">
                ms · 量完一个 {SAMPLE.width} × {SAMPLE.height} 的框
              </span>
            </div>
          </div>

          <div className="lab-stage" data-rv-section>
            <div className="lab-chart">
              {stages.map((stage) => (
                <div className="lab-bar" key={stage.label} data-rv="line">
                  <span className="lab-bar-label">{stage.label}</span>
                  <span className="lab-bar-track">
                    <span
                      className="lab-bar-fill"
                      style={{
                        width: `${Math.round((stage.ms / stageMax) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="lab-bar-ms">{stage.ms} ms</span>
                </div>
              ))}
            </div>
          </div>
        </RevealScene>

        <section className="lab-notes">
          {notes.map((note) => (
            <div className="lab-note-item" key={note.title}>
              <strong>{note.title}</strong>
              <span>{note.body}</span>
            </div>
          ))}
        </section>

        <p className="lab-next">
          另一个实验：<Link href="/lab/swarm">光标蜂群</Link>
          ——十几支光标同时抢活，把内容一块块画出来，画完就散。
        </p>
      </div>
    </main>
  );
}
