# QA overlay: Easy Sidebar Pro

Read `~/.claude/qa-kit/RULEBOOK.md` first, then `qa/PROJECT.md`. This file adds this project's
specifics under the same § numbers. Where it contradicts the rulebook, it wins here, and says so.

## §1 Environments

| Env | Base URL | Storage | Writes |
|---|---|---|---|
| `dev` | `http://127.0.0.1:<port>` (one Home Assistant per agent, see §4) | the instance's `.storage/` | Allowed |
| `prod` | **none**. There is no hosted production. Never touch anyone's real Home Assistant. | - | - |

The dev instances are Home Assistant 2026.9.x run natively on Windows from a session scratchpad venv
(`venv314`). Details, launcher and traps: `qa/knowledge/environment.md`.

Credentials: `qa/fixtures/dev-accounts-<port>.json` (git-ignored): `base`, `admin` (`qa_admin`,
owner) and `user` (`qa_user`, non-admin) with username / password. Access tokens in it expire after
30 minutes; log in again (login flow) rather than trusting a stored token.

### Storage access

Read `<config>/.storage/easy_sidebar_pro` (our store) and `<config>/.storage/frontend.user_data_<user_id>`
(HA's per-user data, key `sidebar`). Writes go through the websocket API only, never by editing files
while HA runs.

## §2 Boundaries

See `PROJECT.md` → *Paths*. The instances load the integration from the repo through a directory
junction, so **a finder must never edit `custom_components/`**: it changes the code under test for
every agent at once.

## §3 Builds

No build. Full suites:

```bash
S=<scratchpad>
PYTHONPATH="$S" "$S/venv314/Scripts/python.exe" -c "import win_shim,sys,pytest;sys.exit(pytest.main(['-q','-p','no:cacheprovider','tests']))"
npm test
```

JS changes need only a browser reload (the static path is served without cache headers; the module
URL carries `?v=<version>`). Python changes need an HA restart.

## §4 Instances

| Port | Owner of the instance in a full cycle | Notes |
|---|---|---|
| 8129 | qa-engineer | also has Good Days installed (one more panel) |
| 8137 | qa-ux-expert | |
| 8138 | qa-accessibility-expert | |
| 8139 | qa-security-expert | |
| 8140 | qa-performance-engineer | |

Each one: `qa_admin` + `qa_user`, Easy Sidebar Pro config entry, extra dashboards so the sidebar has
more panels. An instance started by a subagent dies with that agent's turn: the orchestrator starts
them. Check before use: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/api/` → 401.

**Proving the build**: `curl -s http://127.0.0.1:<port>/easy_sidebar_pro_static/easy-sidebar-pro.js | grep -c '<string from the fix>'`.

## §8 Specs

None yet.
