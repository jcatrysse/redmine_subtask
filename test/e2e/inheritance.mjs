// Rules applied to descendant projects: a rule of e2e-project with "Apply to
// descendant projects" works in e2e-sub, one without does not; and with the
// "Subtasks" module off in e2e-sub nothing is offered or created.
import { createRequire } from 'node:module';
import { e2e } from '../../.codex/e2e/lib.mjs';

const { addRule, deleteRules } = createRequire(import.meta.url)('./support.cjs');
const P = 'e2e-project';
const SUB = 'e2e-sub';
const t = await e2e('inheritance');
const expect = (cond, msg) => { if (!cond) t.problems.push(msg); };
const children = async () => (await t.page.locator('#issue_tree tr.issue td.subject').allInnerTexts()).map(s => s.trim());

async function setModule(enabled) {
  await t.login('admin');
  await t.go(`/projects/${SUB}/settings/info`);
  const box = t.page.locator('#project_enabled_module_names_subtasks');
  if (enabled) await box.check(); else await box.uncheck();
  await t.page.locator('form[id^=edit_project_] input[name=commit]').click();
  await t.settle();
  expect(await t.page.locator('#flash_notice').count() === 1, `module change not saved: ${t.page.url()}`);
  t.check(`module subtasks ${enabled ? 'on' : 'off'}`);
}

await t.login('manager');
await deleteRules(t, P);
await deleteRules(t, SUB);
await addRule(t, P, 'Bug', 'Feature', { force: true, inherit: true });
await addRule(t, P, 'Bug', 'Support', { force: true });
await t.shot('parent-rules', 'e2e-project: Bug -> Feature forced and applied to descendant projects, Bug -> Support forced for this project only');

await t.go(`/projects/${SUB}/issues/new`);
const labels = (await t.page.locator('#subtasks_form label.floating').allInnerTexts()).map(s => s.trim());
expect(labels.length === 1 && labels[0] === 'Feature (required)', `choices in the subproject: ${JSON.stringify(labels)}`);
await t.shot('sub-form', 'New Bug in e2e-sub: only the inherited Feature rule is offered (required)');
await t.page.fill('#issue_subject', `E2E sub parent ${Date.now()}`);
await t.page.click('#issue-form input[name=commit]');
await t.settle();
t.check('create in subproject');
let kids = await children();
expect(kids.length === 1, `subtasks in the subproject: ${JSON.stringify(kids)}`);
expect((await t.page.locator('#issue_tree tr.issue').first().innerText()).includes('Feature'), 'the subproject subtask is not a Feature');
await t.shot('sub-created', 'Created in e2e-sub: one Feature subtask from the inherited rule, none from the non-inherited one');

await setModule(false);
await t.shot('module-off', 'Admin turns the "Subtasks" module off in e2e-sub');
await t.login('manager');
await t.go(`/projects/${SUB}/issues/new`);
expect(await t.page.locator('#subtasks_form').count() === 0, 'choices shown with the module off');
await t.page.fill('#issue_subject', `E2E sub without module ${Date.now()}`);
await t.page.click('#issue-form input[name=commit]');
await t.settle();
t.check('create with module off');
kids = await children();
expect(kids.length === 0, `subtasks with the module off: ${JSON.stringify(kids)}`);
expect(await t.page.locator('#main-menu a.subtask-settings').count() === 0, 'menu item shown with the module off');
await t.shot('module-off-created', 'Module off in e2e-sub: no choices, no "Subtasks" menu, and the forced inherited rule creates nothing');
await t.go(`/projects/${SUB}/subtask_settings/show`, { status: 403 });

await setModule(true);
await t.login('manager');
await deleteRules(t, P);
await t.done();
