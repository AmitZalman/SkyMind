# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SkyMind is a Hebrew (RTL) Progressive Web App for drone license exam preparation. It uses spaced repetition learning, gamification, and offline-first design. **No frameworks or build tools** — pure vanilla JavaScript, HTML5, and CSS3 with zero external dependencies.

## Running the Application

```bash
# Recommended
python3 -m http.server 8000
# Open http://localhost:8000

# Alternative
npx serve .

# Bypass Service Worker cache
# http://localhost:8000?nocache=1
```

## Data Pipeline

Questions flow through a rules-based transformation pipeline:

```
data/questions.source.json  →  scripts/apply_rules.py  →  data/questions.json
                                      ↑
                                 rules.json
```

To regenerate questions locally:
```bash
python scripts/apply_rules.py
```

This runs automatically via GitHub Actions when `rules.json`, `data/questions.source.json`, or `scripts/**` change. Do **not** edit `data/questions.json` directly — it is auto-generated.

## GitHub Actions

- **bump_version.yml**: Auto-updates `version.json` on every push to `main` (timestamp + short SHA). Do not edit `version.json` manually.
- **update_questions.yml**: Regenerates `data/questions.json` from source + rules when relevant files change.

## Architecture

### Module Map (`js/` directory)

| Module | Responsibility |
|--------|---------------|
| `state.js` | Centralized global state object (single source of truth) |
| `storage.js` | localStorage persistence with versioned migration support |
| `router.js` | Hash-based SPA routing (`#/home`, `#/quiz`, `#/cms`, etc.) with screen history stack |
| `ui.js` | UI rendering, theme toggling (dark/light), modals, toasts |
| `sr.js` | SM-2 spaced repetition algorithm, mastery tracking, due-question scheduling |
| `gamification.js` | XP, 10 rank levels, 26 achievements, daily/session streaks |
| `quiz.js` | Quiz logic: Smart Tutor, Topic modes (Normal/Failed/Mastered/Infinite), Exam mode |
| `cms.js` | Password-protected (`skymind`) question editor, topic management, CRUD |
| `importer.js` | Import/export: JSON, TXT, full backup |

`app.js` is the bootstrap entry point that initializes all modules.

### Key Patterns

- **State**: All app state lives in the global `state` object defined in `state.js`. Modules read/write to it directly.
- **Storage**: `storage.js` handles serialization to localStorage with versioned keys (e.g., `v3_2_1_hebrew_subtopics`). Includes migration logic for schema changes.
- **Question Selection Engine (QSE)**: 5 configurable profiles (`balanced`, `due_focus`, `weak_focus`, `new_focus`, `exam_prep`) that weight question selection by category (due/weak/new/random).
- **Service Worker** (`sw.js`): Network-first for HTML/JSON, cache-first for static assets. `version.json` always bypasses cache. Cache version is `v3.2.1-hebrew-subtopics`.
- **Question IDs**: Format `q_XXXXX_hash` — generated during normalization with collision handling.

### Data Files

| File | Purpose | Editable? |
|------|---------|-----------|
| `data/questions.source.json` | Master question bank (~1174 questions) | Yes |
| `data/questions.json` | Generated output for the app | No (auto-generated) |
| `data/achievements.json` | Achievement definitions | Yes |
| `data/topic_labels_he.json` | Hebrew topic/subtopic labels | Yes |
| `rules.json` | Transformation rules (delete, text_replace, set_fields, add) | Yes |
| `version.json` | Auto-bumped version metadata | No (auto-generated) |

## Code Conventions

- Vanilla ES6+ JavaScript — no TypeScript, no bundler, no linter
- camelCase for functions/variables, CAPS for constants
- `$` prefix for DOM query helper functions
- Section headers use `// ==================== SECTION ====================`
- All UI text is in Hebrew; code comments and identifiers are in English
- HTML content must be escaped (XSS prevention) — use the existing `escapeHtml()` utility
- No `package.json` — no `npm install` needed

## Testing

No automated test suite. Manual testing checklist is in `RUN.md`. Key verification points:
- App loads without console errors after hard refresh
- Smart Tutor and all topic modes function correctly
- CMS operations (CRUD, import/export) work without data loss
- Service Worker updates don't break the app
- Dev tools accessible via 5-click easter egg on version text

## Debugging

- `?nocache=1` URL parameter bypasses Service Worker
- Dev tools: tap version text 5 times in Settings to enable diagnostics
- Boot logs captured in `state.bootLogs`
- Settings > Maintenance > "Reset SW + Cache" for full cache reset
