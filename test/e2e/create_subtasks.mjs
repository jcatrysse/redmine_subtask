// New issue form: the "Create subtasks" choices (by default, by force), the
// subtasks created on save with the inherited custom field, the tracker
// switch, a member without the "Create subtasks" permission, and a subtask
// that cannot be created (required field on the child tracker).
import { createRequire } from 'node:module';
import { e2e } from '../../.codex/e2e/lib.mjs';

const { ruleRows, addRule, deleteRules } = createRequire(import.meta.url)('./support.cjs');
const P = 'e2e-project';
const t = await e2e('create-subtasks');
const expect = (cond, msg) => { if (!cond) t.problems.push(msg); };

async function children() {
  return (await t.page.locator('#issue_tree tr.issue td.subject').allInnerTexts()).map(s => s.trim());
}

// Changing the tracker reloads the form through Ajax (updateIssueFrom); wait for it.
async function selectTracker(tracker) {
  if ((await t.page.locator('#issue_tracker_id option:checked').innerText()).trim() === tracker) return;
  await Promise.all([
    t.page.waitForResponse(r => /\/issues\/new(\.js)?/.test(r.url()) && r.request().method() !== 'GET', { timeout: 20000 }),
    t.page.selectOption('#issue_tracker_id', { label: tracker }),
  ]);
  await t.page.waitForFunction(() => getComputedStyle(document.getElementById('ajax-indicator')).display === 'none');
  await t.settle();
}

async function newIssue(tracker, subject, fields = {}) {
  await t.go(`/projects/${P}/issues/new`);
  await selectTracker(tracker);
  await t.page.fill('#issue_subject', subject);
  for (const [label, value] of Object.entries(fields)) await t.page.getByLabel(label, { exact: true }).fill(value);
}

async function submit(step) {
  await t.page.click('#issue-form input[name=commit]');
  await t.settle();
  t.check(step);
}

await t.login('manager');
await deleteRules(t, P);
await addRule(t, P, 'Bug', 'Feature', { byDefault: true });
await addRule(t, P, 'Bug', 'Support', { force: true });
await addRule(t, P, 'Feature', 'Bug');
// the Bug -> Feature rule passes "E2E inherited field" on
const featureRow = ruleRows(t).filter({ has: t.page.locator('select[name=child] option[selected]', { hasText: 'Feature' }) });
await featureRow.locator('select[name="custom_fields[]"]').selectOption({ label: 'E2E inherited field' });
await featureRow.locator('input[type=submit]').click();
await t.settle();
t.check('inherit custom field');
await t.shot('rules', 'Rules: Bug -> Feature by default with "E2E inherited field", Bug -> Support by force, Feature -> Bug');

const stamp = Date.now();
await newIssue('Bug', `E2E parent ${stamp}`, { 'E2E inherited field': 'passed on', 'E2E other field': 'stays on the parent' });
const form = t.page.locator('#subtasks_form');
expect(await form.locator('label', { hasText: 'Create subtasks' }).count() > 0, 'no "Create subtasks" on the new issue form');
const feature = form.locator('label.floating', { hasText: 'Feature' }).locator('input');
const support = form.locator('label.floating', { hasText: 'Support (required)' }).locator('input');
expect(await feature.isChecked(), 'Feature (by default) not ticked');
expect(await support.isChecked() && await support.isDisabled(), 'Support (by force) not ticked and locked');
expect(await form.locator('label.floating', { hasText: 'Bug' }).count() === 0, 'the Feature -> Bug rule is offered for a Bug');
await t.shot('new-form', 'New Bug: Feature ticked by default, Support required (ticked and locked)');

await submit('create with subtasks');
expect(/\/issues\/\d+$/.test(t.page.url()), `not on the new issue: ${t.page.url()}`);
const parentUrl = new URL(t.page.url()).pathname;
let kids = await children();
expect(kids.length === 2 && kids.every(k => k.includes(`E2E parent ${stamp}`)), `subtasks after create: ${JSON.stringify(kids)}`);
expect(await t.page.locator('#flash_error').count() === 0, 'error flash after a successful create');
await t.shot('created', 'Issue created with two subtasks (Feature, Support) carrying the parent subject');

await t.page.locator('#issue_tree tr.issue', { hasText: 'Feature' }).locator('td.subject a').click();
await t.settle();
const featureText = await t.page.locator('div.issue .attributes').innerText();
expect(featureText.includes('passed on'), 'Feature subtask did not inherit "E2E inherited field"');
expect(!featureText.includes('stays on the parent'), 'Feature subtask inherited "E2E other field"');
expect(await t.page.locator('div.issue.details div.subject a.parent').count() === 1, 'parent link not shown on the subtask');
await t.shot('child', 'The Feature subtask: parent link, inherited field filled, the other field empty, empty description');

// untick the optional one: only the forced subtask
await newIssue('Bug', `E2E forced only ${stamp}`);
await t.page.locator('#subtasks_form label.floating', { hasText: 'Feature' }).locator('input').uncheck();
await submit('create forced only');
kids = await children();
expect(kids.length === 1, `subtasks with Feature unticked: ${JSON.stringify(kids)}`);
await t.shot('forced-only', 'Feature unticked: only the forced Support subtask is created');

// switching the tracker reloads the choices
await newIssue('Bug', 'switch');
await selectTracker('Feature');
const labels = await t.page.locator('#subtasks_form label.floating').allInnerTexts();
expect(labels.length === 1 && labels[0].trim() === 'Bug', `choices for a Feature: ${JSON.stringify(labels)}`);
await t.shot('tracker-switch', 'Tracker switched to Feature: the form now offers the Feature -> Bug rule only');
t.check('tracker switch');

// without the "Create subtasks" permission: no choices, the forced rule still applies
await t.login('reporter');
await t.go(`/projects/${P}/issues/new`);
await selectTracker('Bug');
expect(await t.page.locator('#subtasks_form').count() === 0, 'reporter sees the subtask choices');
await t.shot('reporter-form', 'Reporter (no "Create subtasks" permission): no subtask choices on the form');
await t.page.fill('#issue_subject', `E2E reporter parent ${stamp}`);
await submit('reporter create');
kids = await children();
expect(kids.length === 1, `reporter's issue subtasks: ${JSON.stringify(kids)}`);
await t.shot('reporter-created', 'Reporter\'s Bug still gets the forced Support subtask (forced rules apply to everyone)');

// failure path: the Support subtask cannot be saved
await t.login('admin');
await t.go('/custom_fields/new?type=IssueCustomField');
await t.settle();
await t.page.fill('#custom_field_name', 'E2E required for support');
await t.page.check('#custom_field_is_required');
await t.page.check('#custom_field_is_for_all');
for (const box of await t.page.locator('input[type=checkbox][name="custom_field[tracker_ids][]"]').all()) await box.uncheck();
await t.page.locator('#custom_field_tracker_ids').getByLabel('Support', { exact: true }).check();
await t.page.click('input[name=commit]');
await t.sudo();
await t.settle();
t.check('create required field');
expect(await t.page.locator('#flash_notice').count() === 1, `required field not created: ${await t.page.locator('#errorExplanation, #flash_error').allInnerTexts()}`);
await t.shot('required-field', 'Admin adds a required field "E2E required for support" to the Support tracker');
const fieldUrl = t.page.url();

await t.login('manager');
await newIssue('Bug', `E2E failing subtask ${stamp}`);
await t.page.locator('#subtasks_form label.floating', { hasText: 'Feature' }).locator('input').uncheck();
await submit('create with a failing subtask');
expect(/\/issues\/\d+$/.test(t.page.url()), `parent not created: ${t.page.url()}`);
const error = await t.page.locator('#flash_error').innerText().catch(() => '');
// the field name as core's own error messages humanize it ("E2e ...")
expect(/The subtask could not be created: Support: E2E required for support cannot be blank/i.test(error), `error flash: "${error}"`);
expect(await t.page.locator('#flash_notice').count() === 1, 'no "created" notice next to the error');
expect((await children()).length === 0, 'a subtask was created anyway');
await t.shot('failure', 'Forced Support subtask fails on a required field: the parent is created and the error names the tracker and the field');

await t.login('admin');
await t.go('/custom_fields?tab=IssueCustomField');
t.page.on('dialog', d => d.accept().catch(() => {}));
await t.page.locator('tr', { hasText: 'E2E required for support' }).locator('a.icon-del').click();
await t.sudo();
await t.settle();
t.check(`delete required field (${fieldUrl})`);

await t.login('manager');
await deleteRules(t, P);
await t.go(parentUrl);
await t.done();
