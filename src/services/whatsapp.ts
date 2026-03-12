import { Client, MessageMedia, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { resolve } from 'path';
import { existsSync, rmSync } from 'fs';
import { execSync } from 'child_process';

// ─── Startup banner ──────────────────────────────────────────────────────────
const startedAt = new Date().toISOString();
console.log(`\n${'─'.repeat(60)}`);
console.log(`🚀 WhatsApp Bot starting — ${startedAt}`);
console.log(`   Platform : ${process.platform} (${process.arch})`);
console.log(`   Node     : ${process.version}`);
console.log(`   PID      : ${process.pid}`);

// ─── Chrome / Puppeteer path resolution ──────────────────────────────────────
const candidatePaths = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean) as string[];

let chromiumExecutablePath: string | undefined;
if (process.platform === 'linux') {
  chromiumExecutablePath = candidatePaths.find(p => existsSync(p));
  if (chromiumExecutablePath) {
    console.log(`   Chrome   : ${chromiumExecutablePath} ✅`);
  } else {
    console.warn(`   Chrome   : ⚠️  none of the candidate paths exist — Puppeteer will use its bundled Chromium`);
    console.warn(`   Tried    : ${candidatePaths.join(', ')}`);
    chromiumExecutablePath = undefined;
  }
} else {
  console.log(`   Chrome   : Puppeteer bundled Chromium (non-Linux)`);
}

const projectRoot = process.cwd();
const configuredDataPath = process.env.WWEBJS_DATA_PATH;
const defaultRepoDataPath = resolve(projectRoot, 'src', 'data');
const dataPath = configuredDataPath
  ? resolve(configuredDataPath)
  : existsSync(defaultRepoDataPath)
    ? defaultRepoDataPath
    : resolve(__dirname, '..', 'data');
const AUTH_TIMEOUT_MS = 120_000;
const PROTOCOL_TIMEOUT_MS = 120_000;
const BROWSER_LAUNCH_TIMEOUT_MS = 120_000;
console.log(`   Project  : ${projectRoot}`);
console.log(`   Auth data: ${dataPath}`);
console.log(`   Auth wait: ${AUTH_TIMEOUT_MS / 1000}s`);
console.log(`   Chrome CDP: ${PROTOCOL_TIMEOUT_MS / 1000}s`);
console.log(`   Chrome boot: ${BROWSER_LAUNCH_TIMEOUT_MS / 1000}s`);
console.log(`${'─'.repeat(60)}\n`);

let startupStage = 'booting';
let startupWatchdog: NodeJS.Timeout | null = null;
let qrGenerationCount = 0;

function setStartupStage(stage: string): void {
  startupStage = stage;
  console.log(`📍 Startup stage: ${stage}`);
}

function startInitializationWatchdog(): void {
  const started = Date.now();
  const tickMs = 10_000;
  const hardTimeoutMs = 120_000;

  startupWatchdog = setInterval(() => {
    const elapsedMs = Date.now() - started;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    // QR stage: waiting for user to scan — no timeout
    if (startupStage === 'qr-generated') {
      console.log(`⏳ Waiting for QR scan... (${elapsedSeconds}s elapsed)`);
      return;
    }

    // Authenticated stage: the ready timeout handler owns this window — don't double-kill
    if (startupStage === 'authenticated') {
      return;
    }

    if (elapsedMs >= hardTimeoutMs) {
      if (startupWatchdog) {
        clearInterval(startupWatchdog);
        startupWatchdog = null;
      }

      console.error(`\n❌ Initialization stalled for ${elapsedSeconds}s at stage: ${startupStage}`);
      console.error('   This means Chrome started, but WhatsApp Web did not progress far enough to emit QR/auth/ready.');
      console.error('   Common causes:');
      console.error('   • Server network cannot reach web.whatsapp.com');
      console.error('   • Chrome launched but is hanging due to low RAM/CPU');
      console.error('   • Corrupt WhatsApp session data under src/data/session-wpp-bot');
      console.error('   • Chrome/Chromium version is incompatible with the installed Puppeteer');
      console.error('   → Exiting so ts-node-dev can restart cleanly.\n');
      process.exit(1);
    }

    console.log(`⏳ Initialization still in progress... (${elapsedSeconds}s elapsed, stage: ${startupStage})`);
  }, tickMs);
}

function stopInitializationWatchdog(): void {
  if (startupWatchdog) {
    clearInterval(startupWatchdog);
    startupWatchdog = null;
  }
}

// ─── Client ──────────────────────────────────────────────────────────────────
const client = new Client({
  authTimeoutMs: AUTH_TIMEOUT_MS,
  authStrategy: new LocalAuth({
    clientId: 'wpp-bot',
    dataPath,
  }),
  // Pin a known-stable WhatsApp Web version so the browser never downloads
  // a new release mid-session (which causes "ready" to never fire).
  webVersion: '2.3000.1023190050-alpha',
  webVersionCache: {
    type: 'local',
    path: resolve(projectRoot, '.wwebjs_cache'),
  },
  puppeteer: {
    headless: true,
    timeout: BROWSER_LAUNCH_TIMEOUT_MS,
    protocolTimeout: PROTOCOL_TIMEOUT_MS,
    ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-features=VizDisplayCompositor',
      // Reduce memory pressure on VPS
      '--js-flags=--max-old-space-size=512',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
    ],
  },
});

// ─── Event handlers ───────────────────────────────────────────────────────────
client.on('qr', async (qr) => {
  qrGenerationCount += 1;
  setStartupStage('qr-generated');

  if (qrGenerationCount > 1) {
    console.log(`\n♻️  QR refreshed (${qrGenerationCount}) because the previous code expired or was not scanned yet.`);
  }

  console.log('\n📲 QR code generated — scan with WhatsApp on your phone:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  setStartupStage('authenticated');
  console.log('✅ WhatsApp authenticated. Waiting for ready event...');

  const READY_TIMEOUT_MS = 180_000;
  const TICK_INTERVAL_MS = 30_000;
  let elapsed = 0;

  const ticker = setInterval(() => {
    elapsed += TICK_INTERVAL_MS;
    if (elapsed <= READY_TIMEOUT_MS) {
      console.log(`⏳ Still waiting for ready... (${elapsed / 1000}s / ${READY_TIMEOUT_MS / 1000}s)`);
      return;
    }

    console.log(`⏳ Still waiting for ready... (${elapsed / 1000}s elapsed)`);
  }, TICK_INTERVAL_MS);

  const readyTimeout = setTimeout(() => {
    console.warn(`\n⚠️ ready event is taking longer than ${READY_TIMEOUT_MS / 1000}s.`);
    console.warn('   Keeping the process alive; large accounts can take several minutes to finish syncing.');
    console.warn('   If this never reaches READY, check VPS RAM/swap and network stability.\n');
  }, READY_TIMEOUT_MS);

  client.once('ready', () => {
    clearTimeout(readyTimeout);
    clearInterval(ticker);
  });
});

client.on('auth_failure', (msg) => {
  setStartupStage('auth-failure');
  console.error(`\n❌ WhatsApp authentication FAILED: ${msg}`);
  console.error('   → Delete src/data/session-wpp-bot/ and restart to re-scan the QR code.\n');
});

client.on('disconnected', (reason) => {
  setStartupStage(`disconnected:${reason}`);
  console.warn(`\n⚠️  WhatsApp disconnected. Reason: ${reason}`);
  console.warn('   ts-node-dev will restart the process automatically.\n');
});

client.on('loading_screen', (percent, message) => {
  setStartupStage(`loading:${percent}%`);
  console.log(`📶 Loading WhatsApp Web: ${percent}% — ${message}`);
});

client.on('change_state', (state) => {
  setStartupStage(`state:${state}`);
  console.log(`🔄 WhatsApp state changed → ${state}`);
});

client.on('remote_session_saved', () => {
  console.log('💾 Remote session saved to disk');
});

client.on('ready', async () => {
  setStartupStage('ready');
  stopInitializationWatchdog();
  const info = client.info;
  console.log('\n' + '─'.repeat(60));
  console.log('🟢 WhatsApp bot is READY!');
  if (info) {
    console.log(`   Logged in as : ${info.pushname} (${info.wid.user})`);
    console.log(`   Platform     : ${info.platform}`);
  }
  console.log('─'.repeat(60) + '\n');
});

// ─── Stale lock cleanup ───────────────────────────────────────────────────────
/**
 * Puppeteer locks the Chrome userDataDir with a SingletonLock file.
 * If the previous process was killed (Ctrl+C, crash, OOM), that lock is left
 * behind and the next launch fails with "The browser is already running".
 * We delete the lock files proactively before each launch so restarts work.
 */
function clearStaleLocks(): void {
  // Clear stale WhatsApp Web version cache — if it's outdated, ready never fires
  const wwebCacheDir = resolve(dataPath, '..', '..', '.wwebjs_cache');
  if (existsSync(wwebCacheDir)) {
    try {
      rmSync(wwebCacheDir, { recursive: true, force: true });
      console.log(`🧹 Cleared stale WWeb cache: ${wwebCacheDir}`);
    } catch (e) {
      console.warn(`⚠️  Could not clear WWeb cache:`, e);
    }
  }

  const sessionDir = resolve(dataPath, 'session-wpp-bot');
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];

  for (const lockFile of lockFiles) {
    const lockPath = resolve(sessionDir, lockFile);
    if (existsSync(lockPath)) {
      try {
        rmSync(lockPath, { force: true });
        console.log(`🧹 Removed stale lock: ${lockPath}`);
      } catch (e) {
        console.warn(`⚠️  Could not remove lock file ${lockPath}:`, e);
      }
    }
  }

  // On Linux, also kill any orphaned chrome processes that still hold the dir
  if (process.platform === 'linux') {
    try {
      execSync(`pkill -f "user-data-dir=${sessionDir}" 2>/dev/null || true`);
    } catch {
      // pkill exits non-zero if no processes matched — that is fine
    }
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n⚠️  Received ${signal} — shutting down gracefully...`);
  stopInitializationWatchdog();

  // Give client.destroy() up to 15 seconds, then force-exit so systemd
  // never needs to resort to SIGKILL (which leaves stale Chrome lock files).
  const forceExit = setTimeout(() => {
    console.warn('⏱️  client.destroy() timed out — forcing exit');
    process.exit(0);
  }, 15_000);
  forceExit.unref(); // don't let this timer keep the event-loop alive

  try {
    await client.destroy();
    console.log('✅ WhatsApp client destroyed cleanly');
  } catch (e) {
    console.error('⚠️  Error during client.destroy():', e);
  }

  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', () => { gracefulShutdown('SIGTERM').catch(() => process.exit(1)); });
process.on('SIGINT',  () => { gracefulShutdown('SIGINT').catch(() => process.exit(1)); });

// ─── Process-level error guards ───────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('\n💥 Uncaught Exception:');
  console.error(err);
});

process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);

  if (msg.includes('browser is already running')) {
    console.error('\n⚠️  Stale Chrome lock detected. Cleaning up and retrying in 3s...');
    console.error('   (This happens when the previous process was killed uncleanly)\n');
    clearStaleLocks();
    setTimeout(() => {
      console.log('🔄 Retrying client.initialize()...');
      client.initialize().catch((e: Error) => {
        console.error('❌ Retry also failed:', e.message);
        console.error('   → Try manually running: pkill chrome  then  npm run dev');
        process.exit(1);
      });
    }, 3000);
    return;
  }

  // whatsapp-web.js internally tries to read the body of CORS preflight (OPTIONS)
  // requests which have no body. This is harmless and can be safely ignored.
  if (msg.includes('Could not load response body') || msg.includes('preflight request')) {
    return;
  }

  console.error('\n💥 Unhandled Promise Rejection:');
  console.error(reason);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
clearStaleLocks();
setStartupStage('initializing-client');
startInitializationWatchdog();
console.log('🔌 Initializing WhatsApp client (launching browser)...');
client.initialize()
  .then(() => {
    console.log('✅ client.initialize() resolved (browser launched and WhatsApp page loaded)');
  })
  .catch((error: Error) => {
    stopInitializationWatchdog();
    console.error('\n❌ client.initialize() failed:');
    console.error(error);

    const errorMessage = error?.message ?? String(error);
    if (errorMessage.includes('Timed out after waiting 30000ms') || errorMessage.includes('auth timeout')) {
      console.error('\n   The 30s failure came from Puppeteer browser startup, not the WhatsApp auth timeout.');
      console.error(`   Browser launch timeout is now ${BROWSER_LAUNCH_TIMEOUT_MS / 1000}s and auth timeout is ${AUTH_TIMEOUT_MS / 1000}s.`);
      console.error('   If it still fails after that, the likely cause is low server resources, Chrome startup problems, or corrupt session data.');
    }

    process.exit(1);
  });

export { client, MessageMedia };
