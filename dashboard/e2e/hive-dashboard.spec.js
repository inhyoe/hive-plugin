/**
 * Hive Dashboard E2E Test
 *
 * Prerequisites:
 *   1. Event server running on port 3001
 *   2. Dashboard running on port 3000
 *   3. .hive-state/events.jsonl writable
 *
 * Run: cd $PLAYWRIGHT_SKILL_DIR && node run.js dashboard/e2e/hive-dashboard.spec.js
 */
const { chromium } = require('playwright');
const { appendFileSync, writeFileSync, mkdirSync } = require('fs');
const { resolve } = require('path');

const TARGET_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const STATE_DIR = process.env.HIVE_STATE_DIR || resolve(__dirname, '../../.hive-state');
const EVENTS_FILE = resolve(STATE_DIR, 'events.jsonl');

function emit(event) {
  const line = JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
    sessionId: 'e2e-test-001',
  });
  appendFileSync(EVENTS_FILE, line + '\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

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

  try {
    // === Test 1: Dashboard loads ===
    console.log('\n🔍 Test 1: Dashboard loads');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 15000 });
    const title = await page.title();
    check('Page title contains Hive', title.includes('Hive'));

    const header = await page.textContent('header');
    check('Header shows Hive Dashboard', header && header.includes('Hive Dashboard'));

    // Connection indicator — could be "Connected", "Live", or "Disconnected"
    const connText = await page.locator('header').textContent();
    check('Connection indicator present', connText.includes('Connected') || connText.includes('Live') || connText.includes('Disconnected'));

    await page.screenshot({ path: '/tmp/hive-e2e-01-initial.png', fullPage: true });

    // === Test 2: Pipeline panel renders G1-G7 ===
    console.log('\n🔍 Test 2: Pipeline panel');
    const pipelineText = await page.locator('text=Pipeline').first().textContent();
    check('Pipeline label present', !!pipelineText);
    const gateCount = await page.locator('text=/^G[1-7]$/').count();
    check('All 7 gates visible', gateCount === 7);

    // === Test 3: Events update pipeline ===
    console.log('\n🔍 Test 3: Events update pipeline');
    writeFileSync(EVENTS_FILE, '');
    await sleep(500);

    emit({ type: 'phase.transition', payload: { phase: 0, status: 'enter' } });
    emit({ type: 'gate.update', payload: { gate: 'G1', status: 'passed' } });
    emit({ type: 'gate.update', payload: { gate: 'G2', status: 'passed' } });
    await sleep(1500);

    const eventLogLabel = await page.locator('text=Event Log').first().textContent();
    check('Event Log label present', !!eventLogLabel);
    await page.screenshot({ path: '/tmp/hive-e2e-02-gates.png', fullPage: true });

    // === Test 4: Team topology shows all 3 providers ===
    console.log('\n🔍 Test 4: Team topology');
    emit({ type: 'phase.transition', payload: { phase: 3, status: 'enter' } });
    emit({ type: 'team.created', payload: { teamId: 'T1-auth', modules: ['auth', 'session'], provider: 'claude', agentName: 'agent-auth' } });
    emit({ type: 'team.created', payload: { teamId: 'T2-api', modules: ['api', 'routes'], provider: 'codex', agentName: 'agent-api' } });
    emit({ type: 'team.created', payload: { teamId: 'T3-test', modules: ['tests'], provider: 'gemini', agentName: 'agent-test' } });
    await sleep(2000);

    check('Claude node visible', await page.locator('text=Claude').count() >= 1);
    check('Codex node visible', await page.locator('text=Codex').count() >= 1);
    check('Gemini node visible', await page.locator('text=Gemini').count() >= 1);
    check('T1-auth visible', await page.locator('text=T1-auth').count() >= 1);
    check('T2-api visible', await page.locator('text=T2-api').count() >= 1);
    check('T3-test visible', await page.locator('text=T3-test').count() >= 1);
    await page.screenshot({ path: '/tmp/hive-e2e-03-topology.png', fullPage: true });

    // === Test 5: Worker current task ===
    console.log('\n🔍 Test 5: Worker current task');
    emit({ type: 'agent.status', payload: { teamId: 'T1-auth', provider: 'claude', status: 'working', currentTask: 'Implementing JWT authentication' } });
    await sleep(1500);
    check('Current task visible', await page.locator('text=Implementing JWT authentication').count() >= 1);
    await page.screenshot({ path: '/tmp/hive-e2e-04-working.png', fullPage: true });

    // === Test 6: Execution results ===
    console.log('\n🔍 Test 6: Execution results');
    emit({ type: 'agent.status', payload: { teamId: 'T1-auth', provider: 'claude', status: 'done', currentTask: '' } });
    emit({ type: 'execution.result', payload: { teamId: 'T1-auth', changedFiles: ['src/auth.ts', 'src/session.ts'], linesAdded: 245, linesRemoved: 12, success: true } });
    emit({ type: 'agent.status', payload: { teamId: 'T2-api', provider: 'codex', status: 'done', currentTask: '' } });
    emit({ type: 'execution.result', payload: { teamId: 'T2-api', changedFiles: ['src/routes.ts'], linesAdded: 180, linesRemoved: 5, success: true } });
    emit({ type: 'agent.status', payload: { teamId: 'T3-test', provider: 'gemini', status: 'done', currentTask: '' } });
    emit({ type: 'execution.result', payload: { teamId: 'T3-test', changedFiles: ['tests/auth.test.ts'], linesAdded: 320, linesRemoved: 0, success: true } });
    await sleep(2000);

    check('Results panel visible', await page.locator('text=Results').count() >= 1);
    check('Files Changed metric', await page.locator('text=Files Changed').count() >= 1);
    await page.screenshot({ path: '/tmp/hive-e2e-05-results.png', fullPage: true });

    // === Test 7: All gates pass + session summary ===
    console.log('\n🔍 Test 7: Session complete');
    emit({ type: 'gate.update', payload: { gate: 'G3', status: 'passed' } });
    emit({ type: 'gate.update', payload: { gate: 'G4', status: 'passed' } });
    emit({ type: 'gate.update', payload: { gate: 'G5', status: 'passed' } });
    emit({ type: 'gate.update', payload: { gate: 'G6', status: 'passed' } });
    emit({ type: 'gate.update', payload: { gate: 'G7', status: 'passed' } });
    emit({ type: 'session.summary', payload: { totalTeams: 3, passed: 3, failed: 0, totalFiles: 4, totalChanges: 762 } });
    await sleep(2000);

    check('Teams Passed visible', await page.locator('text=Teams Passed').count() >= 1);
    await page.screenshot({ path: '/tmp/hive-e2e-06-complete.png', fullPage: true });

    // === Test 8: Late-join replay ===
    console.log('\n🔍 Test 8: Late-join replay');
    const page2 = await browser.newPage();
    await page2.setViewportSize({ width: 1920, height: 1080 });
    await page2.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await sleep(3000);

    check('Replay shows T1-auth', await page2.locator('text=T1-auth').count() >= 1);
    check('Replay shows Results', await page2.locator('text=Results').count() >= 1);
    await page2.screenshot({ path: '/tmp/hive-e2e-07-replay.png', fullPage: true });
    await page2.close();

    // === Summary ===
    console.log('\n' + '='.repeat(50));
    console.log(`  HIVE DASHBOARD E2E RESULTS`);
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total:  ${passed + failed}`);
    console.log('='.repeat(50));

    if (failed > 0) {
      console.log('\n❌ E2E FAILED');
      process.exitCode = 1;
    } else {
      console.log('\n✅ ALL E2E TESTS PASSED');
    }
  } catch (error) {
    console.error('❌ E2E Error:', error.message);
    await page.screenshot({ path: '/tmp/hive-e2e-error.png', fullPage: true });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
