#!/usr/bin/env node
/**
 * 跨平台清理构建产物目录（默认 dist，可传参数指定其他目录）。
 *
 * 为什么不用 fs.rmSync：本机 Windows + 含非 ASCII 的路径（…\牛马工作区\site）
 * 下，Node 的递归删除会 **静默失败** —— 报 errno 0「操作成功完成」但目录纹丝不动。
 * 残留的 dist/standalone/dist/client/.assetsignore 会让 vinext 的 standalone 产出
 * 阶段在 cpSync 覆盖旧文件时 unlink 报错，构建中断。
 * 手动 readdir + unlink/rmdir 不走 `\\?\` 长路径分支，实测稳定。
 *
 * 用法：node scripts/clean-dist.mjs [dir...]
 */
import { readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

function removeTree(target) {
  let entries;
  try {
    entries = readdirSync(target, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  for (const entry of entries) {
    const full = join(target, entry.name);
    // 符号链接按文件处理，避免误入被链接的目录
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      removeTree(full);
    } else {
      unlinkSync(full);
    }
  }
  rmdirSync(target);
  return true;
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) dirs.push('dist');

let failed = false;
for (const dir of dirs) {
  try {
    console.log(`clean: ${dir} ${removeTree(dir) ? 'removed' : 'not present'}`);
  } catch (error) {
    // 文件被占用等瞬时错误：退避后重试一次（Windows 上杀软/索引器常短暂持锁）
    try {
      removeTree(dir);
      console.log(`clean: ${dir} removed (retry)`);
    } catch {
      console.error(`clean: ${dir} FAILED — ${error.message}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
