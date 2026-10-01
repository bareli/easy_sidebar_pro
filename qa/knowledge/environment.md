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
