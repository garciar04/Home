# 50K Trainer

A personal training app built from `50K_Plan_Jan23.xlsx` (17 weeks, 28 Sep 2026 → race Sat 23 Jan 2027).
No build step, no dependencies. It runs as an installable phone app (PWA).

**Run it:** `cd app && python3 -m http.server 8000`, then open http://localhost:8000.
On a phone, host the folder over HTTPS (e.g. GitHub Pages) and use "Add to Home Screen".
Add `?date=2026-10-15` to the URL to preview any day.

**Tabs:** Today (brief + log) · Plan (all 119 days) · Progress (charts, weekly summary) · Knee (gate, return-to-run ladder, pain rules) · Fuel (calculator + timeline) · Race (pacing, stop rules, checklist) · More (paces, shoes, gear, strength log, backup).

Logged data stays in the browser (localStorage). Use More → Export backup to save it.
