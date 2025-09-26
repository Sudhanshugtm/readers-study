// ABOUTME: Main script for reading mode with edit mode toggle functionality
// ABOUTME: Handles article loading, mode switching, and VE initialization

let quill = null;
let isEditMode = false;

// Default article data - will be overridden by specific article pages
const defaultArticle = {
  id: 'katie-bouman',
  title: 'Katie Bouman',
  description: 'American computer scientist and engineer',
  content: `'''Katherine Louise Bouman''' (born 1989) is an American [[engineer]] and [[computer scientist]] working in the field of [[computational imaging]]. She led the development of an [[algorithm]] for imaging [[black hole]]s, known as [[CHIRP (algorithm)|Continuous High-resolution Image Reconstruction using Patch priors]] (CHIRP), and was a member of the [[Event Horizon Telescope]] team that captured the first image of a black hole.

== Early life and education ==
Bouman grew up in [[West Lafayette, Indiana]]. Her father, [[Charles Bouman]], is a professor of [[electrical and computer engineering]] and [[biomedical engineering]] at [[Purdue University]].

== Research and career ==
After earning her doctorate, Bouman joined [[Harvard University]] as a [[postdoctoral fellow]] on the Event Horizon Telescope Imaging team. She led the development of an algorithm for imaging black holes, known as [[CHIRP (algorithm)|Continuous High-resolution Image Reconstruction using Patch priors]] (CHIRP).

== Recognition ==
She was recognized as one of the [[BBC]]'s [[100 Women (BBC)#2019|100 women of 2019]]. In 2024, Bouman was awarded a [[Sloan Research Fellowship]].`
};


// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Baseline variant: render article and enable whisper dots + selection sheet
  try {
    if (typeof loadArticleContent === 'function') {
      loadArticleContent();
    }
  } catch (e) {
    console.error('Error in loadArticleContent:', e);
  }
    try { initHelpExpandChip(); } catch(e) { console.warn('Help chip init error', e); }
  try {
    if (typeof setupEventListeners === 'function') {
      setupEventListeners();
    }
  } catch (e) {
    console.error('Error in setupEventListeners:', e);
  }
  try {
    if (typeof initWhisperChips === 'function') {
      initWhisperChips();
    }
  } catch (e) {
    console.error('Error in initWhisperChips:', e);
  }
  // Sidebar Prompt removed; only Gutter Flicks active
  // Gutter Flicks (Option 4) interactions
  try {
    initGutterFlicks();
    // Re-scan once more after layout settles (catch any late DOM)
    setTimeout(() => { try { initGutterFlicks(true); } catch(e){} }, 300);
  } catch(e) { console.warn('Gutter init error', e); }
});

function loadArticleContent() {
  const articleBody = document.getElementById('articleBody');
  // Use global articleData if available, otherwise fall back to defaultArticle
  const currentArticle = (typeof articleData !== 'undefined') ? articleData : defaultArticle;
  // Update page headings to reflect article title
  try {
    document.querySelectorAll('.firstHeading').forEach(el => { el.textContent = currentArticle.title || 'Article'; });
  } catch(e) { /* noop */ }
  const htmlContent = convertMediaWikiToHTML(currentArticle.content);
  articleBody.innerHTML = htmlContent;
}

// Build Vector‑style Table of Contents in the left sidebar
function buildTableOfContents() { 
  const toc = document.getElementById('toc');
  const container = document.getElementById('articleBody');
  if (!toc || !container) return;
  toc.innerHTML = '';
  const headings = container.querySelectorAll('.article-section__title, .article-subsection__title');
  const tocSidebar = document.getElementById('tocSidebar');
  if (headings.length === 0 && tocSidebar) { tocSidebar.style.display = 'none'; return; }
  const items = [];
  headings.forEach(h => {
    const level = h.classList.contains('article-subsection__title') ? 3 : 2;
    if (!h.id || !h.id.length) {
      h.id = slugify(h.textContent || 'section');
    }
    items.push({ id: h.id, text: (h.textContent || '').trim(), level });
  });
  const frag = document.createDocumentFragment();
  items.forEach(it => {
    const a = document.createElement('a');
    a.href = '#' + it.id;
    a.textContent = it.text;
    a.className = 'toc-link toc-level-' + it.level;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(it.id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    frag.appendChild(a);
  });
  toc.appendChild(frag);

  // Scroll spy highlight
  const links = Array.from(toc.querySelectorAll('a'));
  const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const link = byId.get(entry.target.id);
      if (!link) return;
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });
  headings.forEach(h => io.observe(h));
}

// initVariantBadge removed

function convertMediaWikiToHTML(mediaWikiText) {
  let html = mediaWikiText;
  
  // Convert section headers
  html = html.replace(/^== (.+?) ==$/gm, '<section class="article-section"><h2 class="article-section__title">$1</h2><div class="article-section__content">');
  html = html.replace(/^=== (.+?) ===$/gm, '<h3 class="article-subsection__title">$1</h3>');
  
  // Convert paragraphs - split by double newlines and wrap non-markup text in <p> tags
  html = html.split('\n\n').map(paragraph => {
    paragraph = paragraph.trim();
    if (paragraph === '') return '';
    if (paragraph.startsWith('<section') || paragraph.startsWith('<h3') || paragraph.startsWith('*') || paragraph.startsWith('{{')) {
      return paragraph;
    }
    return '<p>' + paragraph + '</p>';
  }).join('\n');
  
  // Close section divs before new sections
  html = html.replace(/<section class="article-section">/g, '</div></section><section class="article-section">');
  html = html.replace(/^<\/div><\/section>/, ''); // Remove first closing tags
  
  // Convert lists
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Convert wiki links to regular links (simplified)
  html = html.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '<a href="#" class="wiki-link">$1</a>');
  
  // Convert external links (simplified)
  html = html.replace(/\[([^\s]+) ([^\]]+)\]/g, '<a href="$1" class="external-link">$2</a>');
  
  // Convert bold text
  html = html.replace(/'''(.+?)'''/g, '<strong>$1</strong>');
  
  // Convert italic text
  html = html.replace(/''(.+?)''/g, '<em>$1</em>');
  
  
    const hasSections = html.indexOf('<section class="article-section">') !== -1;
  if (hasSections) { html += '</div></section>'; }
  return html;
}

// Whisper Chips: utilities
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function nowTs() { return Date.now(); }
function storageKey(pageId) { return 'rs-whisper-' + pageId; }
function loadQueue(pageId) {
  try { return JSON.parse(localStorage.getItem(storageKey(pageId)) || '[]'); } catch { return []; }
}
function saveQueue(pageId, arr) { localStorage.setItem(storageKey(pageId), JSON.stringify(arr)); }

// Whisper Chips: main init – add overflow dots on section headings,
// show selection popover, and wire the feedback sheet.
const ENABLE_SELECTION_POPOVER = false; // limit interactions to section-level dots only

function initWhisperChips() { /* no-op in Sidebar/Gutter variant */ }

// Help improve: init
function openFeedbackPanel() {
  const panel = document.getElementById('feedbackPanel');
  panel.style.display = 'block';
  // Populate sections
  const content = document.getElementById('feedbackPanelContent');
  content.innerHTML = '<p>Select sections you\'d like to provide feedback on:</p>';
  const sections = document.querySelectorAll('#articleBody .article-section__title');
  sections.forEach(title => {
    const div = document.createElement('div');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'section-' + slugify(title.textContent);
    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = title.textContent;
    div.appendChild(checkbox);
    div.appendChild(label);
    content.appendChild(div);
  });
}

function closeFeedbackPanel() {
  document.getElementById('feedbackPanel').style.display = 'none';
}

function initHelpImprove() {
  const helpBtn = document.getElementById('helpImproveBtn');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      openFeedbackPanel();
    });
  }

  const closeBtn = document.getElementById('feedbackPanelClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeFeedbackPanel();
    });
  }

  // Submit button
  const submitBtn = document.getElementById('feedbackSubmit');
  if (submitBtn) {
    submitBtn.disabled = true;
    document.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        const checked = document.querySelectorAll('#feedbackPanel input[type="checkbox"]:checked').length > 0;
        submitBtn.disabled = !checked;
      }
    });
    submitBtn.addEventListener('click', () => {
      alert('Feedback submitted!');
      closeFeedbackPanel();
    });
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('feedbackPanel');
    if (panel && panel.style.display !== 'none' && !panel.contains(e.target) && !helpBtn.contains(e.target)) {
      closeFeedbackPanel();
    }
  });
}

// setDesign removed for baseline; baseline uses whisper dots + selection sheet only

function addInlineLinks() {
  const sections = document.querySelectorAll('#articleBody .article-section__title');
  sections.forEach(title => {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = 'Help improve this section';
    link.className = 'inline-feedback-link';
    link.style.display = 'block';
    link.style.marginTop = '8px';
    link.style.fontSize = '12px';
    link.style.color = 'var(--progressive)';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openFeedbackPanel();
    });
    title.parentElement.appendChild(link);
  });
}

function setupSelectionPopover() {
  const pop = document.getElementById('whisperSelectionPopover');
  const btn = document.getElementById('whisperNeedMoreBtn');
  if (!pop || !btn) return;

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { pop.style.display = 'none'; return; }
    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range) { pop.style.display = 'none'; return; }
    // Ensure selection is within article
    const container = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!document.getElementById('articleBody').contains(container)) { pop.style.display = 'none'; return; }
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0)) { pop.style.display = 'none'; return; }
    // Position popover above selection
    const top = window.scrollY + rect.top - 36;
    const left = window.scrollX + rect.left + rect.width/2 - 50;
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
    pop.style.display = 'block';
  });

  btn.addEventListener('click', () => {
    const sel = window.getSelection();
    let quote = '';
    if (sel && !sel.isCollapsed) quote = sel.toString().trim();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    const rect = range ? range.getBoundingClientRect() : null;
    pop.style.display = 'none';
    // Find nearest section heading
    const section = nearestSectionFromSelection();
    openWhisperSheet({ sectionId: section.id, sectionTitle: section.title, quote, anchorRect: rect });
  });

  document.addEventListener('click', (e) => {
    if (!pop.contains(e.target)) pop.style.display = 'none';
  });
}

function nearestSectionFromSelection() {
  // Resolve to nearest top-level section title only
  const headings = Array.from(document.querySelectorAll('#articleBody .article-section__title'));
  const sel = window.getSelection();
  const node = sel && sel.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement) : null;
  let closest = headings[0] || null;
  if (node) {
    let el = node;
    while (el && el !== document.body) {
      const h = el.closest('.article-section__title, .article-subsection__title');
      if (h) { closest = h; break; }
      el = el.parentElement;
    }
  }
  if (!closest) return { id: 'article', title: 'Article' };
  return { id: closest.id, title: closest.textContent.trim() };
}

// Show more relevant chips by default; keep a couple behind More options
const PRIMARY_CHIPS = [ 'Add example', 'Define term', 'Update info', 'Add picture/diagram', 'Compare with…' ];
const SECONDARY_CHIPS = [ 'Simplify wording', 'Local context' ];

// Starters removed

let whisperState = { sectionId: '', sectionTitle: '', chips: new Set(), note: '', quote: '' };

function wireWhisperSheet() {
  const sheet = document.getElementById('whisperSheet');
  const backdrop = document.getElementById('whisperSheetBackdrop');
  const closeBtn = document.getElementById('whisperSheetClose');
  // Options: checkboxes
  const optMoreDetails = document.getElementById('optMoreDetails');
  const optMoreImages = document.getElementById('optMoreImages');
  const note = document.getElementById('whisperNoteInput');
  const charCount = document.getElementById('whisperCharCount');
  const submit = document.getElementById('whisperSubmit');
  if (!sheet || !backdrop) return;

  const noteBlock = document.getElementById('whisperNoteBlock');
  function updateHelper() {
    const helperEl = document.querySelector('.whisper-helper');
    if (!helperEl) return;
    // Keep helper fixed and neutral
    helperEl.textContent = 'Pick what would help most. You can add a note.';
  }
  function updateOptionsState() {
    whisperState.chips.clear();
    if (optMoreDetails && optMoreDetails.checked) whisperState.chips.add('more_details');
    if (optMoreImages && optMoreImages.checked) whisperState.chips.add('more_images');
    updateWhisperSubmitState();
  }
  if (optMoreDetails) optMoreDetails.addEventListener('change', updateOptionsState);
  if (optMoreImages) optMoreImages.addEventListener('change', updateOptionsState);

  // Removed directive helper variants; helper stays neutral

  // Note input
  note.addEventListener('input', () => {
    whisperState.note = note.value;
    charCount.textContent = note.value.length + '/140';
    updateWhisperSubmitState();
  });

  // Close actions
  function closeSheet() { sheet.style.display = 'none'; backdrop.style.display = 'none'; }
  closeBtn.addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  // Submit
  submit.addEventListener('click', () => {
    if (submit.disabled) return;
    recordWhisperSignal();
    closeSheet();
    showWhisperToast('Thanks — your request was recorded.');
  });

  // Talk link removed for now
}

function updateWhisperSubmitState() {
  const submit = document.getElementById('whisperSubmit');
  const hasContent = (whisperState.chips && whisperState.chips.size > 0) || (whisperState.note && whisperState.note.trim().length > 0);
  submit.disabled = !hasContent;
  if (hasContent) submit.classList.add('enabled'); else submit.classList.remove('enabled');
}

function openWhisperSheet({ sectionId, sectionTitle, quote = '', anchorRect = null }) {
  whisperState = { sectionId, sectionTitle, chips: new Set(), note: '', quote };
  const sheet = document.getElementById('whisperSheet');
  const backdrop = document.getElementById('whisperSheetBackdrop');
  const titleEl = document.getElementById('whisperSheetTitle');
  const subEl = document.getElementById('whisperSheetSub');
  const note = document.getElementById('whisperNoteInput');
  const charCount = document.getElementById('whisperCharCount');

  // Reader-friendly single line
  titleEl.textContent = 'Missing something in ' + sectionTitle + '?';
  // Keep anchor id for logic but hide subtitle in UI on desktop and mobile
  subEl.textContent = '#' + sectionId;
  subEl.style.display = 'none';

  // Quote preview
  const quoteEl = document.getElementById('whisperQuote');
  if (quoteEl) {
    if (quote) {
      const trimmed = quote.length > 160 ? quote.slice(0,157) + '…' : quote;
      quoteEl.textContent = 'About selected text: "' + trimmed + '"';
      quoteEl.style.display = 'block';
    } else {
      quoteEl.style.display = 'none';
      quoteEl.textContent = '';
    }
  }

  // Reset options (checkboxes)
  const optMoreDetails = document.getElementById('optMoreDetails');
  const optMoreImages = document.getElementById('optMoreImages');
  if (optMoreDetails) optMoreDetails.checked = false;
  if (optMoreImages) optMoreImages.checked = false;
  // Reset note
  note.value = '';
  charCount.textContent = '0/140';
  // Talk link removed, nothing to update

  // Note area is always visible; reset helper and button state
  const helperEl = document.querySelector('.whisper-helper');
  if (helperEl) helperEl.textContent = 'Pick what would help most. You can add a note.';
  updateWhisperSubmitState();

  updateWhisperSubmitState();

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) {
    // Bottom sheet mode
    sheet.style.left = '0';
    sheet.style.right = '0';
    sheet.style.transform = 'none';
    backdrop.style.display = 'block';
    sheet.style.display = 'block';
  } else {
    // Anchored panel near heading/selection
    backdrop.style.display = 'none';
    sheet.style.display = 'block';
    sheet.style.transform = 'none';
    sheet.style.position = 'fixed';
    sheet.style.right = 'auto';
    sheet.style.bottom = 'auto';

    const MARGIN = 16;
    const SPACING = 8;
    const PANEL_W = Math.min(420, Math.floor(window.innerWidth * 0.92));
    sheet.style.width = PANEL_W + 'px';
    // Temporarily hide to measure height without flicker
    const prevVis = sheet.style.visibility;
    sheet.style.visibility = 'hidden';
    // Ensure it has a width before measuring
    let measuredH = sheet.offsetHeight || 0;

    let left = Math.floor((window.innerWidth - PANEL_W) / 2);
    let top = 80; // fallback
    if (anchorRect) {
      // Align to anchor; prefer keeping the panel's right edge near the anchor if near screen edge
      left = Math.floor(anchorRect.left);
      const maxLeft = window.innerWidth - PANEL_W - MARGIN;
      const minLeft = MARGIN;
      if (left > maxLeft) {
        // Try aligning the panel's right edge to the anchor's right
        left = Math.floor(anchorRect.right - PANEL_W);
      }
      // Final clamp within viewport
      left = Math.max(minLeft, Math.min(left, maxLeft));
      // Prefer below anchor; if overflow, flip above if possible
      const belowTop = Math.floor(anchorRect.bottom + SPACING);
      const spaceBelow = window.innerHeight - belowTop - MARGIN;
      if (measuredH && spaceBelow < measuredH && (anchorRect.top - SPACING - measuredH) > MARGIN) {
        // Place above
        top = Math.max(MARGIN, Math.floor(anchorRect.top - SPACING - measuredH));
      } else {
        // Place below and clamp to viewport bottom
        top = Math.min(belowTop, window.innerHeight - MARGIN - (measuredH || 0));
        if (top < MARGIN) top = MARGIN;
      }
    }
    // Apply final position
    sheet.style.top = top + 'px';
    sheet.style.left = left + 'px';
    // Restore visibility
    sheet.style.visibility = prevVis || 'visible';

    // Click-away close for non-modal panel
    const clickAway = (ev) => {
      if (!sheet.contains(ev.target)) {
        sheet.style.display = 'none';
        document.removeEventListener('click', clickAway, true);
      }
    };
    setTimeout(() => document.addEventListener('click', clickAway, true), 0);
  }

  // focus for a11y
  sheet.focus();
}

// initSidePrompt removed

// ========== Option 4: Gutter Flicks ==========
function initGutterFlicks(rescan = false) {
  const container = document.getElementById('articleBody');
  if (!container) return;
  const paragraphs = Array.from(container.querySelectorAll('p'));
  paragraphs.forEach(p => ensureGutterWrap(p));

  // Keyboard accessibility: 'g' to arm for 5s; arrows choose direction; Enter to send
  let gutterArmed = false; let armTimer = null; let armedDir = 'left';
  function armGutter() {
    gutterArmed = true; armedDir = 'left';
    container.classList.add('gutter-armed');
    const rails = container.querySelectorAll('.gutter-rail'); rails.forEach(r => r.classList.add('armed'));
    clearTimeout(armTimer);
    armTimer = setTimeout(disarmGutter, 5000);
  }
  function disarmGutter() {
    gutterArmed = false; container.classList.remove('gutter-armed');
    const rails = container.querySelectorAll('.gutter-rail'); rails.forEach(r => r.classList.remove('armed'));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') { armGutter(); }
    if (!gutterArmed) return;
    if (['ArrowLeft','ArrowUp','ArrowDown'].includes(e.key)) {
      if (e.key === 'ArrowLeft') armedDir = 'left';
      if (e.key === 'ArrowUp') armedDir = 'left-up';
      if (e.key === 'ArrowDown') armedDir = 'left-down';
      e.preventDefault();
    }
    if (e.key === 'Enter') {
      // Send for the paragraph in view
      const p = paragraphs.find(el => isElementInViewport(el));
      if (p) sendGutterSignalFor(p, armedDir, { x: p.getBoundingClientRect().left, y: p.getBoundingClientRect().top + 6 });
      disarmGutter();
      e.preventDefault();
    }
    if (e.key === 'Escape') { disarmGutter(); }
  });

  // Screen reader fallback: add an sr-only button per paragraph
  paragraphs.forEach((p, idx) => {
    if (p.querySelector('.sr-whisper-trigger')) return;
    const b = document.createElement('button');
    b.className = 'sr-only sr-whisper-trigger';
    b.type = 'button';
    b.textContent = 'Send feedback for paragraph ' + (idx+1);
    b.addEventListener('click', () => openSRPicker(p));
    p.insertAdjacentElement('afterbegin', b);
  });
}

function ensureGutterWrap(p) {
  if (p.closest('.gutter-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'gutter-wrap';
  p.parentNode.insertBefore(wrap, p);
  wrap.appendChild(p);
  const rail = document.createElement('div'); rail.className = 'gutter-rail'; wrap.appendChild(rail);
  const ticks = document.createElement('div'); ticks.className = 'gutter-ticks'; wrap.appendChild(ticks);

  // Pointer gesture
  let startX=0, startY=0, isDown=false, ring=null, downAt=0;
  wrap.addEventListener('pointerdown', (e) => {
    const rect = wrap.getBoundingClientRect();
    const withinLeftEdge = (e.clientX - rect.left) < 20; // near text edge inside padding
    if (!withinLeftEdge) return;
    isDown = true; startX = e.clientX; startY = e.clientY; downAt = performance.now();
    wrap.setPointerCapture(e.pointerId);
    ring = createSendRing(e.clientX, e.clientY);
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    // Optionally we could draw vector; kept minimal
  });
  wrap.addEventListener('pointerup', (e) => {
    if (!isDown) return; isDown = false; wrap.releasePointerCapture(e.pointerId);
    const dx = e.clientX - startX; const dy = e.clientY - startY;
    const dt = performance.now() - downAt;
    const sent = maybeSendFromGesture(p, dx, dy, dt, e.clientX, e.clientY);
    if (ring) destroySendRing(ring, sent); ring = null;
  });
  wrap.addEventListener('pointercancel', () => { isDown=false; if (ring) destroySendRing(ring, false); ring=null; });
}

function maybeSendFromGesture(p, dx, dy, dt, x, y) {
  // Leftward flick ≥12px within 800ms sends; hold longer cancels
  const FLICK_THRESH = -12;
  const HOLD_CANCEL_MS = 800;
  if (dt > HOLD_CANCEL_MS) return false; // held too long – cancel
  if (dx > FLICK_THRESH) return false; // not leftward enough
  const angle = Math.atan2(dy, dx) * (180/Math.PI); // dx negative
  let dir = 'left';
  if (angle < -120 && angle > -180 || angle > 120 && angle <= 180) dir = 'left';
  if (angle >= -120 && angle <= -60) dir = 'left-up';
  if (angle >= 60 && angle <= 120) dir = 'left-down';
  sendGutterSignalFor(p, dir, { x, y });
  return true;
}

function sendGutterSignalFor(p, dir, pt) {
  const map = { 'left': 'more_background', 'left-up': 'hard_to_follow', 'left-down': 'outdated_wrong' };
  const heading = nearestHeadingForNode(p);
  recordWhisperSignal({
    sectionId: heading.id,
    sectionTitle: heading.title,
    chips: [ map[dir] ],
    note: ''
  });
  addGutterTickFor(p, dir, pt);
  const label = dir === 'left' ? 'More background' : (dir === 'left-up' ? 'Hard to follow' : 'Seems wrong/outdated');
  showWhisperToast('Sent: ' + label);
}

function nearestHeadingForNode(node) {
  const headings = Array.from(document.querySelectorAll('#articleBody .article-section__title, #articleBody .article-subsection__title'));
  let el = node;
  while (el && el !== document.body) {
    const h = el.previousElementSibling && (el.previousElementSibling.matches('.article-section__title, .article-subsection__title') ? el.previousElementSibling : null);
    if (h) return { id: h.id, title: h.textContent.trim() };
    el = el.parentElement;
  }
  const fallback = headings[0];
  return fallback ? { id: fallback.id, title: fallback.textContent.trim() } : { id: 'article', title: 'Article' };
}

function addGutterTickFor(p, dir, pt) {
  const wrap = p.closest('.gutter-wrap'); if (!wrap) return;
  const ticks = wrap.querySelector('.gutter-ticks'); if (!ticks) return;
  const tick = document.createElement('div');
  tick.className = 'gutter-tick';
  // place near pointer Y or near top
  const rect = wrap.getBoundingClientRect();
  let top = 8;
  if (pt && typeof pt.y === 'number') {
    top = Math.max(2, Math.min(rect.height - 4, pt.y - rect.top));
  }
  tick.style.top = top + 'px';
  // cluster effect: if existing, add class
  if (ticks.childElementCount >= 1) tick.classList.add('cluster');
  ticks.appendChild(tick);
}

function createSendRing(x, y) {
  const ring = document.createElement('div'); ring.className = 'send-ring';
  ring.style.left = x + 'px'; ring.style.top = y + 'px';
  document.body.appendChild(ring);
  requestAnimationFrame(() => ring.classList.add('active'));
  return ring;
}
function destroySendRing(ring, sent) {
  if (!ring) return; ring.classList.remove('active');
  setTimeout(() => { if (ring && ring.parentNode) ring.parentNode.removeChild(ring); }, 180);
}

function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.top >= 0 && rect.top <= (window.innerHeight*0.6);
}

function openSRPicker(p) {
  const opts = [
    { key: 'left', label: 'More background' },
    { key: 'left-up', label: 'Hard to follow' },
    { key: 'left-down', label: 'Seems wrong/outdated' }
  ];
  const menu = document.createElement('div');
  menu.role = 'dialog';
  menu.ariaLabel = 'Send feedback';
  menu.style.position = 'fixed'; menu.style.left = '50%'; menu.style.top = '20%';
  menu.style.transform = 'translateX(-50%)'; menu.style.background = '#fff'; menu.style.border = '1px solid #c8ccd1'; menu.style.borderRadius = '8px'; menu.style.padding = '8px'; menu.style.zIndex = 1200;
  opts.forEach(o => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = o.label; btn.style.display = 'block'; btn.style.margin = '6px 0';
    btn.addEventListener('click', () => { const r = p.getBoundingClientRect(); sendGutterSignalFor(p, o.key, { x: r.left + 4, y: r.top + 8 }); close(); });
    menu.appendChild(btn);
  });
  function close(){ if (menu.parentNode) document.body.removeChild(menu); }
  const cancel = document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel'; cancel.addEventListener('click', close);
  menu.appendChild(cancel);
  document.body.appendChild(menu);
  setTimeout(() => { try { menu.querySelector('button')?.focus(); } catch{} }, 0);
}

function currentWhisperPayload() {
  const page = (typeof articleData !== 'undefined') ? articleData : defaultArticle;
  return {
    pageId: page.id || 'page',
    pageTitle: page.title,
    sectionId: whisperState.sectionId,
    sectionTitle: whisperState.sectionTitle,
    chips: Array.from(whisperState.chips),
    note: (whisperState.note || '').trim(),
    quote: (whisperState.quote || '').trim(),
    ts: nowTs(),
    anon: true,
    device: { w: window.innerWidth, h: window.innerHeight }
  };
}

function isDuplicateRecent(queue, payload) {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const norm = (payload.note || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const chipsKey = payload.chips.slice().sort().join('|');
  return queue.some(item => (
    item.sectionId === payload.sectionId &&
    (item.ts && (payload.ts - item.ts) < ONE_DAY) &&
    ((item.chips || []).slice().sort().join('|') === chipsKey) &&
    ((item.note || '').toLowerCase().replace(/\s+/g, ' ').trim() === norm)
  ));
}

function recordWhisperSignal(options = {}) {
  const payload = options.sectionId ? {
    pageId: (typeof articleData !== 'undefined') ? articleData.id : 'page',
    pageTitle: (typeof articleData !== 'undefined') ? articleData.title : 'Article',
    sectionId: options.sectionId,
    sectionTitle: options.sectionTitle,
    chips: options.chips || [],
    note: options.note || '',
    quote: options.quote || '',
    ts: nowTs(),
    anon: true,
    device: { w: window.innerWidth, h: window.innerHeight }
  } : currentWhisperPayload();

  const queue = loadQueue(payload.pageId);
  // Rate limit per device+section: max 1 per minute
  const lastSection = queue.filter(q => q.sectionId === payload.sectionId).sort((a,b) => b.ts - a.ts)[0];
  if (lastSection && (payload.ts - lastSection.ts) < 60 * 1000) {
    showWhisperToast('Thanks — recently received for this section');
    return;
  }
  if (isDuplicateRecent(queue, payload)) {
    showWhisperToast('Already sent recently');
    return;
  }
  payload.status = 'queued'; // concept: offline queue
  queue.push(payload);
  saveQueue(payload.pageId, queue);
}

function revealSectionBadge(sectionId) {
  const h = document.getElementById(sectionId);
  if (!h) return;
  const badge = h.nextElementSibling;
  if (badge && badge.classList.contains('whisper-badge')) {
    badge.style.display = 'inline-flex';
  }
}

function openFeedbackPanel() {
  const panel = document.getElementById('feedbackPanel');
  const content = document.getElementById('feedbackPanelContent');
  const submitBtn = document.getElementById('feedbackSubmit');
  const helpBtn = document.getElementById('helpImproveBtn');

  if (!panel || !content) return;

  // Mark button as active
  if (helpBtn) helpBtn.classList.add('active');

  // Get all sections, including introduction
  const sections = document.querySelectorAll('.article-section');
  let sectionsHTML = '';

  // Add introduction section if there's content before first section
  const articleBody = document.getElementById('articleBody');
  if (articleBody) {
    const firstSection = articleBody.querySelector('.article-section');
    if (firstSection) {
      const introContent = [];
      let current = firstSection.previousSibling;
      while (current) {
        if (current.nodeType === 1 && current.tagName === 'P') {
          introContent.unshift(current.textContent.trim());
        }
        current = current.previousSibling;
      }
      if (introContent.length > 0) {
        sectionsHTML += `
          <div class="feedback-section" data-section-id="introduction" data-section-title="Introduction">
            <h4>Introduction</h4>
            <div class="feedback-options">
              <label><input type="checkbox" data-type="details"> More details needed</label>
              <label><input type="checkbox" data-type="images"> Add pictures</label>
            </div>
            <div class="feedback-note">
              <textarea placeholder="Note (optional)" maxlength="140" rows="2"></textarea>
            </div>
          </div>
        `;
      }
    }
  }

  // Add actual sections
  sectionsHTML += Array.from(sections).map(section => {
    const title = section.querySelector('.article-section__title').textContent.trim();
    const id = section.querySelector('.article-section__title').id || slugify(title);
    return `
      <div class="feedback-section" data-section-id="${id}" data-section-title="${title}">
        <h4>${title}</h4>
        <div class="feedback-options">
          <label><input type="checkbox" data-type="details"> More details needed</label>
          <label><input type="checkbox" data-type="images"> Add pictures or diagrams</label>
          <label><input type="checkbox" data-type="examples"> Add examples</label>
          <label><input type="checkbox" data-type="sources"> Add sources or citations</label>
        </div>
        <div class="feedback-note">
          <textarea placeholder="Note (optional)" maxlength="140" rows="2"></textarea>
        </div>
      </div>
    `;
  }).join('');

  content.innerHTML = '<p>Select sections you\'d like to provide feedback on:</p>' + sectionsHTML;

  // Add event listeners to checkboxes and textareas
  const allCheckboxes = content.querySelectorAll('input[type="checkbox"]');
  const allTextareas = content.querySelectorAll('textarea');

  function updateSubmitState() {
    const hasAnyFeedback = Array.from(allCheckboxes).some(cb => cb.checked) ||
                          Array.from(allTextareas).some(ta => ta.value.trim());
    submitBtn.disabled = !hasAnyFeedback;
    submitBtn.classList.toggle('enabled', hasAnyFeedback);
  }

  allCheckboxes.forEach(cb => cb.addEventListener('change', updateSubmitState));
  allTextareas.forEach(ta => ta.addEventListener('input', updateSubmitState));

  submitBtn.addEventListener('click', () => {
    const feedbackData = Array.from(content.querySelectorAll('.feedback-section')).map(section => {
      const sectionId = section.dataset.sectionId;
      const sectionTitle = section.dataset.sectionTitle;
      const checkboxes = section.querySelectorAll('input[type="checkbox"]:checked');
      const chips = Array.from(checkboxes).map(cb => cb.dataset.type);
      const note = section.querySelector('textarea').value.trim();
      return { sectionId, sectionTitle, chips, note };
    }).filter(item => item.chips.length > 0 || item.note);

    feedbackData.forEach(item => {
      recordWhisperSignal(item);
    });

    closeFeedbackPanel();
    showWhisperToast('Thanks for helping improve the article!');
  });

  // Show panel
  panel.style.display = 'block';
  submitBtn.disabled = true;
}

function closeFeedbackPanel() {
  const panel = document.getElementById('feedbackPanel');
  const helpBtn = document.getElementById('helpImproveBtn');
  if (panel) {
    panel.style.display = 'none';
  }
  // Remove active state from button
  if (helpBtn) helpBtn.classList.remove('active');
}

function showWhisperToast(text) {
  const toast = document.getElementById('whisperToast');
  if (!toast) return;
  toast.textContent = text;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2000);
}

function convertArticleToQuillFormat(article) {
  // Enhanced conversion from MediaWiki to Quill format with proper links
  let content = [];
  
  // Add title
  content.push({ insert: article.title + '\n', attributes: { header: 1 } });
  
  // Parse the content line by line
  const lines = article.content.split('\n');
  
  for (let line of lines) {
    line = line.trim();
    if (line === '') {
      content.push({ insert: '\n' });
      continue;
    }
    
    // Handle different header levels
    if (line.startsWith('=== ') && line.endsWith(' ===')) {
      const headerText = line.slice(4, -4);
      content.push({ insert: headerText + '\n', attributes: { header: 3 } });
    } else if (line.startsWith('== ') && line.endsWith(' ==')) {
      const headerText = line.slice(3, -3);
      content.push({ insert: headerText + '\n', attributes: { header: 2 } });
    } else {
      // Process line for formatting and links
      processLineWithFormatting(line, content);
      content.push({ insert: '\n' });
    }
  }
  
  return content;
}

function processLineWithFormatting(line, content) {
  // Process the line character by character to handle nested formatting
  let i = 0;
  let currentText = '';
  
  while (i < line.length) {
    // Check for wiki links [[Link|Text]] or [[Link]]
    if (line.substring(i, i + 2) === '[[') {
      // Add any accumulated text
      if (currentText) {
        content.push({ insert: currentText });
        currentText = '';
      }
      
      // Find the end of the link
      let linkEnd = line.indexOf(']]', i + 2);
      if (linkEnd !== -1) {
        let linkContent = line.substring(i + 2, linkEnd);
        let linkText, linkTarget;
        
        if (linkContent.includes('|')) {
          [linkTarget, linkText] = linkContent.split('|', 2);
        } else {
          linkTarget = linkText = linkContent;
        }
        
        // Add as a link
        content.push({ 
          insert: linkText, 
          attributes: { link: '#' } // Using # as placeholder URL
        });
        
        i = linkEnd + 2;
      } else {
        // Malformed link, treat as regular text
        currentText += line[i];
        i++;
      }
    }
    // Check for external links [URL Text]
    else if (line.substring(i, i + 1) === '[' && line.indexOf(' ', i) !== -1 && line.indexOf(']', i) !== -1) {
      // Add any accumulated text
      if (currentText) {
        content.push({ insert: currentText });
        currentText = '';
      }
      
      let linkEnd = line.indexOf(']', i + 1);
      if (linkEnd !== -1) {
        let linkContent = line.substring(i + 1, linkEnd);
        let spaceIndex = linkContent.indexOf(' ');
        if (spaceIndex !== -1) {
          let url = linkContent.substring(0, spaceIndex);
          let text = linkContent.substring(spaceIndex + 1);
          
          // Add as external link
          content.push({ 
            insert: text, 
            attributes: { link: url } 
          });
          
          i = linkEnd + 1;
        } else {
          currentText += line[i];
          i++;
        }
      } else {
        currentText += line[i];
        i++;
      }
    }
    // Check for bold text '''text'''
    else if (line.substring(i, i + 3) === "'''") {
      // Add any accumulated text
      if (currentText) {
        content.push({ insert: currentText });
        currentText = '';
      }
      
      let boldEnd = line.indexOf("'''", i + 3);
      if (boldEnd !== -1) {
        let boldText = line.substring(i + 3, boldEnd);
        content.push({ 
          insert: boldText, 
          attributes: { bold: true } 
        });
        i = boldEnd + 3;
      } else {
        currentText += line[i];
        i++;
      }
    }
    // Check for italic text ''text''
    else if (line.substring(i, i + 2) === "''" && line.substring(i, i + 3) !== "'''") {
      // Add any accumulated text
      if (currentText) {
        content.push({ insert: currentText });
        currentText = '';
      }
      
      let italicEnd = line.indexOf("''", i + 2);
      if (italicEnd !== -1) {
        let italicText = line.substring(i + 2, italicEnd);
        content.push({ 
          insert: italicText, 
          attributes: { italic: true } 
        });
        i = italicEnd + 2;
      } else {
        currentText += line[i];
        i++;
      }
    }
    else {
      currentText += line[i];
      i++;
    }
  }
  
  // Add any remaining text
  if (currentText) {
    content.push({ insert: currentText });
  }
}

function setupEventListeners() {
  // Close button (mobile) - exit edit mode
  const closeBtn = document.getElementById('close');
  if (closeBtn) {
    closeBtn.addEventListener('click', exitEditMode);
  }



  // Page action tabs toggle
  document.querySelectorAll('.action-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.classList.contains('star')) {
        if (btn.id === 'editTab') {
          toggleEditMode();
        } else {
          // Read tab or other tabs - exit edit mode
          if (isEditMode) {
            exitEditMode();
          } else {
            // Just update tab state if not in edit mode
            document.querySelectorAll('.action-tab:not(.star)').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          }
        }
      }
    });
  });

  // Article/Talk tab toggle
  document.querySelectorAll('.ns-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ns-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // VE mode tabs (in edit interface)
  document.addEventListener('click', (e) => {
    if (e.target.matches('.ve-interface .action-tab')) {
      if (!e.target.classList.contains('star')) {
        if (e.target.id === 'editTabVE') {
          // Already in edit mode, do nothing
        } else {
          // Read tab or other tabs in VE - exit edit mode
          exitEditMode();
        }
      }
    }
  });
}

function toggleEditMode() {
  if (isEditMode) {
    exitEditMode();
  } else {
    enterEditMode();
  }
}

function enterEditMode() {
  isEditMode = true;
  
  // Hide reading content
  document.getElementById('readingContent').style.display = 'none';
  
  // Show VE interface
  document.getElementById('veInterface').style.display = 'block';
  
  // Update tab states in main interface
  document.querySelectorAll('#readingContent .action-tab:not(.star)').forEach(b => b.classList.remove('active'));
  document.getElementById('editTab').classList.add('active');
  
  // Update tab states in VE interface
  document.querySelectorAll('.ve-interface .action-tab:not(.star)').forEach(b => b.classList.remove('active'));
  const editTabVE = document.getElementById('editTabVE');
  if (editTabVE) {
    editTabVE.classList.add('active');
  }
  
  // Reset publish button to disabled state
  const publishBtn = document.getElementById('publish');
  if (publishBtn) {
    publishBtn.disabled = true;
    publishBtn.textContent = 'Publish';
  }
  
  // Reset mobile submit button to disabled state
  const submitBtn = document.getElementById('submit');
  if (submitBtn) {
    submitBtn.classList.remove('enabled');
  }
  
  // Show smart widget for suggestions
  const _sw = document.getElementById('smartWidget'); if (_sw) _sw.style.display = 'block';
  
  // Initialize Quill editor if not already done
  if (!quill) {
    initializeQuillEditor();
  }
  
  // Load content into editor
  loadContentIntoEditor();
}

function exitEditMode() {
  isEditMode = false;
  
  // Show reading content
  document.getElementById('readingContent').style.display = 'block';
  
  // Hide VE interface
  document.getElementById('veInterface').style.display = 'none';
  
  // Hide smart widget
  const _sw2 = document.getElementById('smartWidget'); if (_sw2) _sw2.style.display = 'none';

  // Hide expand sidebar if present
  const expandSidebar = document.getElementById('expandSidebar');
  if (expandSidebar) {
    expandSidebar.classList.remove('open');
    expandSidebar.style.display = 'none';
  }
  
  // Update tab state in main interface - activate Read tab
  document.querySelectorAll('.action-tab:not(.star)').forEach(b => b.classList.remove('active'));
  const readTab = document.querySelector('.action-tab'); // First action tab is Read
  if (readTab) {
    readTab.classList.add('active');
  }
}

function initializeQuillEditor() {
  quill = new Quill('#editor', {
    modules: { 
      toolbar: false, 
      history: { 
        delay: 250, 
        maxStack: 100, 
        userOnly: true 
      } 
    },
    placeholder: 'Start editing the article…',
    theme: 'snow'
  });

  // Enable publish button when user starts typing
  quill.on('text-change', function(delta, oldDelta, source) {
    if (source === 'user') {
      const publishBtn = document.getElementById('publish');
      if (publishBtn && publishBtn.disabled) {
        publishBtn.disabled = false;
        publishBtn.textContent = 'Publish changes';
      }
      
      // Enable mobile submit button
      const submitBtn = document.getElementById('submit');
      if (submitBtn && !submitBtn.classList.contains('enabled')) {
        submitBtn.classList.add('enabled');
      }
    }
  });

  // Setup VE functionality
  setupVEHandlers();
}

function loadContentIntoEditor() {
  if (!quill) return;
  
  // Use global articleData if available, otherwise fall back to defaultArticle
  const currentArticle = (typeof articleData !== 'undefined') ? articleData : defaultArticle;
  
  // Convert the article content to a simplified Quill format
  const content = convertArticleToQuillFormat(currentArticle);
  
  quill.setContents(content);
  
  // Position cursor at the beginning of the article title (index 0)
  setTimeout(() => {
    quill.focus();
    quill.setSelection(0, 0);
    // Ensure the editor container is focused
    const editor = document.getElementById('editor');
    if (editor) {
      editor.focus();
    }
  }, 200);
}

function setupVEHandlers() {
  // Dropdown helpers
  function closeMenus() {
    document.querySelectorAll('.menu').forEach(m => m.classList.remove('open'));
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) closeMenus();
  });

  // Undo/Redo
  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');
  const undoDesktopBtn = document.getElementById('undo-desktop');
  
  if (undoBtn) undoBtn.onclick = () => quill.history.undo();
  if (redoBtn) redoBtn.onclick = () => quill.history.redo();
  if (undoDesktopBtn) undoDesktopBtn.onclick = () => quill.history.undo();

  // Mobile-specific handlers
  setupMobileHandlers();
  setupDesktopHandlers();
  
  // Shared handlers
  setupSharedHandlers();
}

function setupMobileHandlers() {
  // Mobile quote button
  const quoteBtn = document.getElementById('quote');
  if (quoteBtn) {
    quoteBtn.onclick = () => {
      // On mobile, use Quote button to open the expand sidebar drawer
      const sidebar = document.getElementById('expandSidebar');
      if (sidebar && window.matchMedia('(max-width: 768px)').matches) {
        sidebar.style.display = 'block';
        requestAnimationFrame(() => sidebar.classList.add('open'));
      } else {
        // Fallback to original quote behavior on larger screens
        const sel = quill.getSelection(true);
        if (sel) quill.formatText(sel.index, sel.length, 'blockquote', true);
      }
    };
  }

  // Mobile link button
  const linkMobileBtn = document.getElementById('btn-link-mobile');
  if (linkMobileBtn) {
    linkMobileBtn.onclick = () => {
      const sel = quill.getSelection(true);
      if (!sel) return;
      const url = prompt('Enter URL');
      if (url) quill.format('link', url);
    };
  }

  // Mobile submit button
  const submitBtn = document.getElementById('submit');
  if (submitBtn) {
    submitBtn.onclick = () => {
      alert('Submit changes (mock)');
    };
  }

  // Mobile style dropdown
  const ddStyleMobile = document.getElementById('dd-style-mobile');
  const menuStyleMobile = document.getElementById('menu-style-mobile');

  if (ddStyleMobile && menuStyleMobile) {
    ddStyleMobile.onclick = (e) => {
      e.stopPropagation();
      closeMenus();
      menuStyleMobile.classList.add('open');
    };

    menuStyleMobile.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      const action = e.target.getAttribute('data-style');
      if (action === 'clean') {
        const sel = quill.getSelection(true);
        if (sel) quill.removeFormat(sel.index, sel.length);
      } else if (action === 'script-sup') {
        quill.format('script', 'super');
      } else if (action === 'script-sub') {
        quill.format('script', 'sub');
      } else {
        quill.format(action, !quill.getFormat()[action]);
      }
      closeMenus();
    });
  }

  // Mobile edit dropdown
  const ddEditMobile = document.getElementById('dd-edit-mobile');
  const menuEditMobile = document.getElementById('menu-edit-mobile');

  if (ddEditMobile && menuEditMobile) {
    ddEditMobile.onclick = (e) => {
      e.stopPropagation();
      closeMenus();
      menuEditMobile.classList.add('open');
    };

    menuEditMobile.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      const t = e.target.getAttribute('data-insert');
      if (t === 'image') {
        const url = prompt('Image URL');
        if (url) {
          const range = quill.getSelection(true) || { index: quill.getLength() };
          quill.insertEmbed(range.index, 'image', url, 'user');
        }
      } else {
        alert('This insert is mocked in the demo.');
      }
      closeMenus();
    });
  }
}

function setupDesktopHandlers() {
  // Paragraph dropdown
  const ddPara = document.getElementById('dd-paragraph');
  const menuPara = document.getElementById('menu-paragraph');

  if (ddPara && menuPara) {
    ddPara.onclick = (e) => {
      e.stopPropagation();
      closeMenus();
      menuPara.classList.add('open');
    };

    menuPara.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      const val = e.target.getAttribute('data-header');
      if (val === 'code') {
        quill.format('code-block', true);
      } else {
        quill.format('header', val ? parseInt(val) : false);
      }
      ddPara.querySelector('.cdx-button__label').textContent = val ? ('Heading ' + val) : 'Paragraph';
      closeMenus();
    });
  }

  // Style dropdown
  const ddStyle = document.getElementById('dd-style');
  const menuStyle = document.getElementById('menu-style');

  if (ddStyle && menuStyle) {
    ddStyle.onclick = (e) => {
      e.stopPropagation();
      closeMenus();
      menuStyle.classList.add('open');
    };

    menuStyle.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      const action = e.target.getAttribute('data-style');
      if (action === 'clean') {
        const sel = quill.getSelection(true);
        if (sel) quill.removeFormat(sel.index, sel.length);
      } else if (action === 'script-sup') {
        quill.format('script', 'super');
      } else if (action === 'script-sub') {
        quill.format('script', 'sub');
      } else {
        quill.format(action, !quill.getFormat()[action]);
      }
      closeMenus();
    });
  }
}

function setupSharedHandlers() {
  // Lists
  const olBtn = document.querySelector('[data-cmd="ol"]');
  const ulBtn = document.querySelector('[data-cmd="ul"]');
  
  if (olBtn) olBtn.onclick = () => quill.format('list', 'ordered');
  if (ulBtn) ulBtn.onclick = () => quill.format('list', 'bullet');

  // Link (desktop)
  const linkBtn = document.getElementById('btn-link');
  if (linkBtn) {
    linkBtn.onclick = () => {
      const sel = quill.getSelection(true);
      if (!sel) return;
      const url = prompt('Enter URL');
      if (url) quill.format('link', url);
    };
  }

  // Cite dropdown (mock)
  const ddCite = document.getElementById('dd-cite');
  const menuCite = document.getElementById('menu-cite');

  if (ddCite && menuCite) {
    ddCite.onclick = (e) => {
      e.stopPropagation();
      closeMenus();
      menuCite.classList.add('open');
    };

    menuCite.addEventListener('click', () => {
      alert('Citations are mocked in this demo.');
      closeMenus();
    });
  }

  // Insert dropdown
  const ddIns = document.getElementById('dd-insert');
  const menuIns = document.getElementById('menu-insert');

  if (ddIns && menuIns) {
    ddIns.onclick = (e) => {
      e.stopPropagation();
      closeMenus();
      menuIns.classList.add('open');
    };

    menuIns.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      const t = e.target.getAttribute('data-insert');
      if (t === 'image') {
        const url = prompt('Image URL');
        if (url) {
          const range = quill.getSelection(true) || { index: quill.getLength() };
          quill.insertEmbed(range.index, 'image', url, 'user');
        }
      } else if (t === 'char') {
        alert('Special characters dialog is mocked.');
      } else {
        alert('This insert is mocked in the demo.');
      }
      closeMenus();
    });
  }

  // Publish button
  const publishBtn = document.getElementById('publish');
  if (publishBtn) {
    publishBtn.onclick = () => alert('Publishing disabled in this demo.');
  }

  // Smart widget - handled by WikidataWidget class
  
  // Add section button - opens wizard
  const addSectionBtn = document.getElementById('addSectionBtn');
  if (addSectionBtn) {
    // In this branch, open the right-side expand sidebar instead of wizard
    addSectionBtn.onclick = () => {
      const sidebar = document.getElementById('expandSidebar');
      if (sidebar) {
        sidebar.style.display = 'block';
      }
    };
  }
  
  // Wizard close button
  const wizardClose = document.getElementById('wizardClose');
  if (wizardClose) {
    wizardClose.onclick = () => {
      closeSectionWizard();
    };
  }

  // Expand sidebar close button (sidebar concept)
  const expandSidebarClose = document.getElementById('expandSidebarClose');
  if (expandSidebarClose) {
    expandSidebarClose.onclick = () => {
      const sidebar = document.getElementById('expandSidebar');
      if (sidebar) {
        sidebar.classList.remove('open');
        // Wait for transition on mobile, then hide
        setTimeout(() => { sidebar.style.display = 'none'; }, 200);
      }
    };
  }
  
  // Close wizard when clicking backdrop
  const wizardBackdrop = document.querySelector('.wizard-backdrop');
  if (wizardBackdrop) {
    wizardBackdrop.onclick = () => {
      closeSectionWizard();
    };
  }
  
  // Close wizard with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const wizard = document.getElementById('sectionWizard');
      if (wizard && wizard.classList.contains('show')) {
        closeSectionWizard();
      }
    }
  });
  
  // Wizard cancel button
  const wizardCancel = document.getElementById('wizardCancel');
  if (wizardCancel) {
    wizardCancel.onclick = () => {
      closeSectionWizard();
    };
  }
  
  // Wizard navigation buttons
  const wizardContinue = document.getElementById('wizardContinue');
  const wizardBack = document.getElementById('wizardBack');
  const wizardSkip = document.getElementById('wizardSkip');
  const wizardInsert = document.getElementById('wizardInsert');
  
  if (wizardContinue) {
    wizardContinue.onclick = () => proceedToNextStep();
  }
  
  if (wizardBack) {
    wizardBack.onclick = () => goBackStep();
  }
  
  if (wizardSkip) {
    wizardSkip.onclick = () => skipStep();
  }
  
  if (wizardInsert) {
    wizardInsert.onclick = () => finishSection();
  }
  
  // Source palette handlers
  const sourcePaletteClose = document.getElementById('sourcePaletteClose');
  if (sourcePaletteClose) {
    sourcePaletteClose.onclick = () => hideSourcePalette();
  }
  
  // Section card selection
  document.addEventListener('click', (e) => {
    if (e.target.closest('.section-card')) {
      const card = e.target.closest('.section-card');
      const isCustom = card.dataset.section === 'custom';
      
      // Remove selection from other cards
      document.querySelectorAll('.section-card').forEach(c => c.classList.remove('selected'));
      
      // Select this card
      card.classList.add('selected');
      
      // Handle custom section
      if (isCustom) {
        const customInput = card.querySelector('.custom-section-input');
        const textInput = card.querySelector('.custom-section-name');
        customInput.style.display = 'block';
        textInput.focus();
        
        // Save to wizard state and update buttons
        wizardState.selectedSection = textInput.value.trim();
        
        // Enable continue button when custom name is entered
        textInput.addEventListener('input', () => {
          wizardState.selectedSection = textInput.value.trim();
          updateWizardButtons();
        });
      } else {
        // Hide custom inputs from other cards
        document.querySelectorAll('.custom-section-input').forEach(input => {
          input.style.display = 'none';
        });
        
        // Save to wizard state
        wizardState.selectedSection = card.querySelector('.section-card-title').textContent;
        updateWizardButtons();
      }
    }
    
    // Source input and management
    if (e.target.id === 'addSourceBtn') {
      addSourceToList();
    }
    
    // Source statement clicking in palette
    if (e.target.closest('.source-statement-item')) {
      const item = e.target.closest('.source-statement-item');
      const text = item.querySelector('.source-statement-text').textContent;
      insertTextAtCursor(text);
    }
    
    // Remove format button handlers and statement selection (no longer needed)
  });
  
  // Source URL input enter key
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'sourceUrlInput' && e.key === 'Enter') {
      e.preventDefault();
      addSourceToList();
    }
  });
}

function addSourceToList() {
  const urlInput = document.getElementById('sourceUrlInput');
  const sourcesList = document.getElementById('sourcesList');
  
  if (!urlInput || !sourcesList || !urlInput.value.trim()) return;
  
  const url = urlInput.value.trim();
  
  // Simple example sentences for concept demonstration
  const exampleSentences = [
    `${wizardState.selectedSection} has been recognized for significant contributions to the field.`,
    `Recent developments in ${wizardState.selectedSection} have gained widespread attention.`,
    `The impact of ${wizardState.selectedSection} continues to influence current research.`
  ];
  
  const sourceItem = document.createElement('div');
  sourceItem.className = 'source-item';
  sourceItem.innerHTML = `
    <div class="source-url">${url}</div>
    <div class="source-statements">
      ${exampleSentences.map(sentence => `
        <div class="example-sentence">
          ${sentence} <span class="citation-note">(will add a citation)</span>
        </div>
      `).join('')}
    </div>
  `;
  
  sourcesList.appendChild(sourceItem);
  
  // Add to wizard state
  wizardState.sources.push({
    url: url,
    sentences: exampleSentences
  });
  
  // Clear input
  urlInput.value = '';
  
  // Hide nudge if it was showing
  const sourcesNudge = document.getElementById('sourcesNudge');
  if (sourcesNudge) {
    sourcesNudge.style.display = 'none';
  }
  
  updateWizardButtons();
}

// === Codex Icons via MW API ===
async function loadCodexIcons(iconNames) {
  const url = 'https://www.mediawiki.org/w/api.php?action=query&list=codexicons&format=json&origin=*' +
    '&names=' + encodeURIComponent(iconNames.join('|'));
  const res = await fetch(url);
  const data = await res.json();
  const out = {};
  const map = data?.query?.codexicons || {};
  
  for (const k of Object.keys(map)) {
    const entry = map[k];
    const path = typeof entry === 'string' ? entry : (entry.ltr || entry.default || Object.values(entry.langCodeMap || {})[0] || '');
    out[k] = path;
  }
  return out;
}

// Apply icons on load
(function applyIcons() {
  const nodes = Array.from(document.querySelectorAll('.cdx-icon[data-icon]'));

  // First, set fallbacks immediately
  nodes.forEach(n => {
    const iconName = n.getAttribute('data-icon');
    const fallbacks = {
      'cdxIconFeedback': '💬',
      'cdxIconHelp': '💡',
      'cdxIconArticle': '📄',
      'cdxIconEdit': '✏️',
      'cdxIconHistory': '🕐',
      'cdxIconStar': '⭐',
      'cdxIconClose': '×',
      'cdxIconUndo': '↶',
      'cdxIconRedo': '↷',
      'cdxIconTextStyle': 'A',
      'cdxIconQuotes': '"',
      'cdxIconLink': '🔗',
      'cdxIconAdd': '+',
      'cdxIconSettings': '⚙️',
      'cdxIconNext': '→',
      'cdxIconTextHeading': 'H',
      'cdxIconListNumbered': '1.',
      'cdxIconListBullet': '•',
      'cdxIconReference': '[1]',
      'cdxIconMedia': '🖼️',
      'cdxIconTemplate': '📋',
      'cdxIconMath': '∑',
      'cdxIconTable': '📊',
      'cdxIconSpecialCharacter': 'Ω'
    };
    if (!n.textContent.trim()) {
      n.textContent = fallbacks[iconName] || '?';
    }
  });

  const names = Array.from(new Set(nodes.map(n => n.getAttribute('data-icon'))));

  loadCodexIcons(names).then(paths => {
    nodes.forEach(n => {
      const name = n.getAttribute('data-icon');
      const p = paths[name];
      if (p) {
        n.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' + p + '</svg>';
      }
    });
  }).catch(console.error);
})();

// === Section Wizard Functions ===
let currentWizardStep = 1;
let wizardState = {
  selectedSection: null,
  customSectionName: '',
  sources: [],
  insertedSectionPosition: null,
  sourcePaletteVisible: false
};

function openSectionWizard() {
  const wizard = document.getElementById('sectionWizard');
  if (wizard) {
    // Reset wizard state
    resetWizardState();
    
    wizard.style.display = 'block';
    // Use setTimeout to ensure the display change has taken effect before adding the class
    setTimeout(() => {
      wizard.classList.add('show');
    }, 10);
    
    // Prevent body scrolling while wizard is open
    document.body.style.overflow = 'hidden';
  }
}

function closeSectionWizard() {
  const wizard = document.getElementById('sectionWizard');
  if (wizard) {
    wizard.classList.remove('show');
    
    // Wait for transition to complete before hiding
    setTimeout(() => {
      wizard.style.display = 'none';
      resetWizardState();
    }, 300);
    
    // Restore body scrolling
    document.body.style.overflow = '';
  }
}

function resetWizardState() {
  // Reset step counter
  currentWizardStep = 1;
  
  // Reset wizard data
  wizardState = {
    selectedSection: null,
    customSectionName: '',
    sources: [],
    insertedSectionPosition: null,
    sourcePaletteVisible: false
  };
  
  // Show only step 1
  showWizardStep(1);
  
  // Clear all card selections
  document.querySelectorAll('.section-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Hide all custom section inputs
  document.querySelectorAll('.custom-section-input').forEach(input => {
    input.style.display = 'none';
  });
  
  // Clear custom section text
  document.querySelectorAll('.custom-section-name').forEach(input => {
    input.value = '';
  });
  
  // Clear sources list
  const sourcesList = document.getElementById('sourcesList');
  if (sourcesList) {
    sourcesList.innerHTML = '';
  }
  
  // Clear review checks
  const reviewChecks = document.getElementById('reviewChecks');
  if (reviewChecks) {
    reviewChecks.innerHTML = '';
  }
  
  // Hide source palette
  hideSourcePalette();
  
  // Reset buttons
  updateWizardButtons();
}

function showWizardStep(stepNumber) {
  // Hide all steps
  document.querySelectorAll('.wizard-step').forEach(step => {
    step.style.display = 'none';
  });
  
  // Show current step
  const currentStep = document.getElementById(`step${stepNumber}`);
  if (currentStep) {
    currentStep.style.display = 'block';
  }
  
  // Update stepper
  document.querySelectorAll('.stepper-item').forEach((item, index) => {
    if (index + 1 === stepNumber) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  currentWizardStep = stepNumber;
  updateWizardButtons();
}

function updateWizardButtons() {
  const backBtn = document.getElementById('wizardBack');
  const skipBtn = document.getElementById('wizardSkip');
  const continueBtn = document.getElementById('wizardContinue');
  const insertBtn = document.getElementById('wizardInsert');
  
  // Show/hide back button
  if (backBtn) {
    backBtn.style.display = currentWizardStep > 1 ? 'inline-block' : 'none';
  }
  
  // Show/hide skip button (only on step 2)
  if (skipBtn) {
    skipBtn.style.display = currentWizardStep === 2 ? 'inline-block' : 'none';
  }
  
  // Show/hide continue button
  if (continueBtn) {
    continueBtn.style.display = currentWizardStep < 3 ? 'inline-block' : 'none';
    
    // Enable/disable continue button based on step
    if (currentWizardStep === 1) {
      continueBtn.disabled = !wizardState.selectedSection;
    } else if (currentWizardStep === 2) {
      continueBtn.disabled = false; // Can continue even without sources
    }
  }
  
  // Show/hide insert button (only on step 3)
  if (insertBtn) {
    insertBtn.style.display = currentWizardStep === 3 ? 'inline-block' : 'none';
    insertBtn.disabled = false; // Always allow finishing
  }
}

// Removed isReadyToInsert - no longer needed with inline compose

function proceedToNextStep() {
  if (currentWizardStep === 1) {
    // Save selected section
    const selectedCard = document.querySelector('.section-card.selected');
    if (selectedCard) {
      if (selectedCard.dataset.section === 'custom') {
        const customName = selectedCard.querySelector('.custom-section-name');
        wizardState.selectedSection = customName ? customName.value.trim() : '';
        wizardState.customSectionName = wizardState.selectedSection;
      } else {
        wizardState.selectedSection = selectedCard.querySelector('.section-card-title').textContent;
      }
    }
    
    // Immediately insert section scaffold and switch to edit mode
    insertSectionScaffold();
    
    // Update chosen section displays
    document.querySelectorAll('.chosen-section-name').forEach(span => {
      span.textContent = wizardState.selectedSection;
    });
    
    showWizardStep(2);
    
  } else if (currentWizardStep === 2) {
    // Show source palette if we have sources
    if (wizardState.sources.length > 0) {
      showSourcePalette();
    }
    
    // Run review checks
    runReviewChecks();
    showWizardStep(3);
  }
}

function goBackStep() {
  if (currentWizardStep > 1) {
    showWizardStep(currentWizardStep - 1);
  }
}

function skipStep() {
  if (currentWizardStep === 2) {
    // Show nudge if no sources added
    if (wizardState.sources.length === 0) {
      const sourcesNudge = document.getElementById('sourcesNudge');
      if (sourcesNudge) {
        sourcesNudge.style.display = 'block';
      }
    }
    proceedToNextStep();
  }
}

function insertSectionScaffold() {
  if (!quill || !isEditMode) {
    // If not in edit mode, enter it first
    if (!isEditMode) {
      enterEditMode();
    }
    
    // Wait for quill to be ready
    setTimeout(() => {
      insertSectionScaffold();
    }, 100);
    return;
  }
  
  const length = quill.getLength();
  
  // Insert section heading
  quill.insertText(length - 1, '\n\n'); // Add some space
  quill.insertText(length + 1, wizardState.selectedSection + '\n', { header: 2 });
  
  // Insert a placeholder paragraph
  const placeholderText = 'Start writing about ' + wizardState.selectedSection + '...';
  quill.insertText(quill.getLength() - 1, placeholderText + '\n');
  
  // Position cursor after the heading
  const cursorPosition = length + wizardState.selectedSection.length + 3;
  quill.setSelection(cursorPosition, placeholderText.length);
  
  // Store position for later reference
  wizardState.insertedSectionPosition = cursorPosition;
}

function runReviewChecks() {
  const reviewChecks = document.getElementById('reviewChecks');
  const reviewPreview = document.getElementById('reviewPreview');
  
  if (!reviewChecks || !reviewPreview) return;
  
  let warnings = [];
  
  // Check for uncited content
  const draftEditor = document.getElementById('draftEditor');
  const hasContent = draftEditor && draftEditor.textContent.trim();
  const hasCitations = wizardState.sources.length > 0;
  
  if (hasContent && !hasCitations) {
    warnings.push({
      icon: '⚠️',
      title: 'Uncited content',
      text: 'This content appears to lack citations. For living persons (BLP), all content must be cited.'
    });
  }
  
  // Check if no sources were added
  if (wizardState.sources.length === 0) {
    warnings.push({
      icon: '📚',
      title: 'No sources provided',
      text: 'Consider adding reliable sources to support your content.'
    });
  }
  
  // Display warning cards
  let warningsHTML = '';
  warnings.forEach(warning => {
    warningsHTML += `
      <div class="review-issue">
        <div class="review-issue-icon">${warning.icon}</div>
        <div class="review-issue-content">
          <div class="review-issue-title">${warning.title}</div>
          <div class="review-issue-text">${warning.text}</div>
        </div>
      </div>
    `;
  });
  
  reviewChecks.innerHTML = warnings.length > 0 ? warningsHTML : '<p style="color: #00af89; font-weight: 500;">✓ No issues found. Ready to insert!</p>';
  
  // Display preview
  const draftContent = draftEditor ? draftEditor.innerHTML : '';
  reviewPreview.innerHTML = `
    <h4>${wizardState.selectedSection}</h4>
    <div class="review-preview-content">${draftContent || 'No content to preview.'}</div>
  `;
}

function finishSection() {
  // Show success toast
  showToast(`Section "${wizardState.selectedSection}" added successfully!`);
  
  // Hide source palette
  hideSourcePalette();
  
  // Close wizard
  closeSectionWizard();
}

function showSourcePalette() {
  const palette = document.getElementById('sourcePalette');
  const paletteContent = document.getElementById('sourcePaletteContent');
  
  if (!palette || !paletteContent) return;
  
  // Populate with source statements
  let statementsHTML = '';
  wizardState.sources.forEach((source, sourceIndex) => {
    source.sentences.forEach((sentence, sentenceIndex) => {
      statementsHTML += `
        <div class="source-statement-item" data-source="${sourceIndex}" data-sentence="${sentenceIndex}">
          <div class="source-statement-text">${sentence}</div>
          <div class="source-statement-citation">[${sourceIndex + 1}]</div>
        </div>
      `;
    });
  });
  
  paletteContent.innerHTML = statementsHTML;
  
  // Show palette
  palette.style.display = 'block';
  setTimeout(() => {
    palette.classList.add('show');
  }, 10);
  
  wizardState.sourcePaletteVisible = true;
}

function hideSourcePalette() {
  const palette = document.getElementById('sourcePalette');
  if (!palette) return;
  
  palette.classList.remove('show');
  setTimeout(() => {
    palette.style.display = 'none';
  }, 300);
  
  wizardState.sourcePaletteVisible = false;
}

function insertTextAtCursor(text) {
  if (!quill) return;
  
  const selection = quill.getSelection();
  if (selection) {
    quill.insertText(selection.index, text + ' ');
    quill.setSelection(selection.index + text.length + 1);
  } else {
    // Insert at the end if no selection
    const length = quill.getLength();
    quill.insertText(length - 1, text + ' ');
    quill.setSelection(length + text.length);
  }
}

function showToast(message) {
  // Create and show a simple toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #00af89;
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    z-index: 4000;
    animation: slideUpToast 0.3s ease-out;
  `;
  toast.textContent = message;
  
  // Add keyframe animation
  if (!document.getElementById('toastStyles')) {
    const style = document.createElement('style');
    style.id = 'toastStyles';
    style.textContent = `
      @keyframes slideUpToast {
        from { transform: translate(-50%, 100%); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideUpToast 0.3s ease-out reverse';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Sidebar variant: disable Gutter Flicks interactions
try { initGutterFlicks = function(){ /*disabled*/ }; } catch(e) {}

// === Help Expand Ghost Chip (stub UX) ===
function initHelpExpandChip() {
  const container = document.getElementById('articleBody');
  if (!container) return;
  // Only show on stubby articles (allow lead + at most one real section)
  const sectionTitles = Array.from(container.querySelectorAll('.article-section__title'))
    .filter(title => !/^(see also|references)$/i.test((title.textContent || '').trim()));
  if (sectionTitles.length > 1) return;

  const leadP = container.querySelector('p');
  const primarySections = sectionTitles.map(title => title.closest('.article-section')).filter(Boolean);
  const insertAfter = primarySections.length ? primarySections[primarySections.length - 1] : null;
  // Build chip
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'help-expand-chip';
  chip.id = 'helpExpandChip';
  chip.setAttribute('aria-haspopup', 'dialog');
  chip.setAttribute('aria-expanded', 'false');
  chip.setAttribute('aria-label', 'Suggest coffee topics to add to this article');
  chip.textContent = 'Suggest coffee topics';
  // Start hidden; reveal after lead is visible for 5s
  chip.classList.add('help-chip-hidden');
  try { chip.tabIndex = -1; } catch {}

  // Place chip after the last primary section, otherwise after lead
  if (insertAfter && insertAfter.parentNode) {
    insertAfter.insertAdjacentElement('afterend', chip);
  } else if (leadP && leadP.parentNode) {
    leadP.insertAdjacentElement('afterend', chip);
  } else {
    container.insertAdjacentElement('afterbegin', chip);
  }

  let chipTimer = null; let revealed = false;
  function revealChip(){ if (revealed) return; revealed = true; chip.classList.remove('help-chip-hidden'); try { chip.tabIndex = 0; } catch {} }
  const observeTarget = insertAfter || leadP;
  if (observeTarget) {
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if (entry.target !== observeTarget) return;
        if (entry.isIntersecting) {
          if (!chipTimer) chipTimer = setTimeout(revealChip, 4000);
        } else {
          if (chipTimer) { clearTimeout(chipTimer); chipTimer = null; }
        }
      });
    }, { threshold: 0.4 });
    io.observe(observeTarget);
  } else { setTimeout(revealChip, 5000); }

  // Build popover (lazy)
  let popover = null;
  const suggestions = [
    { id: 'coffee_history', title: 'History', desc: 'Origins of coffee, its spread from Ethiopia and Yemen, and early coffeehouses.' },
    { id: 'coffee_cultivation', title: 'Cultivation & processing', desc: 'How coffee cherries are grown, harvested, and processed into beans.' },
    { id: 'coffee_varieties', title: 'Bean varieties', desc: 'Differences between arabica, robusta, and other Coffea species.' },
    { id: 'coffee_brewing', title: 'Brewing methods', desc: 'Techniques such as espresso, pour-over, immersion, and cold brew.' }
  ];
  const MAX_SELECT = 3;

  function openPopover() {
    if (popover) return positionPopover();
    popover = document.createElement('div');
    popover.id = 'helpExpandPopover';
    popover.className = 'help-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-labelledby', 'helpExpandTitle');
    popover.setAttribute('aria-modal', 'false');
    popover.innerHTML = `
      <div class="help-popover__header" id="helpExpandTitle">
        <span class="help-popover__title">What would you like to learn more about coffee?</span>
        <button type="button" class="help-popover__close" aria-label="Close">×</button>
      </div>
      <div class="help-popover__body">
        <form id="helpExpandForm" class="help-popover__form" onsubmit="return false;">
          ${suggestions.map((s, i) => `
            <label class="help-option">
              <input type="checkbox" value="${s.id}" data-title="${s.title}">
              <span class="help-option__text">
                <span class="help-option__title">${s.title}</span>
                <span class="help-option__desc">${s.desc}</span>
              </span>
            </label>
          `).join('')}
        </form>
      </div>
      <div class="help-popover__actions">
        <button type="button" class="help-btn help-btn--secondary" id="helpCancel">Not now</button>
        <button type="button" class="help-btn" id="helpSubmit" disabled>Send</button>
      </div>
    `;
    document.body.appendChild(popover);

    // Wire close button
    const closeBtn = popover.querySelector('.help-popover__close');
    if (closeBtn) closeBtn.addEventListener('click', closePopover);


    // Wire selection limit and buttons
    const form = popover.querySelector('#helpExpandForm');
    const boxes = Array.from(form.querySelectorAll('input[type="checkbox"]'));
    const submit = popover.querySelector('#helpSubmit');
    const cancel = popover.querySelector('#helpCancel');

    function updateState() {
      const checked = boxes.filter(b => b.checked);
      submit.disabled = checked.length === 0;
      // Enforce max
      if (checked.length >= MAX_SELECT) {
        boxes.forEach(b => { if (!b.checked) { b.disabled = true; b.parentElement.classList.add('disabled'); } });
      } else {
        boxes.forEach(b => { b.disabled = false; b.parentElement.classList.remove('disabled'); });
      }
    }
    boxes.forEach(b => b.addEventListener('change', updateState));
    cancel.addEventListener('click', closePopover);
    submit.addEventListener('click', () => {
      const picked = boxes.filter(b => b.checked).map(b => ({ id: b.value, title: b.getAttribute('data-title') }));
      // Record one signal per picked section
      picked.forEach(p => {
        recordWhisperSignal({
          sectionId: 'wishlist:' + p.id,
          sectionTitle: p.title,
          chips: [ 'wishlist' ],
          note: ''
        });
      });
      closePopover();
      showWhisperToast('Thanks — your picks were recorded.');
    });

    // A11y + outside click + Esc
    setTimeout(() => {
      try { form.querySelector('input[type="checkbox"]').focus(); } catch {}
    }, 0);
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    positionPopover();
  }

  function positionPopover() {
    if (!popover) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const rect = chip.getBoundingClientRect();
    if (isMobile) {
      popover.classList.add('is-mobile');
      popover.style.left = '0';
      popover.style.right = '0';
      popover.style.bottom = '0';
      popover.style.top = 'auto';
      popover.style.transform = 'none';
    } else {
      popover.classList.remove('is-mobile');
      const PANEL_W = Math.min(360, Math.floor(window.innerWidth * 0.9));
      popover.style.width = PANEL_W + 'px';
      const top = Math.min(window.innerHeight - 20 - popover.offsetHeight, window.scrollY + rect.bottom + 6);
      let left = Math.floor(window.scrollX + rect.left);
      left = Math.max(12, Math.min(left, window.innerWidth - PANEL_W - 12));
      popover.style.top = top + 'px';
      popover.style.left = left + 'px';
    }
    chip.setAttribute('aria-expanded', 'true');
  }

  function closePopover() {
    chip.setAttribute('aria-expanded', 'false');
  chip.setAttribute('aria-label', 'Suggest topics to add to this article');
    if (!popover) return;
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    if (popover.parentNode) popover.parentNode.removeChild(popover);
    popover = null;
    chip.focus();
  }

  function onDocClick(e) {
    if (!popover) return;
    if (e.target === chip || popover.contains(e.target)) return;
    closePopover();
  }
  function onKeyDown(e) { if (e.key === 'Escape') closePopover(); }

  chip.addEventListener('click', () => {
    if (popover) closePopover(); else openPopover();
  });
  chip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (popover) closePopover(); else openPopover(); }
  });
}
