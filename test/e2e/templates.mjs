// With redmine_issue_templates: choosing the template a subtask gets, where
// the seeded project template and global template share id 1, and the
// description the created subtask receives from it.
import { createRequire } from 'node:module';
import { e2e } from '../../.codex/e2e/lib.mjs';

const { ruleRows, addRule, deleteRules } = createRequire(import.meta.url)('./support.cjs');
const P = 'e2e-project';
const t = await e2e('templates');
const expect = (cond, msg) => { if (!cond) t.problems.push(msg); };

async function chooseTemplate(label) {
  await t.go(`/projects/${P}/subtask_settings/show`);
  const select = ruleRows(t).first().locator('select[name=template]');
  if (label) await select.selectOption({ label }); else await select.selectOption({ index: 0 });
  await ruleRows(t).first().locator('input[type=submit]').click();
  await t.settle();
  t.check(`choose template ${label}`);
  const shown = await ruleRows(t).first().locator('select[name=template] option:checked').innerText();
  expect(shown.trim() === (label || ''), `template shown after saving "${label}": "${shown}"`);
}

async function childDescription(subject) {
  await t.go(`/projects/${P}/issues/new`);
  await t.page.fill('#issue_subject', subject);
  await t.page.fill('#issue_description', 'Parent description, not for the subtask.');
  await t.page.click('#issue-form input[name=commit]');
  await t.settle();
  t.check(`create ${subject}`);
  await t.page.locator('#issue_tree tr.issue td.subject a').first().click();
  await t.settle();
  return (await t.page.locator('div.issue div.description').innerText().catch(() => '')).trim();
}

await t.login('manager');
await deleteRules(t, P);
await addRule(t, P, 'Bug', 'Feature', { force: true });
const options = await ruleRows(t).first().locator('select[name=template] option').allInnerTexts();
expect(options.includes('E2E project template') && options.includes('E2E global template'), `template options: ${JSON.stringify(options)}`);

await chooseTemplate('E2E project template');
await t.shot('project-template', 'Project template chosen (id 1, same id as the global template): it stays selected after saving');
let text = await childDescription(`E2E project template ${Date.now()}`);
expect(text.includes('Project template text.') && text.includes('step two'), `subtask description with the project template: "${text}"`);
await t.shot('project-template-child', 'The Feature subtask got the project template as description, not the parent\'s or the global one');

await chooseTemplate('E2E global template');
await t.shot('global-template', 'Global template chosen: it stays selected after saving');
text = await childDescription(`E2E global template ${Date.now()}`);
expect(text.includes('Global template text.'), `subtask description with the global template: "${text}"`);
await t.shot('global-template-child', 'The Feature subtask got the global template as description');

await chooseTemplate('');
text = await childDescription(`E2E no template ${Date.now()}`);
expect(text === '', `subtask description without a template: "${text}"`);
await t.shot('no-template-child', 'No template: the subtask has an empty description (the parent\'s is not copied)');

await deleteRules(t, P);
await t.done();
