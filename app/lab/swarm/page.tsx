import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RevealScene } from '@/components/site/reveal-scene';

export const metadata: Metadata = {
  title: '光标蜂群 — 实验',
  description:
    '十几支光标同时进来抢活，把这一页的内容一块块画出来：量框、写字、滚数字、扫图表，画完就散场。',
  alternates: { canonical: '/lab/swarm' },
  // 实验页不进索引：它演示的是一套机制，页面本身没有可被搜到的信息。
  robots: { index: false, follow: false },
};

/** 三张卡片：说的就是这群手在干的三种活。 */
const cards = [
  { label: 'CROSS / 量', value: '按住', note: '左上角落点，拖到右下角' },
  { label: 'IBEAM / 写', value: '逐字', note: '写到哪里，笔尖就在哪里' },
  { label: 'LINE / 扫', value: '逐行', note: '笔扫过去，条形跟着长' },
];

/** 四个行时：一次量框、一次换手、一次写字、一次离场。 */
const bars = [
  { label: '量框', ms: 543 },
  { label: '换手', ms: 180 },
  { label: '写字', ms: 620 },
  { label: '离场', ms: 320 },
];
const barMax = Math.max(...bars.map((bar) => bar.ms));

/** 这一组是「已经在页面上」的内容：先压暗，等手扫过来才亮（data-highlight）。 */
const lit = [
  { label: 'PEN', value: '5 种', note: 'arrow / cross / ibeam / resize / pen' },
  { label: 'HANDS', value: '4–18 支', note: '按视口面积给，蜂群模式上限更高' },
  { label: 'TYPE', value: '48ms', note: '标题用 clip-path 擦着长出来' },
];

const notes = [
  {
    title: '一块内容，一支手',
    body: '一节之内的块是并行派工的：三张卡片就是三支手同时飞进来画框，框里的文字等自己的框封口后 80ms 开写。没有「排队等上一块画完」这一步——不然十几支手里永远只有一两支在动，那就不叫蜂群了。',
  },
  {
    title: '内容不用手写标记',
    body: '这一页大部分文字没有加任何属性：采集器自己扫出「没有子元素、有可见文字」的叶子节点，逐块派工。要跳过某棵子树（比如图标按钮、代码块），给它加 data-instant 即可——里面的东西立刻出现，不逐字、也不派手。',
  },
  {
    title: '已经存在的内容靠「扫亮」',
    body: '下面那三张卡片一开始就是暗的：开演时给它们加上 rv-unlit，然后一支手从左边扫到右边，扫到哪块哪块就恢复。这处理的是「页面上本来就有的东西」——不是被写出来的，而是被点亮的。',
  },
  {
    title: '量出来的框是真尺寸',
    body: '选框的宽高与徽章读数来自同一个取整后的尺寸；文字框更是按 Range 实测的范围画——写着写着行数变多，框就跟着长。这类效果的全部信用都在这一点上。',
  },
  {
    title: '画完就散场',
    body: '一支手闲 600ms 就朝最近的屏幕边飞走并销毁。一节的作业结束时，页面上不留任何装饰元素，只剩被画出来的内容本身；滚动离开这一节，正在画的手也会立刻取消作业离场。',
  },
];

export default function SwarmPage() {
  return (
    <main className="article-page">
      <div className="article-shell">
        <Link href="/lab" className="back-link">
          <ArrowLeft size={15} /> 返回 /lab
        </Link>

        <header className="lab-head">
          <span className="section-index">LAB / 02</span>
          <h1>
            内容，<em>画</em>出来。
          </h1>
          <p className="lab-lede">
            十几支光标同时进来抢活：一支去量标题，两支同时在写字，一支把数字滚上去，剩下的等自己那块。
            全都画完，它们就散了——页面上只留下内容本身。
          </p>
        </header>

        <RevealScene className="lab-scene" swarm replayable>
          <div className="lab-stage" data-rv-section>
            <div className="lab-intro">
              <h2 className="lab-title" data-rv="type">
                一群手，一起画。
              </h2>
              <p className="lab-block" data-rv="text">
                每块内容先被量一遍：光标落到左上角按住，向右下拖出选框，徽章跟着边长边报数。
                框一画满，文字才开始一个字一个字被写出来——写到哪里，笔尖就在哪里。
              </p>
            </div>
          </div>

          <div className="lab-stage" data-rv-section>
            <div className="lab-cards">
              {cards.map((card) => (
                <div className="lab-card" key={card.label} data-rv="frame">
                  <span className="lab-card-label">{card.label}</span>
                  <strong>{card.value}</strong>
                  <span className="lab-card-note">{card.note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lab-stage" data-rv-section>
            <div className="lab-cards" data-instant>
              {lit.map((item) => (
                <div className="lab-card" key={item.label} data-rv="highlight">
                  <span className="lab-card-label">{item.label}</span>
                  <strong>{item.value}</strong>
                  <span className="lab-card-note">{item.note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lab-stage" data-rv-section>
            <div className="lab-metric">
              <span
                className="lab-metric-value"
                data-rv="count"
                data-rv-count={18}
              >
                18
              </span>
              <span className="lab-metric-unit">支手 · 同时在场的手数上限</span>
            </div>
          </div>

          <div className="lab-stage" data-rv-section>
            <div className="lab-chart">
              {bars.map((bar) => (
                <div className="lab-bar" key={bar.label} data-rv="line">
                  <span className="lab-bar-label">{bar.label}</span>
                  <span className="lab-bar-track">
                    <span
                      className="lab-bar-fill"
                      style={{
                        width: `${Math.round((bar.ms / barMax) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="lab-bar-ms">{bar.ms} ms</span>
                </div>
              ))}
            </div>
          </div>
        </RevealScene>

        <section className="sw-notes">
          {notes.map((note) => (
            <div className="sw-note" key={note.title}>
              <strong>{note.title}</strong>
              <span>{note.body}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
