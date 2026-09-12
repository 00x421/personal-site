// vinext beta.9 的 standalone 打包器把 react 系列捆进了 server bundle，
// 但它原样拷贝的 vinext/dist 运行时文件仍以 peer 依赖方式 import react/react-dom，
// standalone/node_modules 缺这些包时服务启动即 ERR_MODULE_NOT_FOUND。
// 构建后从本地 node_modules 补齐运行时所需的外部包。
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const target = join('dist', 'standalone', 'node_modules');
if (!existsSync(target)) {
  console.log('fix-standalone: dist/standalone 不存在，跳过');
  process.exit(0);
}

const packages = [
  'react',
  'react-dom',
  'react-server-dom-webpack',
  'scheduler',
  'marked',
  'prismjs',
];

for (const pkg of packages) {
  const from = join('node_modules', pkg);
  const to = join(target, pkg);
  if (!existsSync(from)) {
    console.warn(`fix-standalone: ${pkg} 不在本地 node_modules，跳过`);
    continue;
  }
  cpSync(from, to, { recursive: true });
}
console.log(`fix-standalone: 已补齐 ${packages.length} 个运行时依赖到 dist/standalone`);
