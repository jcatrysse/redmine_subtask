// Shared steps for this plugin's scenarios (CommonJS, so e2e.sh, which runs
// every test/e2e/*.mjs, does not run it as a scenario).

// The rows of the existing rules on the settings page; the "add" form is a
// separate table inside its own form.
function ruleRows(t) {
  return t.page.locator('#content > div.box.tabular > table > tbody > tr');
}

// Adds a rule through the settings page as the logged-in user.
async function addRule(t, project, parent, child, { byDefault = false, force = false, inherit = false } = {}) {
  await t.go(`/projects/${project}/subtask_settings/show`);
  const form = t.page.locator('form[action$="/subtask_settings/create"]');
  await form.locator('select[name=parent]').selectOption({ label: parent });
  await form.locator('select[name=child]').selectOption({ label: child });
  if (byDefault) await form.locator('input[name=default]').check();
  if (force) await form.locator('input[name=auto]').check();
  if (inherit) await form.locator('input[name=inheritance]').check();
  await form.locator('input[type=submit]').click();
  await t.settle();
  t.check(`add rule ${parent} -> ${child}`);
}

// Deletes every rule of the project through the delete links (with the confirmation).
async function deleteRules(t, project) {
  await t.go(`/projects/${project}/subtask_settings/show`);
  t.page.on('dialog', d => d.accept().catch(() => {}));
  for (let i = 0; i < 20; i += 1) {
    const link = t.page.locator('a.icon-del[data-method=delete]').first();
    if (!(await link.count())) break;
    await link.click();
    await t.settle();
  }
  t.check('delete rules');
}

module.exports = { ruleRows, addRule, deleteRules };
