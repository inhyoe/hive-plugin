/**
 * G7 E2E: Verify hive-launcher.sh auto-launch works end-to-end
 * 1. Start via hive-launcher.sh
 * 2. Read ports from dashboard-runtime.json
 * 3. Verify dashboard loads in browser
 * 4. Emit events, verify they render
 * 5. Stop via hive-launcher.sh
 * 6. Verify servers stopped
 */
const { chromium } = require('playwright');
const { execSync, exec } = require('child_process');
const { readFileSync, appendFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const REPO = '/home/ryu-ubuntu/Document/GITHUB/hive-plugin-dashboard';
const LAUNCHER = resolve(REPO, 'dashboard/scripts/hive-launcher.sh');
const STATE_DIR = resolve(REPO, '.hive-state');
const RUNTIME_FILE = resolve(STATE_DIR, 'dashboard-runtime.json');
const EVENTS_FILE = resolve(STATE_DIR, 'events.jsonl');
const SESSION_ID = `e2e-g7-${Date.now()}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sh(cmd) {
  return execSync(cmd, {
    cwd: REPO,
    env: { ...process.env, HIVE_STATE_DIR: STATE_DIR, HIVE_SESSION_ID: SESSION_ID },
    encoding: 'utf-8',
    timeout: 30000,
  }).trim();
}

function emit(event) {
  const line = JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
    sessionId: SESSION_ID,
  });
  appendFileSync(EVENTS_FILE, line + '\n');
}

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

(async () => {
  let browser;
  try {
    // === Step 1: Start via launcher ===
    console.log('\n🔍 Step 1: Start via hive-launcher.sh');
    writeFileSync(EVENTS_FILE, '');

    // Start in background (non-blocking)
    const startProc = exec(
      `bash ${LAUNCHER} start --no-browser`,
      { cwd: REPO, env: { ...process.env, HIVE_STATE_DIR: STATE_DIR, HIVE_SESSION_ID: SESSION_ID } }
    );
    await sleep(10000); // Wait for servers

    check('dashboard-runtime.json created', existsSync(RUNTIME_FILE));

    // === Step 2: Read ports ===
    console.log('\n🔍 Step 2: Read ports from runtime');
    let dashPort, eventPort;
    if (existsSync(RUNTIME_FILE)) {
      const runtime = JSON.parse(readFileSync(RUNTIME_FILE, 'utf-8'));
      dashPort = runtime.dashboardPort;
      eventPort = runtime.eventPort;
      check('dashboardPort is number', typeof dashPort === 'number' && dashPort > 0);
      check('eventPort is number', typeof eventPort === 'number' && eventPort > 0);
      check('startedBy matches session', runtime.startedBy === SESSION_ID);
      console.log(`  Dashboard: http://localhost:${dashPort}`);
      console.log(`  Event Server: ws://localhost:${eventPort}`);
    } else {
      console.log('  ❌ Cannot continue without runtime.json');
      failed += 3;
      process.exitCode = 1;
      return;
    }

    // === Step 3: Verify dashboard loads ===
    console.log('\n🔍 Step 3: Dashboard loads in browser');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`http://localhost:${dashPort}`, { waitUntil: 'networkidle', timeout: 15000 });

    const title = await page.title();
    check('Page title contains Hive', title.includes('Hive'));

    // === Step 4: Emit events and verify ===
    console.log('\n🔍 Step 4: Emit events and verify rendering');
    emit({ type: 'phase.transition', payload: { phase: 3, status: 'enter' } });
    emit({ type: 'gate.update', payload: { gate: 'G1', status: 'passed' } });
    emit({ type: 'team.created', payload: { teamId: 'T1-test', modules: ['core'], provider: 'claude', agentName: 'agent-1' } });
    emit({ type: 'agent.status', payload: { teamId: 'T1-test', provider: 'claude', status: 'working', currentTask: 'Building core module' } });
    await sleep(3000);

    check('Team node visible', await page.locator('text=T1-test').count() >= 1);
    check('Current task visible', await page.locator('text=Building core module').count() >= 1);

    await page.screenshot({ path: '/tmp/hive-g7-e2e.png', fullPage: true });
    console.log('  📸 Screenshot: /tmp/hive-g7-e2e.png');

    // === Step 5: Status check ===
    console.log('\n🔍 Step 5: Status reports running');
    const status = sh(`bash ${LAUNCHER} status`);
    check('Status shows running', status.includes('running'));

    // === Step 6: Stop and verify ===
    console.log('\n🔍 Step 6: Stop via launcher');
    await browser.close();
    browser = null;

    sh(`bash ${LAUNCHER} stop`);
    await sleep(2000);

    const statusAfter = sh(`bash ${LAUNCHER} status`);
    check('Status shows stopped after stop', statusAfter.includes('stopped'));

    // === Summary ===
    console.log('\n' + '='.repeat(50));
    console.log('  G7 E2E VALIDATE RESULTS');
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total:  ${passed + failed}`);
    console.log('='.repeat(50));

    if (failed > 0) {
      console.log('\n❌ G7 E2E FAILED');
      process.exitCode = 1;
    } else {
      console.log('\n✅ G7 E2E ALL PASSED');
    }

  } catch (error) {
    console.error('❌ E2E Error:', error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    // Cleanup
    try { sh(`bash ${LAUNCHER} stop`); } catch {}
  }
})();
