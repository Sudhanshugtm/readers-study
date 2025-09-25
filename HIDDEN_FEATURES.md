# Temporarily Hidden Features

## Overview
This document tracks features that have been temporarily hidden from the GitHub Pages deployment but can be easily restored.

## Currently Hidden (as of 2024-09-25)

### Improve Existing Sections
All three variants under "Improve Existing Sections" have been commented out in `pages-index.html`:

1. **Ask on Section** (`tab-master`)
   - Source: `master` branch / main worktree
   - File: `variants/master/index.html`
   - Description: Tap the section's menu to give feedback

2. **Pop-up Panel** (`tab-modal`)
   - Source: `alt-whisper-modal` branch / `readers-study-modal` worktree
   - File: `variants/whisper-modal/index.html`
   - Description: Open a small pop-up to choose feedback options

3. **Inline Suggestion** (`tab-inline`)
   - Source: `alt-whisper-inline` branch / `readers-study-inline` worktree
   - File: `variants/whisper-inline/index.html`
   - Description: Prompt appears inline near what you're reading

## Currently Active

### Suggest Missing Topics
- **Suggest Topics** (`tab-sidebar`)
  - Source: `alt-whisper-sidebar` branch / `readers-study-sidebar` worktree
  - File: `variants/whisper-sidebar/index.html`
  - Description: Suggest topics to add when an article is a stub

## How to Restore Hidden Features

To restore the hidden "Improve Existing Sections":

1. In `pages-index.html`, find the comment blocks:
   - `<!-- TEMPORARILY HIDDEN: Improve Existing Sections`
   - `<!-- TEMPORARILY HIDDEN: Improve Existing Sections iframes`

2. Uncomment the HTML sections by removing the comment tags

3. Update the JavaScript default activation:
   - Change `activate('whisper-sidebar');` back to `activate('master');`

4. Update the default selected tab:
   - Change `aria-selected="true"` from sidebar tab back to master tab
   - Change `aria-selected="false"` on other tabs accordingly

5. Update iframe classes:
   - Add `active` class to the desired default iframe
   - Remove `active` class from sidebar iframe
   - Change `data-src` back to `src` for immediate loading

## Git Worktree Structure
- `readers-study/` → master branch (baseline)
- `readers-study-modal/` → alt-whisper-modal branch
- `readers-study-inline/` → alt-whisper-inline branch
- `readers-study-sidebar/` → alt-whisper-sidebar branch