// Copy the runtime proxy into src-tauri/resources/proxy before bundling.
//
// Tauri's resource paths are relative to src-tauri, so the build mirrors only
// what the proxy needs at runtime — never state, tests, or demo scripts.
// Node is already required for the Tauri CLI, which keeps this hook
// cross-platform (no `py` vs `python3` guessing).
//
//   node scripts/bundle_proxy.mjs

import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const src = path.join(repo, 'proxy');
const dst = path.resolve(here, '..', 'src-tauri', 'resources', 'proxy');
const binSrc = path.join(repo, 'bin');
const binDst = path.resolve(here, '..', 'src-tauri', 'resources', 'bin');

const INCLUDE_DIRS = ['ccp', 'static'];
const INCLUDE_FILES = ['proxy.py', 'ccp_launch.py', 'README.md'];
// The `ccp` launcher + its PATH helper. Installed next to the proxy so
// `ccp` finds `../proxy/ccp_launch.py` in both a checkout and an install.
const BIN_FILES = ['ccp.cmd', 'ccp', 'ccp-install-path.cmd'];

const has = async (p) => {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
};

if (!(await has(src))) {
  console.error(`bundle_proxy: missing proxy dir: ${src}`);
  process.exit(1);
}

await rm(dst, { recursive: true, force: true });
await mkdir(dst, { recursive: true });

for (const name of INCLUDE_FILES) {
  const from = path.join(src, name);
  if (existsSync(from)) {
    await cp(from, path.join(dst, name));
  }
}

for (const name of INCLUDE_DIRS) {
  const from = path.join(src, name);
  if (!(await has(from))) continue;
  await cp(from, path.join(dst, name), {
    recursive: true,
    filter: (p) => !/__pycache__|\.pyc$|\.tmp$/.test(p),
  });
}

// Launcher scripts. ccp_launch.py went with the proxy above; these are the
// thin PATH-facing wrappers plus the installer's PATH helper.
if (existsSync(binSrc)) {
  await mkdir(binDst, { recursive: true });
  for (const name of BIN_FILES) {
    const from = path.join(binSrc, name);
    if (existsSync(from)) {
      await cp(from, path.join(binDst, name));
    }
  }
}

if (!existsSync(path.join(dst, 'static', 'index.html'))) {
  console.warn(
    'bundle_proxy: warning — proxy/static/index.html is missing; ' +
    'run `npm run build` in web/ first.',
  );
}

console.log(`bundle_proxy: ${src} -> ${dst}`);
