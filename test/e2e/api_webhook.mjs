// REST API and Redmine 7 webhooks: an issue created through the API gets its
// forced and its requested subtasks; a rule of another project, a request
// without the permission and an update without an "issue" hash create
// nothing (the last one used to answer 500); every subtask is announced by
// the core "issue.created" webhook like any other issue.
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { e2e } from '../../.codex/e2e/lib.mjs';

const { addRule, deleteRules } = createRequire(import.meta.url)('./support.cjs');
const P = 'e2e-project';
const SUB = 'e2e-sub';
const PASSWORD = process.env.RMP_USER_PASSWORD || process.env.RMP_ADMIN_PASSWORD || 'Redmine7Test!';
const t = await e2e('api-webhook');
const expect = (cond, msg) => { if (!cond) t.problems.push(msg); };

// webhook receiver
const received = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => { try { received.push(JSON.parse(body)); } catch { received.push({ raw: body }); } res.end('ok'); });
});
// core refuses loopback webhook URLs (SSRF guard), so listen on this machine's own address
const hostIp = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address;
if (!hostIp) throw new Error('no non-loopback IPv4 address for the webhook receiver');
await new Promise(r => server.listen(3999, hostIp, r));

const auth = login => ({ Authorization: 'Basic ' + Buffer.from(`${login}:${PASSWORD}`).toString('base64'), 'Content-Type': 'application/json' });
const api = (method, url, login, data) => t.page.request.fetch(`${t.BASE}${url}`, { method, headers: auth(login), data: data ? JSON.stringify(data) : undefined });
const childrenOf = async (id, login = 'manager') => {
  const r = await api('GET', `/issues/${id}.json?include=children`, login);
  return (await r.json()).issue.children || [];
};

await t.login('admin');
await t.go('/settings?tab=integrations');
await t.sudo();
await t.page.check('#settings_webhooks_enabled');
await t.page.locator('#tab-content-integrations input[name=commit]').click();
await t.settle();
t.check('enable webhooks');

await t.login('manager');
await deleteRules(t, P);
await deleteRules(t, SUB);
await addRule(t, P, 'Bug', 'Feature');
await addRule(t, P, 'Bug', 'Support', { force: true });
await addRule(t, SUB, 'Bug', 'Feature');
const rules = await (await t.page.request.get(`${t.BASE}/projects/${P}/subtask_settings`)).json();
const subRules = await (await t.page.request.get(`${t.BASE}/projects/${SUB}/subtask_settings`)).json();
const trackers = (await (await api('GET', '/trackers.json', 'manager')).json()).trackers;
const tid = name => trackers.find(x => x.name === name).id;
const featureRule = rules.find(r => r.child === tid('Feature'));

await t.go('/webhooks/new');
await t.page.fill('#webhook_url', `http://${hostIp}:3999/hook`);
await t.page.check('#webhook_active');
await t.page.check('[id="webhook_events_issue.created"]');
await t.page.locator('#webhook_project_ids label', { hasText: 'E2E project' }).first().locator('input').check();
await t.page.locator('#content input[name=commit]').first().click();
await t.sudo();
await t.settle();
t.check('create webhook');
expect(await t.page.locator('#errorExplanation').count() === 0, `webhook not created: ${await t.page.locator('#errorExplanation').allInnerTexts()}`);
await t.shot('webhook', 'Manager registers a webhook for "issue created" in e2e-project, pointing to a local receiver');

// create through the API, asking for the optional Feature subtask
let res = await api('POST', `/projects/${P}/issues.json`, 'manager',
  { issue: { tracker_id: tid('Bug'), subject: `E2E API parent ${Date.now()}`, new_subtask_ids: [String(featureRule.id)] } });
expect(res.status() === 201, `API create: HTTP ${res.status()}`);
const parent = (await res.json()).issue;
let kids = await childrenOf(parent.id);
expect(kids.length === 2 && kids.map(k => k.tracker.name).sort().join() === 'Feature,Support', `API subtasks: ${JSON.stringify(kids)}`);

// forged: a rule of another project through an update
res = await api('PUT', `/issues/${parent.id}.json`, 'manager', { issue: { notes: 'forged', new_subtask_ids: [String(subRules[0].id)] } });
expect(res.status() === 204, `API update with a foreign rule: HTTP ${res.status()}`);
expect((await childrenOf(parent.id)).length === 2, 'a rule of another project created a subtask');

// an update without an "issue" hash used to answer 500 after saving
res = await api('PUT', `/issues/${parent.id}.json`, 'manager', { notes: 'outside the issue hash' });
expect(res.status() === 204, `API update without an issue hash: HTTP ${res.status()}`);

// without the permission: the optional one is ignored, the forced one stays
res = await api('POST', `/projects/${P}/issues.json`, 'reporter',
  { issue: { tracker_id: tid('Bug'), subject: `E2E API reporter ${Date.now()}`, new_subtask_ids: [String(featureRule.id)] } });
expect(res.status() === 201, `API create as reporter: HTTP ${res.status()}`);
const reporterParent = (await res.json()).issue;
kids = await childrenOf(reporterParent.id, 'reporter');
expect(kids.length === 1 && kids[0].tracker.name === 'Support', `reporter's API subtasks: ${JSON.stringify(kids)}`);

await t.go(`/issues/${parent.id}`);
await t.shot('api-parent', 'Issue created through the REST API: Feature (asked) and Support (forced) subtasks; the forged update and the bare update added nothing');

// webhook deliveries are asynchronous
const expected = [parent.id, ...(await childrenOf(parent.id)).map(k => k.id)];
for (let i = 0; i < 30 && !expected.every(id => received.some(p => p.data?.issue?.id === id)); i += 1) await new Promise(r => setTimeout(r, 1000));
for (const id of expected) {
  const p = received.find(x => x.data?.issue?.id === id);
  expect(p && p.type === 'issue.created', `no issue.created webhook for #${id}`);
  if (p && id !== parent.id) expect(p.data.issue.parent?.id === parent.id, `webhook for subtask #${id} without parent #${parent.id}`);
}
console.log(`webhook: ${received.length} deliveries, ${received.map(p => `${p.type} #${p.data?.issue?.id}${p.data?.issue?.parent ? ` (parent #${p.data.issue.parent.id})` : ''}`).join(', ')}`);

await t.go('/webhooks');
t.page.on('dialog', d => d.accept().catch(() => {}));
await t.page.locator('a.icon-del').first().click();
await t.sudo();
await t.settle();
t.check('delete webhook');
await deleteRules(t, P);
await deleteRules(t, SUB);
await t.login('admin');
await t.go('/settings?tab=integrations');
await t.sudo();
await t.page.uncheck('#settings_webhooks_enabled');
await t.page.locator('#tab-content-integrations input[name=commit]').click();
await t.settle();
server.close();
await t.done();
