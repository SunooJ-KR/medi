---
name: persona-build
description: Build evidence-backed customer personas from research and approved taxonomy.
---

# Persona Build

Use this skill to draft, review, and save customer personas under `data/personas/`.

## Workflow

1. Require `data/config.yaml` and `data/taxonomy.yaml`. If either is missing, stop and tell the user to run `/setup`.
2. Preview the six proposed Meditherapy personas:

```powershell
node src\scripts\persona-build.mjs
```

3. Show a Korean review table with persona id, name, market, concerns, channels, and evidence count. Ask for approval before writing.
4. After approval, save the personas:

```powershell
node src\scripts\persona-build.mjs --write
```

5. Use `--refresh` to compare the proposed personas with existing files and explain the diff. Use `--force` only after explicit approval to overwrite existing persona YAML.

## Rules

- Every persona attribute that makes a customer claim must be grounded in the `evidence` list.
- Save reviewed personas as `status: confirmed`; never save evidence-free personas.
- Keep confirmed personas at 10 or fewer.
- Treat `node src\scripts\validate.mjs data/` failure as blocking.
- End with the generated file list, validation result, and next step: Phase 2 event pipeline.
