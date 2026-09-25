import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 60_000;

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    result[key] = value;
    i += 1;
  }
  return result;
}

function required(args, key) {
  const value = String(args[key] ?? '').trim();
  if (!value) throw new Error(`--${key} is required.`);
  return value;
}

function sanitizeFilePart(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'capture';
}

function inferSourceEnvironment(targetUrl) {
  const hostname = new URL(targetUrl).hostname;
  if (hostname === 'life-plan-auth-staging.kazuki-takemori-sub.workers.dev') return 'content-staging';
  if (hostname === 'life-plan.kazuki-takemori-sub.workers.dev') return 'production';
  if (/^pr-\d+-life-plan\./.test(hostname)) return 'pr-preview';
  return hostname;
}

function resolveChrome(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && existsSync(candidate)) return candidate;
    if (!path.isAbsolute(candidate)) {
      const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [candidate], { encoding: 'utf8' });
      if (probe.status === 0) return probe.stdout.split(/\r?\n/).find(Boolean)?.trim();
    }
  }
  throw new Error('Chrome/Chromium executable was not found. Use --chrome-path or CHROME_BIN.');
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for Chrome DevTools endpoint: ${lastError ?? 'unknown error'}`);
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const onOpen = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error('Could not connect to Chrome DevTools WebSocket.')); };
      const cleanup = () => {
        this.socket.removeEventListener('open', onOpen);
        this.socket.removeEventListener('error', onError);
      };
      this.socket.addEventListener('open', onOpen);
      this.socket.addEventListener('error', onError);
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      else pending.resolve(message.result ?? {});
    });
  }

  command(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed.');
  return result.result?.value;
}

async function waitForCaptureReady(client, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastState = null;
  while (Date.now() < deadline) {
    try {
      const state = await evaluate(client, `(() => {
        const root = document.documentElement;
        return {
          status: root?.dataset?.contentCaptureStatus ?? null,
          error: root?.dataset?.contentCaptureError ?? null,
          manifest: root?.dataset?.contentCaptureManifest ?? null,
          href: location.href,
        };
      })()`);
      lastState = state;
      if (state?.status === 'ready') return state;
      if (state?.status === 'error') {
        const error = new Error(state.error || 'Capture page reported an error.');
        error.capturePageError = true;
        throw error;
      }
    } catch (error) {
      if (error?.capturePageError) throw error;
      lastState = { error: error instanceof Error ? error.message : String(error) };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for data-content-capture-status="ready": ${JSON.stringify(lastState)}`);
}

async function openTarget(port, targetUrl, timeoutMs) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetUrl)}`;
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint, { method: 'PUT' });
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Could not create Chrome target: ${lastError ?? 'unknown error'}`);
}

function buildTargetUrl(baseUrl, modelCaseId, captureSpecId) {
  const url = new URL(baseUrl);
  url.searchParams.set('modelCaseId', modelCaseId);
  url.searchParams.set('captureSpecId', captureSpecId);
  return url.toString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = required(args, 'base-url');
  const modelCaseId = required(args, 'model-case-id');
  const captureSpecId = required(args, 'capture-spec-id');
  const outputDir = path.resolve(args['output-dir'] ?? 'artifacts/content-captures');
  const timeoutMs = Number(args['timeout-ms'] ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 5_000) throw new Error('--timeout-ms must be at least 5000.');

  const targetUrl = buildTargetUrl(baseUrl, modelCaseId, captureSpecId);
  const chromePath = resolveChrome(args['chrome-path']);
  const port = await getFreePort();
  const temporaryProfile = !args['user-data-dir'];
  const userDataDir = args['user-data-dir']
    ? path.resolve(args['user-data-dir'])
    : mkdtempSync(path.join(tmpdir(), 'life-plan-capture-'));
  mkdirSync(userDataDir, { recursive: true });

  const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];
  if (process.platform !== 'win32') chromeArgs.unshift('--no-sandbox');

  const chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeStderr = '';
  chrome.stderr.setEncoding('utf8');
  chrome.stderr.on('data', (chunk) => { chromeStderr = `${chromeStderr}${chunk}`.slice(-8_000); });

  let client;
  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`, Math.min(timeoutMs, 15_000));
    const target = await openTarget(port, 'about:blank', Math.min(timeoutMs, 15_000));
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.open();
    await client.command('Page.enable');
    await client.command('Runtime.enable');

    const requestedViewport = {
      width: Number(args['viewport-width'] ?? 1440),
      height: Number(args['viewport-height'] ?? 1000),
    };
    await client.command('Emulation.setDeviceMetricsOverride', {
      width: requestedViewport.width,
      height: requestedViewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const deadline = Date.now() + timeoutMs;
    let readyState;
    let pageManifest;
    let lastError;
    while (Date.now() < deadline) {
      await client.command('Page.navigate', { url: targetUrl });
      try {
        readyState = await waitForCaptureReady(client, Math.min(15_000, Math.max(5_000, deadline - Date.now())));
        pageManifest = JSON.parse(readyState.manifest || '{}');
        if (pageManifest.viewportMatch === false) {
          const nextViewport = pageManifest.viewport;
          if (
            Number.isInteger(nextViewport?.width) && nextViewport.width > 0 &&
            Number.isInteger(nextViewport?.height) && nextViewport.height > 0
          ) {
            await client.command('Emulation.setDeviceMetricsOverride', {
              width: nextViewport.width,
              height: nextViewport.height,
              deviceScaleFactor: 1,
              mobile: false,
            });
            continue;
          }
        }
        break;
      } catch (error) {
        lastError = error;
        const retryable = /Capture model not found|Timed out waiting/.test(error instanceof Error ? error.message : String(error));
        if (!retryable || Date.now() + 1_000 >= deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
    if (!readyState || !pageManifest) throw lastError ?? new Error('Capture page did not become ready.');

    for (const key of ['articleId', 'modelCaseId', 'captureSpecId', 'view', 'captureRegion', 'viewportMatch', 'sourcePlanId']) {
      if (pageManifest[key] == null) throw new Error(`Capture page manifest is missing ${key}.`);
    }
    if (pageManifest.modelCaseId !== modelCaseId || pageManifest.captureSpecId !== captureSpecId) {
      throw new Error('Capture page manifest does not match the requested model/spec.');
    }
    if (pageManifest.viewportMatch !== true) {
      throw new Error(`Capture viewport does not match Capture Spec: ${JSON.stringify(pageManifest.viewport)}`);
    }

    const actualViewport = await evaluate(client, '({ width: window.innerWidth, height: window.innerHeight })');
    let clip;
    if (pageManifest.captureRegion !== 'viewport') {
      clip = await evaluate(client, `(async () => {
        const region = ${JSON.stringify(pageManifest.captureRegion)};
        const target = Array.from(document.querySelectorAll('[data-content-capture-target]'))
          .find((element) => element.dataset.contentCaptureTarget === region);
        if (!target) return null;

        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );

        const renderDeadline = performance.now() + 5_000;
        while (target.dataset.contentCaptureRenderStatus === 'pending') {
          if (performance.now() >= renderDeadline) {
            throw new Error('capture target render timeout after scroll: ' + region);
          }
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }

        const rect = target.getBoundingClientRect();
        return {
          x: Math.max(0, rect.left + window.scrollX),
          y: Math.max(0, rect.top + window.scrollY),
          width: Math.max(1, rect.width),
          height: Math.max(1, rect.height),
          scale: 1,
        };
      })()`);
      if (!clip) throw new Error(`Semantic capture target not found: ${pageManifest.captureRegion}`);
    }

    const screenshot = await client.command('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: Boolean(clip),
      ...(clip ? { clip } : {}),
    });
    const png = Buffer.from(screenshot.data, 'base64');
    if (png.length < 24 || png.toString('ascii', 1, 4) !== 'PNG') throw new Error('Chrome did not return a valid PNG.');
    const imageWidth = png.readUInt32BE(16);
    const imageHeight = png.readUInt32BE(20);
    const imageSha256 = createHash('sha256').update(png).digest('hex');

    mkdirSync(outputDir, { recursive: true });
    const fileStem = [pageManifest.articleId, modelCaseId, captureSpecId].map(sanitizeFilePart).join('__');
    const imageFilename = `${fileStem}.png`;
    const manifestFilename = `${fileStem}.manifest.json`;
    writeFileSync(path.join(outputDir, imageFilename), png);

    const manifest = {
      manifestVersion: 1,
      articleId: pageManifest.articleId,
      modelCaseId,
      captureSpecId,
      view: pageManifest.view,
      purpose: pageManifest.purpose ?? null,
      note: pageManifest.note ?? null,
      captureRegion: pageManifest.captureRegion,
      viewport: pageManifest.viewport,
      actualViewport,
      viewportMatch: pageManifest.viewportMatch,
      operatorMode: pageManifest.operatorMode ?? {},
      displayState: pageManifest.displayState ?? {},
      imageFilename,
      imageWidth,
      imageHeight,
      imageSha256,
      captureTimestamp: new Date().toISOString(),
      sourceEnvironment: args['source-environment'] || inferSourceEnvironment(targetUrl),
      sourceUrl: targetUrl,
      sourcePlanId: pageManifest.sourcePlanId,
    };
    writeFileSync(path.join(outputDir, manifestFilename), `${JSON.stringify(manifest, null, 2)}\n`);

    console.log(`Captured ${imageFilename} (${imageWidth}x${imageHeight}, ${png.length} bytes).`);
    console.log(`Manifest ${manifestFilename}.`);
    console.log(`Capture manifest: ${JSON.stringify(manifest)}`);
  } finally {
    client?.close();
    if (chrome.exitCode == null && !chrome.killed) chrome.kill('SIGTERM');
    if (chrome.exitCode == null) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 2_000);
        chrome.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    if (temporaryProfile) {
      try {
        rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch (error) {
        console.warn('Could not remove temporary Chrome profile.', error);
      }
    }
    if (chrome.exitCode && chrome.exitCode !== 0 && chrome.exitCode !== 143) {
      console.error(chromeStderr);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
