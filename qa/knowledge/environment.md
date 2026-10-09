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
  - Dark theme in Playwright: `localStorage.selectedTheme = {"dark": true}` before load. **But** once a
    theme is chosen in the page (profile picker, or a `settheme` event), HA 2026.9 stores it in the
    user's server data (`frontend/set_user_data` key `theme`), which then wins over localStorage on every
    load: set `{"dark": true}` there (WS) instead, or the "dark" run silently renders light (v0.3 cycle).
  - The sidebar does NOT re-render on a theme change alone (`ha-sidebar.shouldUpdate` ignores
    `hass.themes`); on a quiet dev instance it may not re-render for minutes. Anything computed in our
    render from the theme is stale until then (BUG-015). Navigation forces a re-render.
  - HA's Edit sidebar dialog (2026.9) can be driven without drag: hold action on `.menu`
    (`action` event, `{action: "hold"}`), then `value-changed` `{order, hidden}` on its
    `ha-items-display-editor`, then `dialog._save()`. Setting `_order` / `_hidden` directly does nothing.
  - Only one HA version per port: to check an older HA on your own port, copy that version's config dir,
    change `server_port` in both `configuration.yaml` and `.storage/http`, and junction the code under test.
  - Each HA state change re-renders `ha-sidebar` (updates = state changes).
  - Synthetic touch: a tap sent right after a fast CDP touch swipe is swallowed by Chromium fling handling; end swipes at rest (a few moves at the final point) before tapping.
  - Compatibility instances (2026-10-01): venvs `venv-<ha version>` built with uv from `extras.txt`, then
    component requirements pinned from that version's own manifests (an unpinned `hassil` broke 2026.5:
    `No module named 'hassil.fuzzy'`, frontend stuck on "Loading data"). Ports 8150 (2026.5.4),
    8151 (2026.6.4), 8152 (2026.7.4), 8153 (2026.8.3). The HTTP-config confirm dialog / 5-minute revert
    exists from 2026.8; its modal steals focus from the page (looked like a keyboard bug).
  - Smoke suite: `~/.claude/qa-playwright/espjs/compat.mjs` (PORT=…): status, render, fold, keyboard open ×5,
    list registration, drag-merge-save, HA order adoption.
  - Seeded instances set the core language to Hebrew, so `qa_user` is Hebrew too. For an English user send, as that user,
    `frontend/set_user_data` key `language` value `{"language": "en", "number_format": "language", "time_format": "language", "date_format": "language", "time_zone": "local", "first_weekday": "language"}` and reload.
  - HA's fixed (bottom) list is 255 px wide in the expanded sidebar (the sidebar's 1 px border): grid cell widths must fit 255, not 256 (v0.3 pinned grid wrapped to 3 columns).
  - **Agent types (2026-10-09):** a session hook (talk-progress plugin) refuses every tool call of a subagent until it
    publishes a task list with `mcp__talk-progress__progress`. The restricted `qa-*` agent types have no ToolSearch, so
    they cannot load that tool and stop at once (all five did). Dispatch them as `general-purpose` agents told to read
    `~/.claude/agents/qa-<role>.md` and to load the progress tool through ToolSearch first.
  - Ports used by the v0.5 cycle: 8170 (manager), 8171 engineer, 8172 UX, 8173 a11y, 8174 security, 8175 perf; venv and
    configs in that session's scratchpad (gone with it). A test venv for pytest needs `home-assistant-frontend` matching
    the HA version pytest-homeassistant-custom-component pulls (2026.10.0 -> 20260930.2).
