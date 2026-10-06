// Subtask settings page (project menu "Subtasks"): empty state, add, update
// (default, force, descendants, inherited custom fields), delete, and the
// refusals for users without the permission or the membership.
import { createRequire } from 'node:module';
import { e2e } from '../../.codex/e2e/lib.mjs';

const { ruleRows, addRule, deleteRules } = createRequire(import.meta.url)('./support.cjs');
const P = 'e2e-project';
const t = await e2e('settings');
const expect = (cond, msg) => { if (!cond) t.problems.push(msg); };

await t.login('manager');
await deleteRules(t, P);
await t.go(`/projects/${P}`);
expect(await t.page.locator('#main-menu a.subtask-settings', { hasText: 'Subtasks' }).count() === 1, 'menu item "Subtasks" missing for manager');
await t.page.click('#main-menu a.subtask-settings');
await t.settle();
expect(await ruleRows(t).count() === 0, 'empty state shows rules');
expect(await t.page.locator('text=Subtask creation rules:').count() === 0, 'empty state shows the rules header');
await t.shot('empty', 'Manager opens "Subtasks" from the project menu: no rules yet, only the form to add one');

await addRule(t, P, 'Bug', 'Feature');
expect(await t.page.locator('#flash_notice', { hasText: 'Subtask-config created successfully.' }).count() === 1, 'no notice after create');
expect(await ruleRows(t).count() === 1, 'rule not listed after create');
await t.shot('created', 'Rule Bug -> Feature added: notice, rule listed with its options and the SVG delete icon');

const row = ruleRows(t).first();
await row.locator('input[name=default]').check();
await row.locator('input[name=auto]').check();
await row.locator('input[name=inheritance]').check();
const cf = row.locator('select[name="custom_fields[]"] option');
const cfCount = await cf.count();
if (cfCount) await row.locator('select[name="custom_fields[]"]').selectOption({ index: 0 });
await row.locator('input[type=submit]').click();
await t.settle();
t.check('update rule');
expect(await t.page.locator('#flash_notice', { hasText: 'Subtask-config updated successfully.' }).count() === 1, 'no notice after update');
const updated = ruleRows(t).first();
for (const name of ['default', 'auto', 'inheritance']) {
  expect(await updated.locator(`input[name=${name}]`).isChecked(), `${name} not kept after update`);
}
if (cfCount) expect(await updated.locator('select[name="custom_fields[]"] option:checked').count() === 1, 'custom field not kept');
await t.shot('updated', 'Rule updated: by default, by force, descendant projects and an inherited custom field are kept');

t.page.once('dialog', d => d.accept().catch(() => {}));
await ruleRows(t).first().locator('a.icon-del').click();
await t.settle();
t.check('delete rule');
expect(await t.page.locator('#flash_notice', { hasText: 'Subtask-config deleted successfully.' }).count() === 1, 'no notice after delete');
expect(await ruleRows(t).count() === 0, 'rule still listed after delete');
await t.shot('deleted', 'Rule deleted after the confirmation: notice, empty list');

// failure paths as a member with the permission
const token = await t.page.locator('meta[name=csrf-token]').getAttribute('content');
for (const method of ['put', 'delete']) {
  const res = await t.page.request[method](`${t.BASE}/projects/${P}/subtask_settings/999999`,
    { headers: { 'X-CSRF-Token': token }, maxRedirects: 0 });
  expect(res.status() === 404, `${method.toUpperCase()} of an unknown rule answered ${res.status()}, expected 404`);
}
await t.go('/projects/no-such-project/subtask_settings/show', { status: 404 });
await t.shot('unknown-project', 'An unknown project answers 404 inside the Redmine layout');

// JSON list for a member with the permission
await addRule(t, P, 'Bug', 'Support');
const json = await t.page.request.get(`${t.BASE}/projects/${P}/subtask_settings`);
const rules = json.ok() ? await json.json() : [];
expect(json.status() === 200 && rules.length === 1 && 'child' in rules[0], `JSON list: HTTP ${json.status()} ${JSON.stringify(rules)}`);

await t.login('reporter');
await t.go(`/projects/${P}`);
expect(await t.page.locator('#main-menu a.subtask-settings').count() === 0, 'menu item shown to reporter');
await t.shot('reporter-no-menu', 'Reporter (no plugin permission): no "Subtasks" item in the project menu');
await t.go(`/projects/${P}/subtask_settings/show`, { status: 403 });
await t.shot('reporter-refused', 'Reporter opening the settings page directly: 403');
const reporterJson = await t.page.request.get(`${t.BASE}/projects/${P}/subtask_settings`);
expect(reporterJson.status() === 403, `JSON list as reporter: HTTP ${reporterJson.status()}`);

await t.login('outsider');
await t.go('/projects/e2e-private/subtask_settings/show', { status: 403 });
await t.shot('outsider-refused', 'Outsider on the private project settings page: 403, nothing shown');

await t.anonymous();
await t.go(`/projects/${P}/subtask_settings/show`);
expect(t.page.url().includes('/login'), `anonymous was not sent to the login page: ${t.page.url()}`);
await t.shot('anonymous-login', 'Anonymous: redirected to the login page');

await t.login('manager');
await deleteRules(t, P);
await t.done();
