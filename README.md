# VE Boilerplate — How to Use (Minimal)

This is a minimal boilerplate that mimics Wikipedia’s reading and VisualEditor (VE) look on desktop and mobile.

## Files in this folder
- `ve-boilerplate.html` — Header/tabs, reading mode, VE mode, and toolbar.
- `reading-styles.css` — Core styles for reading + VE (headings, links, lists, Quill overrides, responsive).
- `reading-script.js` — Mode toggle (Read/Edit), Quill init, menus, Codex icon loading.

That’s it — no sidebar, wizard overlay, or smart widget included.

## Quick start
1. Open `ve-boilerplate.html` in a modern browser.
2. You’ll see Wikipedia‑style reading mode. Click “Edit” to open the VE mock.
3. Resize to test mobile: compact toolbar and simplified chrome will appear.

Note: Internet is required for Codex CSS/icons and Quill (loaded via CDNs).

## Customize content
At the bottom of `ve-boilerplate.html`, update the inline `articleData` object:
- `title` — Page title shown in the header.
- `content` — Body using simple wiki‑style markup the demo understands:
  - Headings: `== Section ==`, Subheadings: `=== Subsection ===`
  - Bold: `'''bold'''`, Italic: `''italic''`
  - Wiki links: `[[Link]]` or `[[Target|Text]]`
  - External links: `[https://example.com Label]`
  - Lists: lines starting with `* `

## Make another page
- Copy `ve-boilerplate.html` (e.g., `article‑example.html`).
- Update both `<h1 class="firstHeading">` titles and the inline `articleData`.

## Optional (if you later want extras)
- Sidebar, wizard overlay, or smart widget can be added by bringing over their CSS/markup/JS from your source project and wiring button actions. This minimal kit leaves them out by default.

## Known limitations (demo)
- Publishing and dialogs are mocked; actions show alerts.
- Codex icons come from an API; without network, icons won’t render (functionality remains).
