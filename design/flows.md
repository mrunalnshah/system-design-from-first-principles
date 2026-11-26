# Flows: System Design from First Principles (website)

The header (book title → Home, name → About, Contents, Articles, portfolio) is on every screen, so every screen reaches every top-level screen in one step.

```mermaid
flowchart LR
  home[Home /] -->|Read from the start| ch1[Chapter 1]
  home -->|Contents| contents[Contents /book/]
  home -->|featured chapter card| chN[Chapter N]
  home -->|article row| art[Article]
  home -->|All articles| arts[All articles /articles/]
  contents -->|chapter or section| chN
  chN -->|Previous / Next, ← →| chN
  chN -->|book title in the chapter menu| contents
  chN -->|diagram| viewer[Diagram viewer]
  viewer -->|Escape / close| chN
  arts --> art
  art -->|All articles| arts
  art -->|Read the book| contents
  header((Header)) --> about[About /about/]
  about -->|Portfolio| portfolio[(mrunalnshah.github.io)]
  bad[Unknown address] --> nf[404]
  nf -->|Read from the start| ch1
```

## Preview order (Gate GD)
1. J1: Home → Chapter 1 (light, then dark) → diagram viewer → Next / last chapter state.
2. J2: Home → featured chapter card → chapter menu (wide and phone sheet) → Contents.
3. J3: Home → article row → Article → All articles (default and empty).
4. J6: Header name → About → portfolio link.
5. 404.
6. J5 (publish) has no screen of its own; the preview shows a sample build-error message instead.
