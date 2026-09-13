// vinext beta.9 standalone quirk: the packager bundles react INTO the server
// chunk, but the verbatim-copied vinext/dist runtime still imports
// react/react-dom as peer deps -> ERR_MODULE_NOT_FOUND on boot.
// Postbuild: copy the runtime-external packages into dist/standalone.
// Note: fs.cpSync hard-crashes node on this Windows setup (silent exit 127),
// so copies go file-by-file via copyFileSync instead.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

const target = join('dist', 'standalone', 'node_modules');
if (!existsSync(target)) {
  console.log('fix-standalone: dist/standalone missing, skip');
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

let copied = 0;
for (const pkg of packages) {
  const from = join('node_modules', pkg);
  const to = join(target, pkg);
  if (!existsSync(from)) {
    console.warn(`fix-standalone: ${pkg} not in local node_modules, skip`);
    continue;
  }
  copyDir(from, to);
  copied += 1;
}
console.log(`fix-standalone: patched ${copied}/${packages.length} runtime deps into dist/standalone`);
