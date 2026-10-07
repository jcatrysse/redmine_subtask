// Jan's decisions of 2026-10-07, each as the users that matter:
// q1 forced subtasks are created for everyone who creates the issue, also
//    without "Create subtasks" (reporter, outsider as non-member);
// q2 ticked subtasks need the permission and a rule that applies (REST API
//    as reporter, forged rule as manager), the form offers them only with it;
// q3 the subtask is created even when the user may not add issues of the
//    child tracker (Reporter limited to adding Bugs still gets a Support subtask).
// Refusals: outsider on the private project, reporter adding a Support issue.
import { createRequire } from 'node:module';
import { e2e } from '../../.codex/e2e/lib.mjs';

const { addRule, deleteRules } = createRequire(import.meta.url)('./support.cjs');
const P = 'e2e-project';
const PASSWORD = process.env.RMP_USER_PASSWORD || process.env.RMP_ADMIN_PASSWORD || 'Redmine7Test!';
const t = await e2e('decisions');
const expect = (cond, msg) => { if (!cond) t.problems.push(msg); };
const children = async () => (await t.page.locator('#issue_tree tr.issue td.subject').allInnerTexts()).map(s => s.trim());
const auth = login => ({ Authorization: 'Basic ' + Buffer.from(`${login}:${PASSWORD}`).toString('base64'), 'Content-Type': 'application/json' });
const api = (method, url, login, data) => t.page.request.fetch(`${t.BASE}${url}`, { method, headers: auth(login), data: data ? JSON.stringify(data) : undefined });
const adminChildren = async id => ((await (await api('GET', `/issues/${id}.json?include=children`, 'admin')).json()).issue.children || []).map(c => c.tracker.name).sort();
const stamp = Date.now();

async function createBug(subject) {
  await t.go(`/projects/${P}/issues/new`);
  await t.page.fill('#issue_subject', subject);
  await t.page.click('#issue-form input[name=commit]');
  await t.settle();
  t.check(`create ${subject}`);
  return Number((t.page.url().match(/\/issues\/(\d+)/) || [])[1]);
}

// Reporter may add Bugs only (per-tracker permission), or every tracker again
async function reporterAddsBugsOnly(only) {
  await t.login('admin');
  const roles = await (await api('GET', '/roles.json', 'admin')).json();
  const reporter = roles.roles.find(r => r.name === 'Reporter');
  await t.go(`/roles/${reporter.id}/edit`);
  await t.sudo();
  const all = t.page.locator('input[type=checkbox][name="role[permissions_all_trackers][add_issues]"]');
  const trackers = (await (await api('GET', '/trackers.json', 'admin')).json()).trackers;
  const bug = trackers.find(x => x.name === 'Bug').id;
  if (only) {
    await all.uncheck();
    for (const tr of trackers) {
      const box = t.page.locator(`input[type=checkbox][name="role[permissions_tracker_ids][add_issues][]"][value="${tr.id}"]`);
      if (tr.id === bug) await box.check(); else await box.uncheck();
    }
  } else {
    await all.check();
  }
  await t.page.locator('#content input[name=commit]').first().click();
  await t.sudo();
  await t.settle();
  t.check(`reporter role, Bugs only: ${only}`);
  expect(await t.page.locator('#errorExplanation').count() === 0, 'role not saved');
}

await t.login('manager');
await deleteRules(t, P);
await addRule(t, P, 'Bug', 'Feature');
await addRule(t, P, 'Bug', 'Support', { force: true });
const rules = await (await t.page.request.get(`${t.BASE}/projects/${P}/subtask_settings`)).json();
const trackers = (await (await api('GET', '/trackers.json', 'manager')).json()).trackers;
const featureRule = rules.find(r => r.child === trackers.find(x => x.name === 'Feature').id);

// admin and manager: both choices offered, both created
for (const user of ['admin', 'manager']) {
  await t.login(user);
  await t.go(`/projects/${P}/issues/new`);
  const labels = (await t.page.locator('#subtasks_form label.floating').allInnerTexts()).map(s => s.trim()).sort();
  expect(labels.join() === 'Feature,Support (required)', `${user} choices: ${JSON.stringify(labels)}`);
  await t.page.locator('#subtasks_form label.floating', { hasText: 'Feature' }).locator('input').check();
  await t.page.fill('#issue_subject', `E2E decisions ${user} ${stamp}`);
  await t.page.click('#issue-form input[name=commit]');
  await t.settle();
  const kids = await children();
  expect(kids.length === 2, `${user} subtasks: ${JSON.stringify(kids)}`);
  await t.shot(`${user}-created`, `${user}: Feature (ticked) and Support (forced) subtasks created`);
}

// q1 + q2: reporter, no "Create subtasks"
await t.login('reporter');
let id = await createBug(`E2E decisions reporter ${stamp}`);
expect((await adminChildren(id)).join() === 'Support', `q1 reporter: ${await adminChildren(id)}`);
await t.shot('q1-reporter', 'q1: reporter without "Create subtasks" sees no choices but gets the forced Support subtask');
let res = await api('POST', `/projects/${P}/issues.json`, 'reporter',
  { issue: { tracker_id: trackers.find(x => x.name === 'Bug').id, subject: `E2E decisions reporter API ${stamp}`, new_subtask_ids: [String(featureRule.id)] } });
expect(res.status() === 201, `reporter API create: HTTP ${res.status()}`);
id = (await res.json()).issue.id;
expect((await adminChildren(id)).join() === 'Support', `q2 reporter API: ${await adminChildren(id)}`);
await t.go(`/issues/${id}`);
await t.shot('q2-reporter-api', 'q2: reporter asks for the Feature subtask through the API: refused silently, only the forced Support one');

// q1: outsider (non-member role on the public project)
await t.login('outsider');
await t.go(`/projects/${P}/issues/new`);
expect(await t.page.locator('#subtasks_form').count() === 0, 'outsider sees subtask choices');
id = await createBug(`E2E decisions outsider ${stamp}`);
expect(id > 0 && (await adminChildren(id)).join() === 'Support', `q1 outsider: ${id} ${id && await adminChildren(id)}`);
await t.shot('q1-outsider', 'q1: outsider (non-member) creating a Bug in the public project also gets the forced Support subtask');
await t.go('/projects/e2e-private/issues/new', { status: 403 });
await t.shot('outsider-private-refused', 'Outsider: new issue in the private project is refused (403)');

// q3: reporter may add Bugs only, the forced Support subtask is still created
await reporterAddsBugsOnly(true);
await t.shot('q3-role', 'Admin saved the Reporter role with "Add issues" limited to the Bug tracker (Successful update)');
await t.login('reporter');
await t.go(`/projects/${P}/issues/new`);
const offered = await t.page.locator('#issue_tracker_id option').allInnerTexts();
expect(offered.join() === 'Bug', `reporter may add: ${JSON.stringify(offered)}`);
await t.shot('q3-refused-tracker', 'Refusal: the reporter can only choose Bug, not Support, for a new issue');
id = await createBug(`E2E decisions q3 ${stamp}`);
expect((await adminChildren(id)).join() === 'Support', `q3: ${await adminChildren(id)}`);
await t.shot('q3-created', 'q3: the rule decides: the reporter\'s Bug still gets its forced Support subtask');
await reporterAddsBugsOnly(false);

await t.login('manager');
await deleteRules(t, P);
await t.done();
