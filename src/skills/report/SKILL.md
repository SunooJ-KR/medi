---
name: report
description: Render self-contained HTML reports from validated reaction runs.
---

# Report

Use this skill to create a self-contained HTML report in `reports/`.

Rules:
- Require a validated reaction run.
- Include summary, visualizations, details, change tracking, and limitations.
- Show low confidence reactions distinctly.
- Do not use external network resources or CDN links in the generated HTML.
- Run validation before rendering.
