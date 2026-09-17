#!/usr/bin/env node
/**
 * 一键部署到腾讯云自托管服务器（vinext standalone）。
 *
 * 流程：本地构建（内联 NEXT_PUBLIC_SITE_URL）→ 打包 dist/standalone → scp 上传
 *      → 远端备份旧产物、解包、重启 systemd → 健康检查（失败自动回滚）。
 *
 * 用法：npm run deploy
 * 可用环境变量覆盖：DEPLOY_HOST / DEPLOY_USER / DEPLOY_KEY / NEXT_PUBLIC_SITE_URL
 *                  DEPLOY_REMOTE_DIR / DEPLOY_SERVICE
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const HOST = process.env.DEPLOY_HOST ?? '43.139.214.236';
const USER = process.env.DEPLOY_USER ?? 'xwsx';
const KEY =
  process.env.DEPLOY_KEY ?? path.join(homedir(), '.ssh', 'id_ed25519');
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://xwsx.top';
const REMOTE_DIR = process.env.DEPLOY_REMOTE_DIR ?? '/home/xwsx/xwsx-site';
const SERVICE = process.env.DEPLOY_SERVICE ?? 'xwsx';
const LOCAL_TARBALL = path.resolve('xwsx-standalone.tar.gz');
const REMOTE_TARBALL = `~/xwsx-standalone.tar.gz`;

const TARGET = `${USER}@${HOST}`;
const SSH_OPTS = [
  '-i',
  KEY,
  '-o',
  'BatchMode=yes',
  '-o',
  'ConnectTimeout=15',
];

function log(step, message) {
  console.log(`\n[${step}] ${message}`);
}

/** 跑一个可执行文件（tar / scp / git 等真实二进制）。 */
function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
}

/**
 * 跑一条 shell 命令。Windows 下 npm 是 .cmd，Node 20+ 拒绝直接 spawn .cmd
 * （EINVAL），必须经 shell 解析；这里传单条命令字符串而不是参数数组，
 * 因此不会触发 DEP0190（那条警告只针对 shell + args 的组合）。
 */
function sh(command, options = {}) {
  return execSync(command, { stdio: 'inherit', ...options });
}

/** 远端执行一段 shell 脚本（stdout 回传，失败抛错）。 */
function remote(script, { capture = true } = {}) {
  return execFileSync('ssh', [...SSH_OPTS, TARGET, script], {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

// ---- 0. 前置检查 ----------------------------------------------------------
log('0/5', '检查本地环境与远端连通性');
if (!existsSync(KEY)) fail(`找不到 SSH 密钥：${KEY}`);
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
  console.warn('  ⚠ 工作区有未提交改动，部署内容会包含它们');
}
const remoteInfo = remote(
  'hostname; systemctl is-active ' + SERVICE + '; node -v',
);
console.log(
  `  远端：${remoteInfo.trim().split('\n').join(' | ')}`,
);

// ---- 1. 构建 --------------------------------------------------------------
log('1/5', `构建生产产物（NEXT_PUBLIC_SITE_URL=${SITE_URL}）`);
sh('npm run build', {
  env: { ...process.env, NEXT_PUBLIC_SITE_URL: SITE_URL },
});

if (!existsSync(path.join('dist', 'standalone', 'server.js'))) {
  fail('构建产物缺少 dist/standalone/server.js，构建可能未完成');
}

// ---- 2. 打包 --------------------------------------------------------------
log('2/5', '打包 dist/standalone');
if (existsSync(LOCAL_TARBALL)) rmSync(LOCAL_TARBALL, { force: true });
run('tar', ['-czf', 'xwsx-standalone.tar.gz', '-C', 'dist', 'standalone']);
const sizeMB = (statSync(LOCAL_TARBALL).size / 1024 / 1024).toFixed(1);
console.log(`  已生成 ${path.basename(LOCAL_TARBALL)}（${sizeMB} MB）`);

// ---- 3. 上传 --------------------------------------------------------------
log('3/5', '上传到服务器');
run('scp', [...SSH_OPTS, LOCAL_TARBALL, `${TARGET}:${REMOTE_TARBALL}`]);

// ---- 4. 远端切换 + 健康检查（失败自动回滚）--------------------------------
log('4/5', '远端解包、重启服务并健康检查');
const remoteScript = `
set -u
cd ${REMOTE_DIR} || exit 1
sudo systemctl stop ${SERVICE} || exit 1
rm -rf standalone.bak
if [ -d standalone ]; then mv standalone standalone.bak; fi
if ! tar -xzf ${REMOTE_TARBALL} -C ${REMOTE_DIR}; then
  echo 'TAR_FAILED'
  [ -d standalone.bak ] && mv standalone.bak standalone
  sudo systemctl start ${SERVICE}
  exit 1
fi
sudo systemctl start ${SERVICE} || exit 1

for i in $(seq 1 15); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/; then
    echo HEALTH_OK
    exit 0
  fi
  sleep 1
done

echo HEALTH_FAILED_ROLLING_BACK
sudo systemctl stop ${SERVICE}
rm -rf standalone
[ -d standalone.bak ] && mv standalone.bak standalone
sudo systemctl start ${SERVICE}
exit 1
`;
const remoteOut = remote(remoteScript);
console.log('  ' + remoteOut.trim().split('\n').join('\n  '));

// ---- 5. 线上验证 ----------------------------------------------------------
log('5/5', '线上验证');
const publicCheck = remote(`
echo -n 'home: '; curl -s -o /dev/null -w '%{http_code}\\n' https://xwsx.top/
echo -n 'articles: '; curl -s -o /dev/null -w '%{http_code}\\n' https://xwsx.top/articles
echo -n 'rss: '; curl -s -o /dev/null -w '%{http_code}\\n' https://xwsx.top/rss.xml
echo -n 'search: '; curl -s -o /dev/null -w '%{http_code}\\n' https://xwsx.top/search.json
`);
console.log('  ' + publicCheck.trim().split('\n').join('\n  '));

if (remoteOut.includes('HEALTH_FAILED_ROLLING_BACK')) {
  fail('新版本健康检查失败，已自动回滚到上一版本');
}

console.log('\n✓ 部署完成：' + SITE_URL);
console.log('  回滚（如需）：ssh ' + TARGET + ' 后执行');
console.log(
  `    sudo systemctl stop ${SERVICE} && rm -rf ${REMOTE_DIR}/standalone && mv ${REMOTE_DIR}/standalone.bak ${REMOTE_DIR}/standalone && sudo systemctl start ${SERVICE}`,
);
