---
title: Node 说「操作成功完成」，却一个文件都没删
description: 在带中文的路径下，fs.rmSync 的递归删除会静默失效——不抛错、errno 是 0、目录纹丝不动。这是一次构建中断的完整排查，最后收缩到只有一个变量的对照实验。
published: 2026-09-17
tags: [工程实践, 调试, Node.js]
series: 工程手记
---

## 一个删不掉的目录

给这个站写一键部署脚本，第一次跑就断在构建阶段。报错来自 vinext 产出 standalone 包的时候：

```
Error: , The operation completed successfully.
'\\?\D:\vibe coding\牛马工作区\site\dist\standalone\dist\client\.assetsignore'
    errno: 0,
    code: '',
    syscall: 'unlink'
    at emitStandaloneOutput (node_modules/vinext/dist/build/standalone.js:160:5)
```

这段信息自相矛盾。它说 `The operation completed successfully`（操作成功完成），但它确实在报错；`errno` 是 `0`；`code` 是空字符串。它想删的是一个上一轮构建残留的 `.assetsignore`，路径前缀里的 `\\?\` 是 Windows 的超长路径 API 写法。

按项目里之前的笔记，这属于「Windows 构建怪癖」，惯例对策是构建前先清空 `dist` 目录。但问题恰恰在这里——`dist` 已经清过了，清完它还在。

## 清理那一步真的跑了吗

构建脚本的第一行就是清理：

```json
"build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && vinext build"
```

`rmSync` 带上 `recursive: true` 和 `force: true`，语义上等价于 `rm -rf`。我把它单独跑了一遍：

```bash
node -e "require('fs').rmSync('dist',{recursive:true,force:true})"
# 没有任何输出，没有抛异常
```

既然没有抛异常，那目录应该没了。但紧接着检查：

```bash
Test-Path dist
# True
```

目录还在。列一下里面剩什么：

```
dist/client/.assetsignore
dist/standalone/dist/client/.assetsignore
```

其他几千个文件都删掉了，只剩这两个。`force: true` 的作用是「文件不存在时不要报错」，代价是它也一并吞掉了真正的删除失败——所以这次失败是完全静默的：没有异常、没有 stderr、没有非零退出码，只留下一个还在的目录和一个照常往下走的构建流程。

到这里可以确定两件事：`rmSync` 在删到这两个文件时放弃了；放弃的时候它一声不吭。

## 先试最省事的办法

第一反应是加把劲：给它重试次数。

```bash
node -e "fs.rmSync('dist',{recursive:true,force:true,maxRetries:10,retryDelay:150})"
# dist exists after rm: true
```

没用。`maxRetries` 针对的是 Windows 上文件被短暂占用（杀软扫描、索引器）的场景，而这里不是占用问题。

第二个办法是手工删。写了个脚本自己遍历目录树，逐个 `unlinkSync` 文件、再 `rmdirSync` 目录：

```
deleted ok: 4164
failures: 0
```

**4164 个文件，零失败。**

同一个目录，同样的权限，同样的进程。`rmSync` 一个都删不掉，手写遍历全删干净了。这说明障碍不在文件系统层面，而在 `rmSync` 自己的实现路径上。

## 把变量收缩到一个字符

到这一步还只是现象。我想知道触发条件是什么，于是做了一个最小复现：

```js
const fs = require('fs');
fs.mkdirSync('dist/a/b', { recursive: true });
fs.writeFileSync('dist/a/b/x.txt', '1');

let threw = null;
try {
  fs.rmSync('dist', { recursive: true, force: true });
} catch (error) {
  threw = error.code;
}

console.log('threw:', threw);              // null
console.log('still exists:', fs.existsSync('dist'));  // true
```

两行代码的目录结构，`rmSync` 依然静默失败。复现稳定，但还看不出跟什么有关。唯一可疑的地方是项目路径：`D:\vibe coding\牛马工作区\site`。

我把同样的代码放进系统临时目录跑（`%TEMP%` 是纯 ASCII 路径）：

```
path = C:\Users\LINLIN~1\AppData\Local\Temp\rmtest-ascii
threw = null   stillExists = false
```

删掉了。

为了排除「临时目录和项目目录有别的差异」，我把两个测试放进**同一个父目录**，只让子目录名不同：

```js
const os = require('os');
const path = require('path');

for (const name of ['rmtest-cn-中文', 'rmtest-plain2']) {
  const dir = path.join(os.tmpdir(), name);
  fs.mkdirSync(path.join(dir, 'a'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'a', 'x.txt'), '1');

  let threw = null;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    threw = error.code;
  }

  console.log(name, '-> threw=' + threw, 'stillExists=' + fs.existsSync(dir));
}
```

结果：

```
"rmtest-cn-中文" -> threw=null  stillExists=true
"rmtest-plain2"  -> threw=null  stillExists=false
```

同一个父目录、同样的深度、同样的文件结构，唯一差异是目录名里有没有中文。

顺带一提，这个测试还暴露了一个细节：失败的那个目录，连清都清不掉——`rmSync` 删不动它，只能换 PowerShell 的 `Remove-Item` 收场。

## 所以发生了什么

把现象拼起来：`rmSync` 的递归删除在**路径含非 ASCII 字符**时会在某个环节静默放弃。它没有把失败当作失败——不抛异常，也不影响 `force` 之外的任何可见状态，调用方只能看到一个还在的目录。

报错信息里那个 `\\?\` 前缀是个线索：Node 在 Windows 上处理长路径时会走扩展长度路径 API，这条路对字节编码的处理和普通路径不同。我没有去读 Node 的源码确认具体在哪一行丢掉错误，所以这里只当作一个**有实验支撑的观察**，不是结论——证据是那个对照实验，不是我对内部实现的理解。

值得一提的是这个问题对 `rmSync` 和 `rm -rf` 的关系做了个反讽：在带中文的 Windows 路径下，`rmSync(dir, { recursive: true, force: true })` 既不安全也不可靠，而它还正是被推荐用来替代 `rm -rf` 的那个 API。

## 绕开它

既然问题出在 `rmSync` 的实现路径，那就别用它。写一个自己的清理脚本，逐个删：

```js
import { readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

function removeTree(target) {
  let entries;
  try {
    entries = readdirSync(target, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return false;   // 本来就不存在，不算失败
    throw error;
  }

  for (const entry of entries) {
    const full = join(target, entry.name);
    // 符号链接按文件处理，避免顺着链接删到目录外面去
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      removeTree(full);
    } else {
      unlinkSync(full);
    }
  }

  rmdirSync(target);
  return true;
}
```

这个版本在一次真实构建里删掉了 4164 个文件，零失败。把它挂到构建脚本前面：

```json
"build": "node scripts/clean-dist.mjs && vinext build"
```

构建恢复正常。

## 留下来的一课

这个 bug 的代价不是那几分钟排查，而是它**伪装成了另一个问题**。项目笔记里把它记成了「Windows 构建怪癖，删不掉 `.assetsignore`」，对策是「构建前先 `rm -rf`」——而真正的原因是清理步骤自己就没生效。一个静默失败的 API 会污染它上面所有的诊断，因为你会一直相信那一步已经跑过了。

所以真正起作用的是那个把变量收缩到一个字符的实验。在它能给出「同一个父目录，只有名字不同、行为不同」之前，我对原因的猜测都只是猜测——包括我一度很确信的「文件被占用了」。

至于防御措施：`force: true` 这种「别报错」的开关，用的时候最好想清楚它会不会顺手把「失败」也一起静音掉。
