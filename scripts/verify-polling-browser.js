// Playwright CLI run-code --filename scripts/verify-polling-browser.js
// Only the disposable scripts/auth-ui-check-server.mjs fixture on port 4208.
// One browser page; the concurrent writer uses Playwright's HTTP client.
async (page) => {
  if (new URL(page.url()).origin !== 'http://127.0.0.1:4208') throw Error('Use only the disposable port-4208 fixture.');
  const assert = (value, message) => {if (!value) throw Error(message);};
  const origin = 'http://127.0.0.1:4208', results = {};
  await page.reload();
  if (await page.locator('#sign-in').isVisible()) {
    await page.getByLabel('Workspace password').fill('fixture-only-workspace-password');
    await page.getByRole('button', {name:'Open workspace', exact:true}).click();
  }
  await page.locator('#board .ticket').first().waitFor();
  await page.clock.install();
  let checks = 0, boards = 0;
  page.on('request', req => {const path = new URL(req.url()).pathname;if (path === '/api/changes') checks++;if (path === '/api/board') boards++;});
  const wait = () => page.waitForTimeout(100);
  const trigger = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const pollResponse = async action => {
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/changes');
    await action(); await response; await wait();
  };
  await pollResponse(trigger);
  const initial = checks;
  await pollResponse(() => page.clock.runFor(30000));
  assert(checks === initial + 1, 'Keep the 30-second active cadence.');
  await page.clock.fastForward(180000);await wait();const idle = checks;
  await page.clock.fastForward(90000);await wait();
  assert(checks === idle, 'Idle clients must stop polling.');
  results.activeIntervalMs = 30000; results.idleRequests = checks - idle;

  // Deliberately hold a response to exercise real fetch cancellation and overlap.
  const pending = [];
  await page.route('**/api/changes?**', async route => {
    await new Promise(resolve => pending.push(resolve));
    try {await route.fulfill({json:{changeToken:'obsolete'}});} catch {/* Aborted transport. */}
  });
  const beforeOverlap = checks;
  await page.evaluate(() => {document.dispatchEvent(new Event('visibilitychange'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));});
  await wait();assert(checks === beforeOverlap + 1, 'Coalesce simultaneous triggers.');
  results.overlappingRequests = checks - beforeOverlap;
  const failed = page.waitForEvent('requestfailed', {predicate:r => new URL(r.url()).pathname === '/api/changes'});
  await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await failed;
  const hidden = checks;
  await page.clock.fastForward(60000);await trigger();await wait();assert(checks === hidden, 'No hidden-tab checks.');
  results.hiddenRequests = checks - hidden;
  pending.splice(0).forEach(resolve => resolve());await wait();
  await page.unroute('**/api/changes?**');
  await pollResponse(() => page.evaluate(() => {delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}));
  assert(!(await page.locator('#board-updates').isVisible()), 'An aborted response must not show stale updates.');

  await page.context().setOffline(true);await wait();const offline = checks;
  await page.clock.fastForward(60000);await trigger();await wait();assert(checks === offline, 'No offline requests.');
  await pollResponse(() => page.context().setOffline(false));
  results.offlineRequests = 0; results.reconnectImmediate = true;

  // A scrolled, expanded page and an editor draft must survive another client.
  const lane = page.locator('[data-scroll-lane]').first();
  const draftId = await lane.locator('[data-open]').first().getAttribute('data-open');
  const remoteId = await lane.locator('[data-open]').nth(1).getAttribute('data-open');
  await lane.locator('[data-load-lane]').click();await wait();
  await lane.evaluate(el => {el.scrollTop = 100;});
  await page.locator(`[data-open="${draftId}"]`).click();
  await page.locator('#edit-title').fill('Unsaved fixture draft');
  const before = await lane.evaluate(el => ({cards:el.querySelectorAll('.ticket').length,scrollTop:el.scrollTop}));
  assert(before.cards >= 10, 'The pagination fixture must be expanded.');
  // page.request shares the page's cookie jar. Issue a separate session without
  // sending the first cookie, then restore that jar before continuing the UI.
  const browserCookies = await page.context().cookies(origin);
  const login = await page.request.post(origin + '/auth/login', {headers:{origin,cookie:''},data:{password:'fixture-only-workspace-password'}});
  assert(login.ok(), 'Second client sign-in.');
  const cookie = login.headers()['set-cookie'].split(';')[0];
  await page.context().addCookies(browserCookies);
  const auth = {cookie,origin};
  const session = await (await page.request.get(origin + '/api/session', {headers:auth})).json();
  const remote = await (await page.request.get(origin + '/api/tickets/' + remoteId, {headers:auth})).json();
  const write = await page.request.patch(origin + '/api/tickets/' + remoteId, {headers:{...auth,'x-csrf-token':session.csrf},data:{revision:remote.revision,title:'Changed by another fixture client'}});
  assert(write.ok(), 'Second client mutation.');
  const beforeNotice = checks, beforeBoards = boards;
  await pollResponse(trigger);await page.locator('#board-updates').waitFor({state:'visible'});
  assert(await page.locator('#edit-title').inputValue() === 'Unsaved fixture draft', 'Keep the open draft.');
  const after = await lane.evaluate(el => ({cards:el.querySelectorAll('.ticket').length,scrollTop:el.scrollTop}));
  assert(JSON.stringify(before) === JSON.stringify(after), 'Keep expanded page and board position.');
  await page.clock.fastForward(60000);await trigger();await wait();
  assert(checks === beforeNotice + 1, 'Stop redundant checks after the update notice.');
  assert(boards === beforeBoards, 'Never reload the board automatically.');
  results.noticeRequests = checks - beforeNotice - 1;results.draftAndPagesPreserved = true;
  await page.screenshot({path:'outputs/neon-audit/draft-preserved.png'});
  await page.getByRole('button', {name:'Cancel',exact:true}).click();
  await page.locator('#apply-updates').click();await wait();
  await page.locator(`[data-open="${remoteId}"]`).waitFor();
  assert(await page.locator(`[data-open="${remoteId}"]`).textContent() === 'Changed by another fixture client', 'Explicit refresh discovers remote changes.');
  assert(!(await page.locator('#board-updates').isVisible()), 'Refresh clears the notice.');
  await pollResponse(trigger);

  // A local mutation invalidates a background read before its stale 401 arrives.
  let releaseStale;
  await page.route('**/api/changes?**', async route => {
    await new Promise(resolve => {releaseStale = resolve;});
    try {await route.fulfill({status:401,json:{error:'obsolete session'}});} catch {}
  });
  await trigger();await wait();
  const canceled = page.waitForEvent('requestfailed', {predicate:r=>new URL(r.url()).pathname === '/api/changes'});
  const status = page.locator(`[data-status="${draftId}"]`);
  await status.selectOption('completed');await canceled;releaseStale();await wait();
  await page.unroute('**/api/changes?**');
  assert(await page.locator('#private-board').isVisible(), 'An obsolete 401 cannot lock the current board.');
  const saved = await (await page.request.get(origin + '/api/tickets/' + draftId, {headers:auth})).json();
  assert(saved.status === 'completed', 'Immediate local mutation still persists.');
  results.mutationCancelsObsoleteRead = true;

  let errors = 0;
  await page.route('**/api/changes?**',async route=>{errors++;await route.fulfill({status:503,json:{error:'fixture unavailable'}});});
  await trigger();await wait();const once = errors;
  await page.clock.runFor(1000);await wait();assert(errors === once, 'No immediate retry storm.');
  await page.clock.runFor(30000);await wait();assert(errors === once + 1, 'Retry on the normal interval.');
  await page.unroute('**/api/changes?**');results.failureRetriesAtNormalInterval = true;
  await page.route('**/api/changes?**',route=>route.fulfill({status:401,json:{error:'fixture expired'}}));
  await trigger();await page.locator('#session-panel').waitFor({state:'visible'});
  assert(!(await page.locator('#private-board').isVisible()), 'Current 401 still locks private data.');
  await page.unroute('**/api/changes?**');results.expiryLocksBoard = true;
  return results;
}
