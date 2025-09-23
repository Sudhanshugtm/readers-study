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

// Initialize on page load: ensure we set title and build ToC

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  loadArticleContent();
  try { buildTableOfContents(); } catch (e) { console.warn('TOC build error', e); }
  setupEventListeners();
  initWhisperChips();
});

function loadArticleContent() {
  const articleBody = document.getElementById('articleBody');
  // Use global articleData if available, otherwise fall back to defaultArticle
  const currentArticle = (typeof articleData !== 'undefined') ? articleData : defaultArticle;
  // Update page heading text from article title
  try { document.querySelectorAll('.firstHeading').forEach(el => { el.textContent = currentArticle.title || 'Article'; }); } catch (e) {}
  const htmlContent = convertMediaWikiToHTML(currentArticle.content);
  articleBody.innerHTML = htmlContent;
}

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
  
  // Add closing div for last section
  html += '</div></section>';
  
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

// Alternative Feedback Designs: main init
function initWhisperChips() {
  const article = document.getElementById('articleBody');
  if (!article) return;

  // Text selection feedback (Medium-style)
  setupTextSelectionFeedback();

  // Sidebar feedback approach (commented out for now)
  // setupSidebarFeedback();

  // Old selection popover removed - using new text selection feedback instead

  // Sheet wiring
  wireWhisperSheet();
}

// Text Selection Feedback (Medium-style, native web API)
function setupTextSelectionFeedback() {
  let selectionPopover = null;
  let selectionTimeout = null;
  let isSelecting = false;

  // Track when user is actively selecting (mousedown to mouseup)
  document.addEventListener('mousedown', () => {
    isSelecting = true;
  });

  document.addEventListener('mouseup', () => {
    if (isSelecting) {
      isSelecting = false;
      // Wait a bit after mouseup to ensure selection is finalized
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        handleSelectionChange();
      }, 150);
    }
  });

  // Also handle selection via keyboard or programmatic changes
  document.addEventListener('selectionchange', () => {
    // Only handle if not actively selecting with mouse
    if (!isSelecting) {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        handleSelectionChange();
      }, 100);
    }
  });

  function handleSelectionChange() {
    const selection = window.getSelection();

    // Hide existing popover if selection is invalid
    if (!selection || selection.isCollapsed) {
      if (selectionPopover) {
        dismissPopover();
      }
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 5) {
      if (selectionPopover) {
        dismissPopover();
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Don't react if selection is within the popover itself
    if (selectionPopover && selectionPopover.contains(container)) {
      return;
    }

    // Ensure selection is within the article body
    const articleBody = document.getElementById('articleBody');
    if (!articleBody || !articleBody.contains(container)) {
      if (selectionPopover) {
        dismissPopover();
      }
      return;
    }

    // Show or update the popover
    if (selectionPopover) {
      positionPopover(selectionPopover, range);
    } else {
      showSelectionFeedback(range, selectedText);
    }
  }


  function showSelectionFeedback(range, selectedText) {
    selectionPopover = document.createElement('div');
    selectionPopover.className = 'selection-feedback-popover';

    // Create sophisticated, modern UI with accessibility
    selectionPopover.innerHTML = `
      <div class="feedback-container" role="dialog" aria-label="Feedback options for selected text">
        <button class="feedback-close-btn" id="feedbackClose" title="Close feedback panel" aria-label="Close feedback panel">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M6 4.586L9.707.879a1 1 0 011.414 1.414L7.414 6l3.707 3.707a1 1 0 01-1.414 1.414L6 7.414l-3.707 3.707a1 1 0 01-1.414-1.414L4.586 6 .879 2.293a1 1 0 011.414-1.414L6 4.586z"/>
          </svg>
        </button>

        <div class="feedback-main" id="feedbackMain">
          <div class="feedback-title" id="feedbackTitle">Help improve this part</div>
          <div class="feedback-reactions">
            <button class="reaction-btn" data-type="citation_needed" title="Flag this as needing a citation" aria-label="Flag this as needing a citation">
              <span class="reaction-label">Citation needed</span>
            </button>
            <button class="reaction-btn" data-type="needs_expansion" title="Suggest expanding this section" aria-label="Suggest expanding this section">
              <span class="reaction-label">Needs expansion</span>
            </button>
            <button class="reaction-btn" data-type="add_section" title="Suggest adding a new section" aria-label="Suggest adding a new section">
              <span class="reaction-label">Add new section</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Insert hidden for accurate measurement, then position
    selectionPopover.style.visibility = 'hidden';
    document.body.appendChild(selectionPopover);
    positionPopover(selectionPopover, range);
    selectionPopover.style.visibility = 'visible';

    // Setup interactions
    setupPopoverInteractions(selectionPopover, selectedText, range);

    // Auto-dismiss after 60 seconds
    const autoDismissTimer = setTimeout(() => {
      if (selectionPopover && selectionPopover.parentNode) {
        dismissPopover();
      }
    }, 60000);

    // Store timer so we can clear it if user expands to note mode
    selectionPopover.autoDismissTimer = autoDismissTimer;
  }

  function positionPopover(popover, range) {
    const rect = range.getBoundingClientRect();
    const popoverWidth = 300;
    const popoverHeight = Math.max(120, popover.offsetHeight || 0);

    // Try to center above selection
    const GAP = 12;
    let top = window.scrollY + rect.top - popoverHeight - GAP;
    let left = window.scrollX + rect.left + (rect.width / 2) - (popoverWidth / 2);

    // Adjust if off-screen
    const padding = 16;
    left = Math.max(padding, Math.min(left, window.innerWidth - popoverWidth - padding));

    // If no room above, position below
    if (top < padding) {
      top = window.scrollY + rect.bottom + GAP;
    }

    popover.style.position = 'absolute';
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.zIndex = '1001';
    popover.style.width = `${popoverWidth}px`;
  }

  function setupPopoverInteractions(popover, selectedText, range) {
    const closeBtn = popover.querySelector('#feedbackClose');
    const feedbackMain = popover.querySelector('#feedbackMain');

    // Close button
    closeBtn.addEventListener('click', () => {
      dismissPopover();
    });

    // Reaction buttons
    popover.addEventListener('click', (e) => {
      const reactionBtn = e.target.closest('.reaction-btn');
      if (reactionBtn) {
        handleReactionClick(reactionBtn, selectedText, range);
        return;
      }
    });
    
  }

  function handleReactionClick(btn, selectedText, range) {
    const type = btn.getAttribute('data-type');

    // Add selected state
    btn.classList.add('selected');

    if (type === 'add_section') {
      openAddSectionPanel(range);
      return;
    }

    // One-tap actions complete immediately
    recordSelectionFeedback(selectedText, type, range);
    showReactionSuccess(selectionPopover, type, { fast: true });
  }

  function expandToNoteMode(mainElement, expandedElement, textarea) {
    // Clear auto-dismiss timer when user enters note mode
    if (selectionPopover && selectionPopover.autoDismissTimer) {
      clearTimeout(selectionPopover.autoDismissTimer);
      selectionPopover.autoDismissTimer = null;
    }

    mainElement.style.opacity = '0';
    mainElement.style.transform = 'translateY(-8px)';

    setTimeout(() => {
      mainElement.style.display = 'none';
      expandedElement.style.display = 'block';

      requestAnimationFrame(() => {
        expandedElement.style.opacity = '1';
        expandedElement.style.transform = 'translateY(0)';
        textarea.focus();
      });
    }, 150);
  }

  function collapseFromNoteMode(mainElement, expandedElement) {
    expandedElement.style.opacity = '0';
    expandedElement.style.transform = 'translateY(8px)';

    setTimeout(() => {
      expandedElement.style.display = 'none';
      mainElement.style.display = 'block';

      requestAnimationFrame(() => {
        mainElement.style.opacity = '1';
        mainElement.style.transform = 'translateY(0)';
      });
    }, 150);
  }

  function showReactionSuccess(popover, type, opts = {}) {
    const labels = {
      citation_needed: 'Citation needed',
      needs_expansion: 'Needs expansion',
      add_section: 'Add new section'
    };
    const msg = labels[type] || 'Recorded';
    popover.innerHTML = `
      <div class="feedback-success">
        <div class="success-message">${msg} — thanks!</div>
      </div>
    `;

    setTimeout(() => {
      dismissPopover();
    }, opts.fast ? 900 : 1500);
  }

  function openAddSectionPanel(range) {
    const main = selectionPopover.querySelector('#feedbackMain');
    if (!main) return;
    const suggestions = [
      { id: 'physical_characteristics', title: 'Physical characteristics' },
      { id: 'atmosphere', title: 'Atmosphere' },
      { id: 'exploration', title: 'Exploration' }
    ];
    main.innerHTML = `
      <div class="feedback-title">Add a new section</div>
      <div class="add-section-options" id="addSectionOptions">
        ${suggestions.map(s => `
          <button type=\"button\" class=\"add-section-chip\" data-id=\"${s.id}\" aria-pressed=\"false\">${s.title}</button>
        `).join('')}
      </div>
      <div class="add-section-actions">
        <button type="button" class="add-section-back" id="addSectionBack">Back</button>
        <button type="button" class="add-section-send" id="addSectionSend" disabled>Send</button>
      </div>
    `;

    const optsEl = main.querySelector('#addSectionOptions');
    const backBtn = main.querySelector('#addSectionBack');
    const sendBtn = main.querySelector('#addSectionSend');
    const selected = new Set();

    optsEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.add-section-chip');
      if (!chip) return;
      const id = chip.getAttribute('data-id');
      const pressed = chip.getAttribute('aria-pressed') === 'true';
      if (pressed) { selected.delete(id); chip.setAttribute('aria-pressed','false'); }
      else { if (selected.size >= 3) return; selected.add(id); chip.setAttribute('aria-pressed','true'); }
      sendBtn.disabled = selected.size === 0;
    });

    backBtn.addEventListener('click', () => {
      showSelectionFeedback(range, '');
    });

    sendBtn.addEventListener('click', () => {
      selected.forEach(id => {
        whisperState = {
          sectionId: 'wishlist:' + id,
          sectionTitle: id.replace(/_/g, ' '),
          chips: new Set(['wishlist']),
          quote: ''
        };
        recordWhisperSignal();
      });
      showReactionSuccess(selectionPopover, 'add_section');
    });
  }

  function showSubmissionSuccess(popover) {
    popover.innerHTML = `
      <div class="feedback-success">
        <div class="success-emoji">✨</div>
        <div class="success-message">Feedback submitted!</div>
      </div>
    `;

    setTimeout(() => {
      dismissPopover();
    }, 2000);
  }

  function dismissPopover() {
    if (selectionPopover && selectionPopover.parentNode) {
      selectionPopover.style.opacity = '0';
      selectionPopover.style.transform = 'translateY(-8px) scale(0.95)';
      setTimeout(() => {
        if (selectionPopover && selectionPopover.parentNode) {
          selectionPopover.remove();
          selectionPopover = null;
        }
      }, 200);
    }
  }

  function recordDetailedFeedback(selectedText, note, range) {
    const page = (typeof articleData !== 'undefined') ? articleData : defaultArticle;
    const section = findNearestSection(range.commonAncestorContainer);

    const payload = {
      type: 'detailed',
      pageId: page.id || 'page',
      pageTitle: page.title,
      selectedText: selectedText.slice(0, 200),
      sectionId: section.id,
      sectionTitle: section.title,
      ts: Date.now(),
      device: { w: window.innerWidth, h: window.innerHeight }
    };

    const queue = loadQueue(payload.pageId);
    queue.push(payload);
    saveQueue(payload.pageId, queue);

    console.log('Detailed feedback recorded:', payload);
  }

  function recordCombinedFeedback(selectedText, note, reactionType, range) {
    const page = (typeof articleData !== 'undefined') ? articleData : defaultArticle;
    const section = findNearestSection(range.commonAncestorContainer);

    const payload = {
      type: 'combined',
      pageId: page.id || 'page',
      pageTitle: page.title,
      selectedText: selectedText.slice(0, 200),
      reaction: reactionType,
      sectionId: section.id,
      sectionTitle: section.title,
      ts: Date.now(),
      device: { w: window.innerWidth, h: window.innerHeight }
    };

    const queue = loadQueue(payload.pageId);
    queue.push(payload);
    saveQueue(payload.pageId, queue);

    console.log('Combined feedback recorded:', payload);
  }

  // Click outside to dismiss (but be smart about it)
  document.addEventListener('click', (e) => {
    if (selectionPopover && !selectionPopover.contains(e.target) && !isSelecting) {
      dismissPopover();
    }
  });
}

// Show ultra-subtle feedback prompt after reading completion
function showGentleFeedbackPrompt(sectionId, sectionElement) {
  // Check if already prompted for this section
  if (sectionElement.dataset.feedbackPrompted) return;
  sectionElement.dataset.feedbackPrompted = 'true';

  const heading = sectionElement.querySelector('.article-section__title, .article-subsection__title');
  if (!heading) return;

  const prompt = document.createElement('div');
  prompt.className = 'whisper-gentle-prompt';
  prompt.innerHTML = `
    <button class="whisper-gentle-btn" title="This section could be improved">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 0a6 6 0 1 0 0 12A6 6 0 0 0 6 0zM5 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0V3zm1 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
      </svg>
    </button>
  `;

  // Position in far right margin
  prompt.style.position = 'absolute';
  prompt.style.right = '-40px';
  prompt.style.top = '8px';

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    if (prompt.parentNode) {
      prompt.style.opacity = '0';
      setTimeout(() => prompt.remove(), 300);
    }
  }, 8000);

  // Click handler
  prompt.querySelector('.whisper-gentle-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = heading.getBoundingClientRect();
    const sectionTitle = heading.textContent.trim();
    openWhisperSheet({ sectionId, sectionTitle, anchorRect: rect });
    prompt.remove();
  });

  heading.style.position = 'relative';
  heading.appendChild(prompt);

  // Fade in
  requestAnimationFrame(() => {
    prompt.style.opacity = '1';
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
  const headings = Array.from(document.querySelectorAll('#articleBody .article-section__title, #articleBody .article-subsection__title'));
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

let whisperState = { sectionId: '', sectionTitle: '', chips: new Set(), quote: '' };

function wireWhisperSheet() {
  const sheet = document.getElementById('whisperSheet');
  const backdrop = document.getElementById('whisperSheetBackdrop');
  const closeBtn = document.getElementById('whisperSheetClose');
  // Options: checkboxes
  const optMoreDetails = document.getElementById('optMoreDetails');
  const optMoreImages = document.getElementById('optMoreImages');
  
  const submit = document.getElementById('whisperSubmit');
  if (!sheet || !backdrop) return;

  // note block removed
  function updateHelper() {
    const helperEl = document.querySelector('.whisper-helper');
    if (!helperEl) return;
    // Keep helper fixed and neutral
    helperEl.textContent = 'Pick what would help most.  ';
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

  // No free-form note UI in inline variant

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
  const hasContent = (whisperState.chips && whisperState.chips.size > 0);
  submit.disabled = !hasContent;
  if (hasContent) submit.classList.add('enabled'); else submit.classList.remove('enabled');
}

function openWhisperSheet({ sectionId, sectionTitle, quote = '', anchorRect = null }) {
  whisperState = { sectionId, sectionTitle, chips: new Set(), quote };
  const sheet = document.getElementById('whisperSheet');
  const backdrop = document.getElementById('whisperSheetBackdrop');
  const titleEl = document.getElementById('whisperSheetTitle');
  const subEl = document.getElementById('whisperSheetSub');
  

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
  // Talk link removed, nothing to update

  // Reset helper and button state
  const helperEl = document.querySelector('.whisper-helper');
  if (helperEl) helperEl.textContent = 'Pick what would help most.';
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

function currentWhisperPayload() {
  const page = (typeof articleData !== 'undefined') ? articleData : defaultArticle;
  return {
    pageId: page.id || 'page',
    pageTitle: page.title,
    sectionId: whisperState.sectionId,
    sectionTitle: whisperState.sectionTitle,
    chips: Array.from(whisperState.chips),
    
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

function recordWhisperSignal() {
  const payload = currentWhisperPayload();
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
