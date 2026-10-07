# Redmine 7 migration: redmine_subtask

Start a Claude Code (or Codex) session on this repository, branch `redmine70-migration`, with:

> Read CLAUDE.md and docs/REDMINE7-MIGRATION.md, then carry out the Redmine 7 migration of this
> plugin as described there, on branch redmine70-migration. That includes the plugin's tests on
> PostgreSQL and MariaDB, every function exercised end to end on a real running Redmine in a
> browser (with and without permissions, failure paths included) with screenshots you looked at,
> and an OpenAI review of the diff when OPENAI_API_KEY is set. Report to me in Dutch at the end.

This file is the plan and the memory of that work. Update it as you go: verdicts, results,
what is left. Written 2026-10-06 from a measured analysis (report at the bottom).

## Status

| | |
|---|---|
| Plugin id | `redmine_subtask` |
| GEOxyz runs today | `develop` |
| Upstream | geen |
| Runs on Redmine 7 as is | NEE (fixed on this branch: JA) |
| Upstream sync | GEEN UPSTREAM |
| After sync | n.v.t. |
| Complexity (1 trivial .. 5 rewrite) | 1 |
| Measured on | Redmine 7.0.1 (7.0-stable-GEOxyz + latest 7.0-stable), Rails 8.1.3.1, Ruby 3.3.6, PostgreSQL 16 and MariaDB 10.11 |
| Branch head when this file was written | `6182281` |
| Migration session | 2026-10-06: DONE, see "Results" below |
| Jan's decisions | 2026-10-07: q1-q3 recorded and pinned by tests (`0200529`), Redmine 7 / PostgreSQL only from now on |

## Already on this branch

- `f058fb5` Remove `unloadable`, gone with the classic autoloader in Rails 7.0 (comment corrected in `9814e65`)
- `c5b78f7` Only create the subtasks of rules that apply to the issue (security: foreign rule ids, permission, API 500)
- `7ab9bf6` Show the user which subtasks could not be created (work list 2)
- `dabc36b` Subtask settings: 404 for unknown rules and projects, redirect to the settings page
- `3016aac` Subtask settings: SVG icon on the delete link
- `4675ed1` Move the plugin's English UI texts into the locale
- `2a2d1fa` Test the redmine_issue_templates integration (work list 1)
- `b22f7c7` Keep project and global templates apart when choosing a subtask template
- `b850667`, `2059412`, `df82998` End-to-end scenarios, screenshots, before pictures
- `9814e65` Subtask: correct the comment on unloadable
- `269ef3c` Record Jan's decisions on the open questions (2026-10-07), `docs/DECISIONS-2026-10-07.md`
- `8d292f3` Tests: grant redmine_view_issue_description's permission when it is installed (combined run)
- `af3f365` Drop the code paths that existed only for Redmine 5.1 (Jan, 2026-10-07)
- `0200529` Jan's decisions q1-q3: a test and an e2e scenario for each
- `71c3b94` Plan: decisions recorded; OpenAI review of `a1a44bb..71c3b94`: no findings (`docs/reviews/openai-2026-10-07-71c3b94.md`)

## Work list for the migration session

In this order: things that break, security, the GEOxyz changes, the open items, then the checks.

**Open items from the analysis** (Dutch; where they conflict with a decision or a priority item above, those win)

1. Test together with redmine_issue_templates (template applied to child issue) - not installed here
   - DONE: installed redmine_issue_templates `redmine70-migration` (88ff916) next to it;
     `test/integration/subtask_templates_test.rb` (9 tests) and `test/e2e/templates.mjs`. Found and fixed
     a real bug on the way (`b22f7c7`): project and global templates number from 1 in separate tables,
     and choosing a project template whose id a global template also has stored and applied the
     global one. Reproduced on develop/5.1 in `docs/e2e/before/templates.md`.
2. createSubtasks swallows all exceptions into the log; failures are invisible to users
   - DONE (`7ab9bf6`): a flash error names the child tracker and the validation messages; each child
     in a savepoint; the root cause of the exception (custom values saved before the child existed,
     NOT NULL on `custom_values.customized_id`) removed. Before: `docs/e2e/before/create-subtasks.md`.

**Found during the session** (all done, each with tests that fail without the fix)

- Security (`c5b78f7`): the hooks took any rule id from the request: a rule of another project or
  another tracker, or one the user was never offered (no "Create subtasks" permission) created a
  child issue, also through the REST API. Now only the rules the form offers, and ticked ones only
  with the permission.
- API `PUT /issues/:id.json` without an `issue` hash answered 500 after saving (`c5b78f7`).
- `PUT`/`DELETE` of an unknown rule answered 500; unknown project raised outside Redmine's 404
  handling; `redirect_back(fallback_location: :back)` failed without Referer (`dabc36b`).
- Delete link without icon on Redmine 7 (`3016aac`); hardcoded English texts (`4675ed1`).

**Checks**

3. Run the plugin's whole test suite on Redmine 7.0-stable-GEOxyz with PostgreSQL AND MariaDB, and once on 5.1-stable if the branch is meant to stay 5.1-compatible.
   - DONE, see "Results". Since Jan's decision of 2026-10-07 only Redmine 7 with PostgreSQL is
     required; the MariaDB and 5.1 runs of 2026-10-06 stay as history, the 5.1-only code paths are
     removed (`af3f365`).
4. Check Redmine 7 webhooks against this plugin (see "Rules"), and note the result here even if nothing is needed.
   - DONE, nothing needed: the plugin adds no issue data; subtasks are saved through `Issue#save`, so
     core's `after_create_commit` sends `issue.created` for every subtask, with its parent.
     Proven by `test_subtask_creation_triggers_the_issue_created_webhook` and live in
     `test/e2e/api_webhook.mjs` (5 deliveries received: 2 parents, 3 subtasks with `parent.id`).
5. Verify every feature of the plugin by hand on a running Redmine 7 (screenshots).
   - DONE, see the inventory below and `docs/e2e/`.

## GEOxyz changes to review or re-apply

Own plugin: all of it is GEOxyz code, so there is nothing to re-apply. While migrating, hold the code you touch to the rules below; list larger quality problems you find in the work list instead of fixing them in passing.

## After the upgrade (production)

Actions the person doing the upgrade must take, or know about, for this plugin:

- No migration, data fix, setting or cron. Stored rules (including `template` and `global`) are used as
  they are.
- Rules saved on develop with a project template whose id a global template also had were stored as
  global (the bug fixed in `b22f7c7`). They now show the global template selected on the settings
  page; a project manager who meant the project template picks it again and saves. Query to find
  candidates: `SELECT * FROM subtasks WHERE global = true AND template IN (SELECT id FROM issue_templates)`
  (PostgreSQL; `global = 1` on MariaDB).
- Behaviour change users may notice: ticked (non-forced) subtasks are only created for users with
  the "Create subtasks" permission and only for rules the form offers. The form already showed them
  only to those users, so nobody loses something they could click.
- A failing subtask now shows a red message on the issue page instead of nothing.

## Results (session 2026-10-06)

Environment: Redmine 7.0.1 (7.0-stable-GEOxyz 8067e23), Rails 8.1.3.1, Ruby 3.3.6; PostgreSQL 16.15,
MariaDB 10.11.14; redmine_issue_templates `redmine70-migration` 88ff916. Redmine 5.1-stable with Ruby
3.2.6 for the compatibility run and the before pictures.

**Baseline before any change** (branch at 6509089, PostgreSQL): plugin tests `1 runs, 1 assertions,
0 failures`; smoke 12 screenshots 0 problems, core 6 screenshots 0 problems; no plugin scenarios.

**Plugin tests** (`./.codex/test_plugin.sh`, minitest: unit, functional, two integration files)

| Redmine | database | with redmine_issue_templates | result |
|---|---|---|---|
| 7.0-stable-GEOxyz | PostgreSQL 16 | yes | 51 runs, 266 assertions, 0 failures, 0 errors, 0 skips |
| 7.0-stable-GEOxyz | MariaDB 10.11 | yes | 51 runs, 266 assertions, 0 failures, 0 errors, 0 skips |
| 7.0-stable-GEOxyz | PostgreSQL 16 | no | 51 runs, 212 assertions, 0 failures, 9 skips (the template tests) |
| 5.1-stable | PostgreSQL 16 | no | 51 runs, 157 assertions, 0 failures, 11 skips (templates, SVG icon, webhooks) |

Migrations down to 0 and up again: OK on PostgreSQL and MariaDB (`custom_fields` is `json` on
PostgreSQL, `longtext` on MariaDB, both work). Production eager load: OK (`eager_load=true`, server
boots in production mode).

**End to end** (`./.codex/e2e.sh`, production mode, `start_server.sh --reset` first)

| Redmine / database | scripts | screenshots | problems |
|---|---|---|---|
| 7.0 / PostgreSQL (committed in `docs/e2e/`) | smoke, core + 6 plugin scenarios | 54 | 0 |
| 7.0 / MariaDB | smoke, core + 6 plugin scenarios | 54 | 0 |
| 5.1 / PostgreSQL, this branch | smoke, core + 5 plugin scenarios (api_webhook needs Redmine 7) | 52 | 0 |
| 5.1 / PostgreSQL, develop 4dab83d (`docs/e2e/before/`) | settings, create_subtasks, templates | 24 | 6, all old bugs fixed here |

Every screenshot was opened and looked at.

**Reviews**: own adversarial review of the whole diff (one wrong comment, fixed in `9814e65`);
OpenAI review (gpt-5, `origin/develop..9814e65`): no findings, `docs/reviews/openai-2026-10-06-9814e65.md`.

**Together with other GEOxyz plugins**: run with redmine_issue_templates only (the one this plugin
integrates with). The full combination runs in the coordinator's harness, which is not in this repo.

### Session 2026-10-07 (Jan's decisions)

Redmine 7.0-stable-GEOxyz 8067e23, PostgreSQL 16.15, Ruby 3.3.6.

| run | result |
|---|---|
| plugin tests, with redmine_issue_templates | 52 runs, 273 assertions, 0 failures, 0 errors, 0 skips |
| plugin tests, with all 34 public GEOxyz plugins on `redmine70-migration` (list below) | 52 runs, 273 assertions, 0 failures, 0 errors, 0 skips |
| e2e alone, after `start_server.sh --reset` (`docs/e2e/`) | smoke, core + 7 plugin scenarios, 63 screenshots, 0 problems |
| e2e with all 34 plugins (not committed) | see below |

The combined run installed, each at its `redmine70-migration` head of 2026-10-07: redmine_more_previews,
bless_this_redmine_sso, redmine_ai_summary, issue_recurring, redmine_issue_todo_lists2,
calendar_events_daily, redmine_custom_workflows, redmine_drawio, that_attachments_limit,
redmine_view_issue_description, redmine_user_specific_theme, redmine_tint_issues,
redmine_reporter_dashboards, redmine_stealth, redmine_project_workflows, computed_custom_field,
redmine_parent_child_filters, redmine_mail_digest, redmine_ldap_sync, redmine_itil_priority,
redmine_issue_templates, redmine_issue_field_visibility, redmine_extended_api, redmine_impersonate,
redmine_editauthor, view_customize, custom_field_sql, redmine_issue_view_columns,
redmine_depending_custom_fields, redmine_inline_edit_issues, redmine_wiki_extensions,
redmine_paste_as_wiki_tables, redmine_mermaid_macro, redmine_description_macros. The private
RedmineUP plugins (agile, checklists, contacts, helpdesk, people, tags, zenedit) and redmine_ai_triage
were not installed.

Findings of the combined run, none caused by this plugin (it patches no core method):
- **Project > Settings answers HTTP 500** (`/projects/e2e-project/settings`, also `/settings/info`):
  `super: no superclass method 'project_settings_tabs'`, the `alias_method` + `prepend` mix Jan
  described; trace through redmine_mail_digest (`project_settings_tabs_with_issue_digest`, alias_method)
  and the prepends of redmine_itil_priority, redmine_ai_summary, redmine_wiki_extensions,
  redmine_custom_workflows, redmine_issue_view_columns, redmine_project_workflows,
  redmine_reporter_dashboards. To fix in redmine_mail_digest. Because of it inheritance.mjs (which
  switches the module in Project > Settings) cannot run in the combination.
- **redmine_view_issue_description** answers 403 on issue pages, edit forms and `GET /issues/:id.json`
  for roles without its `view_issue_description` permission (the seeded Reporter), and changes the
  description markup: the reporter steps of core.mjs, create_subtasks.mjs, edit_subtasks.mjs and
  api_webhook.mjs, and the description check of templates.mjs, fail there for that reason. Checked
  directly instead: the reporter's API issue got only its forced Support subtask, and the template
  descriptions are stored correctly (`Project template text.`, `Global template text.`, empty).
  The plugin's tests give the test role that permission when the plugin is installed (`8d292f3`).
- The issue list and the issue page answer 200 as admin in the combination (smoke).
- Note: shoulda-context (from another plugin's Gemfile) crashes minitest 6's failure reporter
  (`undefined local variable or method 'executable'`), so a failing test in the combined checkout
  aborts the run instead of being listed.

### Inventory of functions

| function | how a user reaches it | scenario | screenshots |
|---|---|---|---|
| Project module "Subtasks", permissions "Subtask settings" and "Create subtasks" | Project settings > Modules; Roles | inheritance.mjs (module off), settings.mjs (reporter) | inheritance-module-off, settings-reporter-no-menu |
| Project menu "Subtasks" (settings page), empty state | Project menu | settings.mjs | settings-empty |
| Add a rule | Subtasks > Add | settings.mjs, all scenarios | settings-created |
| Update a rule (by default, by force, descendant projects, inherited custom fields) | Subtasks > Update | settings.mjs, create_subtasks.mjs | settings-updated, create-subtasks-rules |
| Delete a rule (confirmation) | Subtasks > Delete | settings.mjs | settings-deleted |
| Refusals: no permission 403, outsider 403, anonymous to login, unknown rule/project 404 | direct URLs | settings.mjs | settings-reporter-refused, settings-outsider-refused, settings-anonymous-login, settings-unknown-project |
| JSON list of rules `GET /projects/:id/subtask_settings` | URL (both permissions) | settings.mjs, api_webhook.mjs | smoke-11 |
| New issue form: "Create subtasks" (by default ticked, forced locked), tracker switch | New issue | create_subtasks.mjs | create-subtasks-new-form, create-subtasks-tracker-switch |
| Creating the subtasks: copy of the parent, empty description, inherited custom field only | New issue > Create | create_subtasks.mjs | create-subtasks-created, create-subtasks-child, create-subtasks-forced-only |
| Member without "Create subtasks": no choices, forced rules still apply | New issue as reporter | create_subtasks.mjs, api_webhook.mjs | create-subtasks-reporter-form, create-subtasks-reporter-created |
| Failure path: subtask cannot be saved, message shown | New issue | create_subtasks.mjs | create-subtasks-required-field, create-subtasks-failure |
| Edit form: "Create new subtasks" with counts, creating on update | Edit issue | edit_subtasks.mjs | edit-subtasks-edit-form, -updated, -edit-form-again, -second-support, -reporter-edit |
| Rules for descendant projects | New issue in a subproject | inheritance.mjs | inheritance-parent-rules, -sub-form, -sub-created |
| Module off in a project: nothing offered or created, settings 403 | Project settings | inheritance.mjs | inheritance-module-off, -module-off-created |
| Template for the subtask (redmine_issue_templates): project, global with the same id, none | Subtasks > template | templates.mjs | templates-project-template, -project-template-child, -global-template, -global-template-child, -no-template-child |
| REST API: create with forced and requested subtasks; forged rule; update without issue hash; no permission | `POST/PUT /issues.json` | api_webhook.mjs | api-webhook-api-parent |
| Webhooks (Redmine 7): `issue.created` for every subtask | My account > Webhooks | api_webhook.mjs | api-webhook-webhook |
| Jan's decisions q1-q3 as admin, manager, reporter, outsider (forced for everyone, ticked needs the permission, the rule decides over the child tracker), refusals: private project, tracker the role may not add | New issue, REST API, Roles | decisions.mjs | decisions-admin-created, -manager-created, -q1-reporter, -q2-reporter-api, -q1-outsider, -outsider-private-refused, -q3-role, -q3-refused-tracker, -q3-created |

No mail handling, rake tasks, cron or macros in this plugin. Mail notifications for created subtasks
are core's.

### Decided by Jan (2026-10-07)

Answered by Jan Catrysse on 2026-10-07 (`docs/DECISIONS-2026-10-07.md`). None needs a code change:
each keeps what was already built; each is now pinned by a test and `test/e2e/decisions.mjs`.

1. **q1, forced subtasks for users without "Create subtasks"**: A, "Zo laten: verplicht geldt voor
   iedereen" (De regel van het project geldt altijd, wie het issue ook aanmaakt.). Proven for reporter
   and outsider: decisions-q1-reporter, decisions-q1-outsider.
2. **q2, ticked subtasks through the API without the permission**: A, "Zo laten: recht en geldige regel
   nodig" (Het lek blijft dicht, en via de API gelden dezelfde regels als in het formulier.). Proven:
   decisions-q2-reporter-api, `test_creating_an_issue_ignores_selected_rules_without_permission`.
3. **q3, check the user's right to add the child tracker**: A, "Zo laten: de regel beslist" (De
   instelling van de projectbeheerder geldt, ook als de gebruiker dat type issue zelf niet mag
   aanmaken.). Proven: `test_forced_subtask_is_created_when_the_user_may_not_add_the_child_tracker`,
   decisions-q3-role, decisions-q3-refused-tracker, decisions-q3-created.

General decisions (every GEOxyz plugin): straight to Redmine 7, no 5.1 backports or 5.1-only code;
PostgreSQL 16 only; deface without version constraint (this plugin does not use deface); core methods
other plugins also patch are patched with `prepend`, never `alias_method` (this plugin patches no core
method: no `alias_method`, `prepend` or `class_eval` in `app/`, `lib/`, `init.rb`); GitHub Actions
manual only.

### Open questions for Jan

- **Template choice format** (`b22f7c7`, not part of the 2026-10-07 answers): option values are now
  `global-<id>` for global templates. A settings page left open during the upgrade would post a plain
  id, read as a project template. Recommendation: no fallback; nothing to do unless you want one.

### Left / deferred (not needed for Redmine 7)

- The settings page puts a `<form>` around each table row, which is invalid HTML (browsers still
  submit each row's own form; tested in Chromium on 5.1 and 7.0). A rewrite of that page is a layout
  change, not migration work.
- Creating a rule does not validate the tracker ids (a forged unknown id gives a rule that is never
  offered, because only trackers of the project are).
- An inherited custom value that is invalid for the child tracker reports its error on the parent
  object (unchanged from develop).
- Only `en.yml` ships; no other locale to keep in sync.
- Kit notes: `.codex/test_setup.sh` fails as root on PostgreSQL (`$SUDO -u postgres` with an empty
  `$SUDO`); worked around with `RMP_PROVISION_DB=0` and creating the role by hand.
  `.codex/redmine_clone.sh` with a `REDMINE_DIR` outside the plugin copies the plugin's own
  `redmine/` checkout into it; used rsync with `--exclude /redmine/` instead. After switching
  `database.yml` from MariaDB to PostgreSQL, `bundle install` is needed again (the `pg` gem).

## How to test

```sh
./.codex/redmine_clone.sh 7.0-stable-GEOxyz      # or 5.1-stable / 6.1-stable / 7.0-stable
./.codex/test_setup.sh                                 # RMP_DB=mariadb for MariaDB, RMP_PROVISION_DB=0 if a server runs
./.codex/test_plugin.sh                                # minitest + rspec of this plugin
```

```sh
./.codex/start_server.sh       # real Redmine (production mode) with this plugin, seeded users and projects
./.codex/e2e.sh                # browser: smoke over the plugin's pages, core issue flows, test/e2e/*.mjs
./.codex/openai_review.sh      # independent OpenAI review of the diff, only when OPENAI_API_KEY is set
```
Write one scenario per function in `test/e2e/<function>.mjs` (example at the top of
`.codex/e2e/lib.mjs`); screenshots and a table per scenario land in `docs/e2e/`. Users:
`admin`, `manager` (every permission), `reporter` (no plugin permissions), `outsider` (no
membership); password `Redmine7Test!`. Needs Node with Playwright and Chromium
(`npm install -g playwright && npx playwright install --with-deps chromium`).

On GitHub the same runs by hand only: Actions > "Redmine tests (manual)" > Run workflow (tick
"e2e" for the browser run; screenshots come back as an artifact).

The coordinator's harness (`plugin-check.sh` in the migration kit, kept outside this repo) adds a
browser smoke test of every page the plugin adds and runs all GEOxyz plugins together; the
results quoted in the analysis come from it.

## How the migration session works (same for every plugin)

1. **Start**: `git fetch && git checkout redmine70-migration && git pull`. Read this whole file,
   including the analysis report at the bottom. Do not reopen decisions recorded here.
2. **Baseline, before you change anything**:
   - the plugin's tests on Redmine 7.0-stable-GEOxyz with PostgreSQL;
   - a real running Redmine with this plugin (`./.codex/start_server.sh`) and the browser run
     (`./.codex/e2e.sh`: smoke over every page the plugin adds, plus the core issue flows).
   Write the numbers here. Something already broken now is a finding, not your regression.
3. **Inventory of functions**: list every function of the plugin in this file, in a table
   "function | how a user reaches it | scenario | screenshot". Take them from the README,
   `init.rb` (permissions, menus, settings, project modules), routes, hooks and view
   overrides, macros, mail handling, API endpoints, rake tasks and cron jobs. This table is the
   coverage list for step 8; a function that is not in it will not be tested.
4. **GEOxyz changes**: go through the table above, one item at a time. Each kept or re-made change
   is its own commit with a test that proves it. Record the verdict in the table.
5. **Work list**: then the numbered list, in order. One concern per commit.
6. **Portability**: everything must run on Redmine's supported databases (PostgreSQL,
   MySQL/MariaDB; SQLite where the plugin already supports it). Migrations must be reversible and
   are run down and up on PostgreSQL and MariaDB.
7. **Together**: run with the other GEOxyz plugins installed (the migration kit's harness, or
   `RMP_EXTRA_PLUGINS`). A failure that only appears in combination is a finding to record here.
8. **End to end, visually, every function**: on the real Redmine from `start_server.sh`
   (production mode, the way GEOxyz runs it), write one scenario per function in
   `test/e2e/<function>.mjs` with `.codex/e2e/lib.mjs` and run them with `./.codex/e2e.sh`.
   - Each function as the users that matter: `admin`, `manager` (every permission, the
     plugin's included), `reporter` (member without the plugin's permissions), `outsider`
     (no membership, private project must stay invisible).
   - The failure paths too: setting off, permission absent, empty state, invalid input, the
     value that used to raise. A refusal that is shown is evidence as much as a success.
   - One screenshot per function and per path, with a caption saying what it proves. Open
     every screenshot and look at it: a picture nobody looked at proves nothing. Commit them
     in `docs/e2e/` and list them in the inventory table.
   - Functions without a page (mail in and out, REST API, rake tasks, cron, webhooks): exercise
     them against the same running instance (mails land in `redmine/tmp/mails`, `t.mails()`
     reads them; API through `t.page.request`) and record command and result.
   - Before pictures where behaviour or layout changes: the branch GEOxyz runs today, on
     Redmine 5.1, same scenarios, `RMP_E2E_OUT=docs/e2e/before`.
9. **Independent review**: first your own, adversarial: re-read the whole diff as if someone
   else wrote it and you are paid to reject it. Then, **when `OPENAI_API_KEY` is set in the
   session**, `./.codex/openai_review.sh`: it sends the diff of this branch to an OpenAI model
   and writes `docs/reviews/openai-<date>-<sha>.md`. Every finding gets a `Resolution:` line
   there (fixed in <commit>, with a test, or why not). Fix, re-run the tests and the e2e set,
   and run the review again until it has nothing new that you accept. Without the key: write
   "OpenAI review: skipped, no OPENAI_API_KEY" in the report; never send code anywhere else.
10. **After the upgrade**: anything the production upgrade must do for this plugin (data fixes,
    settings, cron, files, removed features) goes into the section "After the upgrade".
11. **Finish**: update "Status", the inventory and the work list in this file, push
    `redmine70-migration`, and report: what changed, test numbers on both databases, e2e
    numbers (scenarios, screenshots, problems), the review result, what is left, what needs Jan.

### Stop and ask Jan when
- a GEOxyz change would be lost or behave differently for users;
- a new gem, a new setting with user impact, or a schema change not required by Redmine 7 seems needed;
- the change would send data to an external service (the OpenAI review of the code diff is the
  one exception Jan approved, and only when the key is present);
- upstream and GEOxyz disagree on behaviour and both are defensible.

## Rules

- **Target**: Redmine 7.0-stable-GEOxyz (https://github.com/jcatrysse/redmine), Rails 8.1, Ruby 3.3+.
  Core sources for comparison: branches `5.1-stable`, `6.1-stable`, `7.0-stable`, `7.0-stable-GEOxyz`.
- **Evidence**: never report a test, lint, browser check or review as passed without having seen
  it. Quote the summary lines; list the screenshots. "Should work" is not a result, and a green
  test suite is not proof that a feature works in the browser.
- **Tests**: never skip, delete or weaken a test. A test that encodes Redmine 5 markup or
  behaviour is updated to Redmine 7, with the reason in the commit. Every fix gets a test that
  fails without it.
- **Minimal diffs** in the plugin's own style. No reformatting, no unrelated refactoring.
  Something wrong elsewhere: write it down here, do not fix it in passing.
- **Security**: authorization on every action and entry point; `safe_attributes`, never
  `to_unsafe_hash` into `update`; no SQL built from params; no secrets in logs; no `html_safe` on
  user input.
- **Webhooks (new in Redmine 7)**: core sends issue payloads (core `issues/show.api.rsb`, rendered
  as the webhook owner) to webhook endpoints, past plugin hooks and controller patches. If the
  plugin hides, adds or changes issue data, make webhooks consistent with that or record why not.
- **Redmine 7 conventions**: SVG icons through `sprite_icon` (the `icon icon-*` CSS is gone),
  Propshaft assets under `assets/` (`/assets/plugin_assets/<id>/...`), the new header and user menu,
  `ContextMenus::*Controller`, Loofah-based text formatting, Chart.js as an ES module, sudo mode
  (on by default: `t.sudo()` in a scenario). The breaker list is in the migration kit's CHECKLIST.md.
- **Locales**: keep the locales the plugin ships in sync; translate a new key by matching the
  closest existing key in the same file, not from scratch; do not add new languages.
- **Redmine 7 only** (Jan, 2026-10-07): GEOxyz goes straight to Redmine 7; no backports to 5.1, no
  code paths that exist only for 5.1. `redmine70-migration` is what goes live.
- **PostgreSQL only** (Jan, 2026-10-07): production runs PostgreSQL 16; tests and e2e run on
  PostgreSQL. Keep SQL portable where that costs nothing; a MariaDB-only problem is a note, not a
  blocker.
- **Core patches** (Jan, 2026-10-07): a core method other plugins also patch is patched with
  `prepend`, never `alias_method`. Deface, when used, without a version constraint.
- **Git**: work on `redmine70-migration` only; never push to the default branch; never force-push
  a branch someone else uses. Descriptive commit messages (what and why). Push after every
  commit, together with the updated status in this file: a cloud session can stop at a usage
  limit, and work that is not pushed is lost with its container.
- **GitHub Actions**: manual only (`workflow_dispatch`). Do not add push, pull_request or schedule
  triggers.

## Definition of done

- All items of the work list are done or explicitly deferred with a reason, in this file.
- The plugin's tests are green on Redmine 7.0-stable-GEOxyz with PostgreSQL
  (numbers in this file); boot, production-like eager load, migrations up/down OK.
- Every function in the inventory exercised end to end on a real running Redmine, with and
  without permissions and on its failure paths; `./.codex/e2e.sh` green; screenshots looked at,
  committed in `docs/e2e/` and listed.
- Review done: your own, and the OpenAI review when the key is present, every finding resolved
  in `docs/reviews/`.
- No new failure when run together with the other GEOxyz plugins.
- "After the upgrade" lists every action production needs; "Status" is current.


## Analysis report (2026-10-06, Dutch)

# redmine_subtask
- Gebruikte branch: develop @ 4dab83d (2023-06-22) - plugin id redmine_subtask, versie 0.0.1
- Upstream: geen (eigen plugin van Robin Bailleul; GitHub-repo jcatrysse/redmine_subtask is geen fork)
- Fork t.o.v. upstream: n.v.t.
- Andere relevante branches: origin/claude/redmine7-rails8-compat (c7fc8c9, `unloadable` weg; hergebruikt via cherry-pick).
- Gemfile leeg (+ lege Gemfile.lock). 2 migraties (tabel `subtasks`, custom-fields-kolom). Tests: 1 triviale unit-test.

## 1. Werkt out of the box op Redmine 7?   NEE
- Harness (results/1006-090136-...): `FAIL eager load` en 5x HTTP 500 (issue tonen/nieuw/bewerken, subtask-instellingen): `undefined local variable or method 'unloadable' for class Subtask` - app/models/subtask.rb:2. Boot zelf OK (model lazy geladen), maar elke issue-pagina crasht via het hook-partial.

## 2. Upstream sync?   GEEN UPSTREAM

## 3. Werkt na sync op Redmine 7?   n.v.t.

## 4. Complexiteit en blokkers   score 1
- Blokkers:
  - app/models/subtask.rb:2 - `unloadable` - gefixt in f058fb5 (cherry-pick van c7fc8c9; commit-tekst zegt "since Rails 5.1", correct is Rails 7.0).
- Live geverifieerd na fix: module aangezet, regel aangemaakt via /projects/:id/subtask_settings/show (Bug -> Feature, verplicht), nieuw Bug-issue toont "Create subtasks: Feature (required)", na opslaan bestaat kind-issue #12 (Feature); regel bijwerken (PUT) en verwijderen (DELETE met rails-ujs-bevestiging) werken.
- Stille breuken:
  - lib/redmine_subtask/subtask_listener.rb `createSubtasks` vangt elke exception af en logt alleen (`rescue => e; Rails.logger.error e`): mislukt het aanmaken van een subtaak, dan ziet de gebruiker niets.
  - Integratie met redmine_issue_templates (`IssueTemplateSetting`, `GlobalIssueTemplate`, template per subtaak) niet getest: die plugin was niet geïnstalleerd.
  - `redirect_back(fallback_location: :back)` faalt als er geen Referer is (randgeval).
  - UI-teksten hardgecodeerd Engels; `icon icon-del` zonder SVG in 7.0 (cosmetisch).
- Overlap met Redmine 7 core: geen.
- Open werk voor ansif:
  - Samen met redmine_issue_templates testen (template op kind-issue, globale templates).
  - Overwegen fouten in `createSubtasks` zichtbaar te maken (flash of journal).

## Branch redmine70-migration
- Basis: origin/develop @ 4dab83d
- Commits: f058fb5 Remove `unloadable`, gone from ActiveSupport since Rails 5.1 (cherry-pick c7fc8c9)
- Eindresultaat harness (results/1006-100715-s3-redmine_subtask_redmine70-migration): OK bundle, boot 0.0.1, eager load, migraties dev+test, OK rollback naar 0 en terug, OK minitest 1 runs, 1 assertions, 0 failures, OK smoke 62/62 (2 plugin-routes)
- Rollback migraties: OK

