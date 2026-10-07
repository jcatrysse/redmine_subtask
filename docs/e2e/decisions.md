# decisions

Run 2026-10-07T16:17:28.900Z against http://127.0.0.1:3000.

| screenshot | user | URL | shows |
|---|---|---|---|
| ![](decisions-admin-created.png) | admin | `/issues/48` | admin: Feature (ticked) and Support (forced) subtasks created |
| ![](decisions-manager-created.png) | manager | `/issues/51` | manager: Feature (ticked) and Support (forced) subtasks created |
| ![](decisions-q1-reporter.png) | reporter | `/issues/54` | q1: reporter without "Create subtasks" sees no choices but gets the forced Support subtask |
| ![](decisions-q2-reporter-api.png) | reporter | `/issues/56` | q2: reporter asks for the Feature subtask through the API: refused silently, only the forced Support one |
| ![](decisions-q1-outsider.png) | outsider | `/issues/58` | q1: outsider (non-member) creating a Bug in the public project also gets the forced Support subtask |
| ![](decisions-outsider-private-refused.png) | outsider | `/projects/e2e-private/issues/new` | Outsider: new issue in the private project is refused (403) |
| ![](decisions-q3-role.png) | admin | `/roles` | Admin saved the Reporter role with "Add issues" limited to the Bug tracker (Successful update) |
| ![](decisions-q3-refused-tracker.png) | reporter | `/projects/e2e-project/issues/new` | Refusal: the reporter can only choose Bug, not Support, for a new issue |
| ![](decisions-q3-created.png) | reporter | `/issues/60` | q3: the rule decides: the reporter's Bug still gets its forced Support subtask |
