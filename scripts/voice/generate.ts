/**
 * `npm run voice` — keeps voice/LINES.json in sync with content, then renders
 * missing or changed clips with Kokoro-82M (scripts/voice/kokoro_generate.py).
 *
 * Flags:
 *   --force        regenerate every clip
 *   --lang <code>  only this language (repeatable)
 *   --sync-only    update LINES.json and stop
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_WORDS } from '../../src/learning/words';
import { mergeLines, scanContent, wordLines, type LinesDoc } from './sync';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const linesPath = join(root, 'voice', 'LINES.json');
const venv = join(here, '.venv');
const python = join(venv, 'bin', 'python');
const requirements = join(here, 'requirements.txt');
const stamp = join(venv, '.requirements-hash');

function log(msg: string): void {
  process.stdout.write(`[voice] ${msg}\n`);
}

function findUv(): string {
  const candidates = ['uv', join(homedir(), '.local', 'bin', 'uv'), join(homedir(), '.cargo', 'bin', 'uv')];
  for (const c of candidates) {
    if (spawnSync(c, ['--version'], { stdio: 'ignore' }).status === 0) return c;
  }
  throw new Error('uv is required for voice generation: https://docs.astral.sh/uv/');
}

function run(cmd: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env): void {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, env });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status ?? r.signal})`);
}

function sync(): void {
  const doc = JSON.parse(readFileSync(linesPath, 'utf8')) as LinesDoc;
  const wanted = [...wordLines(BUILTIN_WORDS), ...scanContent(root)];
  const { doc: next, added } = mergeLines(doc, wanted);
  if (added.length) {
    writeFileSync(linesPath, `${JSON.stringify(next, null, 2)}\n`);
    log(`added ${added.length} line(s): ${added.slice(0, 12).join(', ')}${added.length > 12 ? ', …' : ''}`);
  } else {
    log('LINES.json already in sync');
  }
}

function ensureVenv(uv: string): void {
  const hash = createHash('sha256').update(readFileSync(requirements)).digest('hex');
  if (existsSync(python) && existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === hash) return;
  log('preparing Python environment (first run downloads PyTorch and Kokoro)…');
  if (!existsSync(python)) run(uv, ['venv', venv, '--python', '3.12', '--quiet']);
  run(uv, ['pip', 'install', '--quiet', '--python', python, '-r', requirements]);
  writeFileSync(stamp, `${hash}\n`);
}

function main(): void {
  const args = process.argv.slice(2);
  sync();
  if (args.includes('--sync-only')) return;
  const uv = findUv();
  ensureVenv(uv);
  const pyArgs = ['-I', join(here, 'kokoro_generate.py'), '--root', root];
  if (args.includes('--force')) pyArgs.push('--force');
  args.forEach((a, i) => {
    const next = args[i + 1];
    if (a === '--lang' && next) pyArgs.push('--lang', next);
  });
  run(python, pyArgs, { ...process.env, HF_HOME: process.env.HF_HOME ?? join(here, '.cache', 'hf'), PYTHONWARNINGS: 'ignore' });
}

try {
  main();
} catch (error) {
  process.stderr.write(`[voice] ${(error as Error).message}\n`);
  process.exit(1);
}
