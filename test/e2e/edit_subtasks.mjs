// Edit issue form: "Create new subtasks" with the count of existing subtasks
// per tracker, creating one on update, an update that creates none, and a
// member without the permission.
import { createRequire } from 'node:module';
import { e2e } from '../../.codex/e2e/lib.mjs';

const { addRule, deleteRules } = createRequire(import.meta.url)('./support.cjs');
const P = 'e2e-project';
const t = await e2e('edit-subtasks');
const expect = (cond, msg) => { if (!cond) t.problems.push(msg); };
const children = async () => (await t.page.locator('#issue_tree tr.issue td.subject').allInnerTexts()).map(s => s.trim());
const choice = tracker => t.page.locator('#subtasks_form label.floating', { hasText: tracker });

async function save(step, notes) {
  await t.page.fill('#issue_notes', notes);
  await t.page.click('#issue-form input[name=commit]');
  await t.settle();
  t.check(step);
}

await t.login('manager');
await deleteRules(t, P);
await addRule(t, P, 'Bug', 'Feature', { byDefault: true });
await addRule(t, P, 'Bug', 'Support', { force: true });

// a Bug with only its forced Support subtask
await t.go(`/projects/${P}/issues/new`);
await t.page.fill('#issue_subject', `E2E edit parent ${Date.now()}`);
await choice('Feature').locator('input').uncheck();
await t.page.click('#issue-form input[name=commit]');
await t.settle();
t.check('create parent');
const issuePath = new URL(t.page.url()).pathname;
expect((await children()).length === 1, 'parent does not start with one subtask');

await t.go(`${issuePath}/edit`);
expect(await t.page.locator('#subtasks_form > label', { hasText: 'Create new subtasks' }).count() === 1, 'no "Create new subtasks" on the edit form');
expect((await choice('Support').innerText()).includes('(required, 1 exists already)'), `Support label: ${await choice('Support').innerText()}`);
expect((await choice('Feature').innerText()).includes('(none exist yet)'), `Feature label: ${await choice('Feature').innerText()}`);
expect(await choice('Feature').locator('input').isChecked(), 'Feature (by default, none yet) not ticked');
expect(!(await choice('Support').locator('input').isChecked()), 'Support (already there) ticked');
await t.shot('edit-form', 'Edit: Support "(required, 1 exists already)" unticked, Feature "(none exist yet)" ticked by default');

await save('update with Feature', 'Adding the Feature subtask.');
expect(await t.page.locator('#flash_notice').count() === 1, 'no update notice');
let kids = await children();
expect(kids.length === 2, `subtasks after update: ${JSON.stringify(kids)}`);
await t.shot('updated', 'Saved: the Feature subtask is created next to the existing Support one, the note is kept');

await t.go(`${issuePath}/edit`);
expect((await choice('Feature').innerText()).includes('(1 exists already)'), `Feature label after: ${await choice('Feature').innerText()}`);
expect(!(await choice('Feature').locator('input').isChecked()), 'Feature ticked again although it exists');
await t.shot('edit-form-again', 'Edit again: Feature now "(1 exists already)" and no longer ticked');
await save('update without subtasks', 'Only a note.');
kids = await children();
expect(kids.length === 2, `an update without ticks created subtasks: ${JSON.stringify(kids)}`);

await t.go(`${issuePath}/edit`);
await choice('Support').locator('input').check();
await save('update with a second Support', 'A second Support subtask on purpose.');
kids = await children();
expect(kids.length === 3, `ticking an existing tracker again: ${JSON.stringify(kids)}`);
await t.shot('second-support', 'Ticking Support again creates a second Support subtask, as asked');

await t.login('reporter');
await t.go(`${issuePath}/edit`);
expect(await t.page.locator('#subtasks_form').count() === 0, 'reporter sees "Create new subtasks"');
await t.shot('reporter-edit', 'Reporter (core role without "Edit issues" and without the plugin permission): notes-only form, no subtask choices');

await t.login('manager');
await deleteRules(t, P);
await t.done();
