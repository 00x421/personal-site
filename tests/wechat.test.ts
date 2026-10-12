import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  parseCallbackXml,
  textReplyXml,
  verifyWechatSignature,
} from '../lib/wechat.ts';
import { markdownToWechatHtml } from '../lib/wechat-html.ts';

describe('verifyWechatSignature', () => {
  it('正确签名通过（sha1 后按字典序拼三参）', () => {
    const signature = createHash('sha1')
      .update(['tok', 'nonce', '1234567890'].sort().join(''))
      .digest('hex');
    assert.ok(
      verifyWechatSignature('tok', signature, '1234567890', 'nonce'),
    );
  });

  it('错签名不通过', () => {
    assert.equal(verifyWechatSignature('tok', 'bad', '1', 'n'), false);
  });

  it('缺任一参数即不通过', () => {
    assert.equal(verifyWechatSignature('', 'sig', '1', 'n'), false);
    assert.equal(verifyWechatSignature('tok', '', '1', 'n'), false);
  });
});

describe('parseCallbackXml', () => {
  it('CDATA 形态解析', () => {
    const msg = parseCallbackXml(
      '<xml><ToUserName><![CDATA[gh_1]]></ToUserName>' +
        '<FromUserName><![CDATA[oUser]]></FromUserName>' +
        '<MsgType><![CDATA[text]]></MsgType>' +
        '<Content><![CDATA[搜 字体]]></Content>' +
        '<MsgId>123</MsgId></xml>',
    );
    assert.equal(msg?.fromUser, 'oUser');
    assert.equal(msg?.toUser, 'gh_1');
    assert.equal(msg?.msgType, 'text');
    assert.equal(msg?.content, '搜 字体');
    assert.equal(msg?.msgId, '123');
  });

  it('裸文本形态解析（事件消息的 Event 字段）', () => {
    const msg = parseCallbackXml(
      '<xml><MsgType>event</MsgType><Event>subscribe</Event></xml>',
    );
    assert.equal(msg?.msgType, 'event');
    assert.equal(msg?.event, 'subscribe');
  });

  it('非微信 XML 返回 null', () => {
    assert.equal(parseCallbackXml('<html></html>'), null);
  });
});

describe('textReplyXml', () => {
  it('收发件人对调（回复给发件人）', () => {
    const xml = textReplyXml('oUser', 'gh_1', '留言已收到');
    assert.ok(xml.includes('<ToUserName><![CDATA[oUser]]></ToUserName>'));
    assert.ok(xml.includes('<FromUserName><![CDATA[gh_1]]></FromUserName>'));
    assert.ok(xml.includes('留言已收到'));
    assert.ok(xml.includes('<CreateTime>'));
  });
});

describe('markdownToWechatHtml', () => {
  it('标题/正文/引用/代码块全部内联样式，无 class', () => {
    const html = markdownToWechatHtml(
      '## 小节\n\n一段正文。\n\n> 引用一句\n\n```js\nconst a = 1;\n```\n\n[链接](https://xwsx.top)',
    );
    assert.ok(html.includes('<h2 style='));
    assert.ok(html.includes('<p style='));
    assert.ok(html.includes('border-left:3px solid #b23b2e'));
    assert.ok(html.includes('background:#282c34'));
    assert.ok(html.includes('href="https://xwsx.top"'));
    assert.ok(!html.includes('class='));
  });

  it('中英紧排也算正文渲染（不做文案检查，那是 prose 门禁的活）', () => {
    assert.ok(markdownToWechatHtml('读完4篇').includes('读完4篇'));
  });
});
