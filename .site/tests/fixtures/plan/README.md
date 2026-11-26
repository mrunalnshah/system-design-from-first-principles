# Fixture: a minimal, valid plan for the plan checker (TOOL-03)
Every check passes on this folder as it is. Tests copy it to a temp folder and seed one defect at a time.
`.site/tests/demo.tagged.ts` carries the `@req` tags for the done task. The checker counts code under `.site/tests/` as test evidence; the file isn't named `*.test.ts`, so vitest never runs it.
