# Dev environment (operational detail behind qa/CLAUDE.md §1)

- Home Assistant 2026.9.4 runs natively on Windows from a per-session scratchpad venv (`venv314`,
  Python 3.14). Launcher `ha_launch.py -c <config> --ignore-os-check --skip-pip` (stubs signal
  handlers and modules HA cannot load on Windows).
- The scratchpad lives under the Claude session temp folder and does **not** survive the session.
  A new session must rebuild the venv and instances (recipe in the harness memory).
- Each instance: `haconfig-<port>/`, `custom_components/easy_sidebar_pro` is a **junction** to the
  repo → code edits take effect for every instance (JS: on reload; Python: on restart).
- Seed: `esp_seed.py <port> qa/fixtures/dev-accounts-<port>.json` (onboarding as `qa_admin` with
  language Hebrew, `qa_user` non-admin, the config entry, four extra dashboards: two Hebrew titles,
  one 47-character English title).
- Traps:
  - Instances started inside a script die with the script; start each as its own background task.
  - Access tokens expire after 30 minutes; use the login flow with the fixture password.
  - Never edit config files with Windows PowerShell 5.1 `Get-Content`/`Set-Content`: it corrupts
    UTF-8 Hebrew and HA then refuses to start.
  - `turbojpeg` / `google_translate` errors in the HA log are environmental, unrelated.
  - **HA 2026.9 keeps the HTTP port in `.storage/http`** (`stable` / `pending`). A fresh instance
    imports the yaml `server_port` as *pending*; unless promoted (WS `http/config/promote`) within
    5 minutes, HA reverts to `stable` (8123) and restarts itself. The launcher does not relaunch, so
    the instance vanishes or reappears on 8123 (and a second instance then fails to bind). Fix:
    promote right after seeding, or with HA stopped set `stable.server_port` to the port and
    `pending` to null.
  - Background launcher tasks are killed at their time limit (default 30 min): start instances with
    the maximum limit.
  - HA resolves the static path through the junction **at startup**: re-pointing an instance's
    junction to another checkout needs an HA restart (until then the module URL 404s or serves the
    old target).
  - First login on a seeded instance may show HA's "approve new HTTP config" dialog with a countdown;
    confirm it (or promote via WS) or the port reverts.
  - Config entry reload: REST `POST /api/config/config_entries/entry/<id>/reload` (no WS command).
  - Git Bash: prefix Windows Python with `MSYS_NO_PATHCONV=1` when an argument starts with `/api/...`;
    set `PYTHONIOENCODING=utf-8` when piping Hebrew JSON between processes (it corrupted a stored
    name once). A bare `python -` heredoc with no stdin hangs.
  - Playwright helpers for this product live in `~/.claude/qa-playwright/espjs/lib.mjs` (login,
    wait for HA's launch screen which swallows early clicks, `BASE_JS` to serve another checkout's
    module over a running instance).
  - Leak measurement: release `Runtime.queryObjects` object groups after each count, or the harness
    itself retains the counted elements and inflates the numbers (it did, PERF-003).
  - Dark theme in Playwright: `localStorage.selectedTheme = {"dark": true}` before load.
  - Each HA state change re-renders `ha-sidebar` (updates = state changes).
  - Synthetic touch: a tap sent right after a fast CDP touch swipe is swallowed by Chromium fling handling; end swipes at rest (a few moves at the final point) before tapping.
