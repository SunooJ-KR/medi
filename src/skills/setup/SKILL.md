---
name: setup
description: Initialize config.yaml and taxonomy.yaml for the Meditherapy market simulator.
---

# Setup

Use this skill to create or refresh `data/config.yaml` and `data/taxonomy.yaml`.

## Workflow

1. Read `docs/research.md` when available and inspect whether `data/config.yaml` or `data/taxonomy.yaml` already exists.
2. Preview the proposed runtime data:

```powershell
node src\scripts\setup.mjs
```

3. Show the user a concise Korean confirmation summary covering company, markets, channels, competitors, scan keywords, and taxonomy concerns.
4. After approval, write missing files:

```powershell
node src\scripts\setup.mjs --write
```

5. Use `--force` only when the user explicitly approves overwriting existing `data/config.yaml` or `data/taxonomy.yaml`.

## Rules

- Preserve existing files by default; the script skips existing files unless `--force` is passed.
- Do not proceed if the user rejects the company profile, markets, channels, competitors, or taxonomy.
- Treat validation failure as blocking and ask only for the field that failed.
- Never bypass `node src\scripts\validate.mjs`.
- End with the generated file list and the next step: run `/persona-build`.
