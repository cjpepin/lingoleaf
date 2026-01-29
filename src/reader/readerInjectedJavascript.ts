/**
 * readerInjectedJavascript
 *
 * Centralized injected WebView JavaScript for the EPUB Reader.
 * Keep this as a single source of truth so ReaderScreen stays readable.
 */

export const READER_INJECTED_JAVASCRIPT = `
    (function() {
      console.log('🚀 LingoLeaf JS injected!');

      function postToRN(payload) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (e) {}
      }
      
      // Just apply CSS to suppress menu - let epub.js handle selection detection
      function applyCSS(doc) {
        if (doc.__llCSS) return;
        
        const style = doc.createElement('style');
        style.textContent = \`
          * {
            -webkit-touch-callout: none !important;
            -webkit-user-select: text !important;
            user-select: text !important;
          }
          ::selection {
            background: rgba(180, 215, 255, 0.4) !important;
          }
        \`;
        (doc.head || doc.documentElement).appendChild(style);
        
        // Block context menu
        doc.addEventListener('contextmenu', e => {
          e.preventDefault();
          return false;
        }, { capture: true, passive: false });
        
        doc.__llCSS = true;
        console.log('✅ CSS applied to', doc.location?.href || 'document');
      }

      function attachSelectionDebug(doc) {
        if (doc.__llSelectionDebug) return;
        try {
          const handler = () => {
            try {
              const sel = doc.getSelection ? doc.getSelection() : null;
              const text = sel ? (sel.toString() || '').trim() : '';
              const href = doc.location?.href || null;

              // Emit "selection cleared" once when transitioning from non-empty -> empty
              if (!text) {
                if (doc.__llHadSelection) {
                  doc.__llHadSelection = false;
                  doc.__llLastSelectionText = '';
                  postToRN({
                    type: 'llSelectionCleared',
                    sourceHref: href,
                  });
                }
                return;
              }

              // De-dupe repeated events (selectionchange can spam)
              if (doc.__llLastSelectionText === text) return;
              doc.__llLastSelectionText = text;
              doc.__llHadSelection = true;

              let rect = null;
              let context = null;
              try {
                if (sel && sel.rangeCount > 0) {
                  const range = sel.getRangeAt(0);
                  const r = range.getBoundingClientRect();
                  rect = { x: r.x, y: r.y, width: r.width, height: r.height };

                  // Context: 1 word before + 1 word after, best-effort (works reliably for single text node selections)
                  try {
                    const sc = range.startContainer;
                    const ec = range.endContainer;
                    if (sc && ec && sc === ec && sc.nodeType === 3) {
                      const full = (sc.textContent || '');
                      const start = range.startOffset;
                      const end = range.endOffset;

                      const isWs = (ch) => ch === ' ' || ch === '\\n' || ch === '\\t' || ch === '\\r';

                      let left = start;
                      // Skip whitespace immediately before selection
                      while (left > 0 && isWs(full[left - 1])) left--;
                      // Consume one word before
                      while (left > 0 && !isWs(full[left - 1])) left--;
                      // Optional: also include any whitespace between word and selection
                      while (left > 0 && isWs(full[left - 1])) left--;
                      while (left > 0 && !isWs(full[left - 1])) left--;

                      let right = end;
                      // Skip whitespace immediately after selection
                      while (right < full.length && isWs(full[right])) right++;
                      // Consume one word after
                      while (right < full.length && !isWs(full[right])) right++;

                      const slice = full.slice(left, right).trim();
                      if (slice && slice !== text) context = slice;
                    }
                  } catch (e) {}
                }
              } catch (e) {}

              postToRN({
                type: 'llSelectionDebug',
                sourceHref: href,
                text: text.length > 400 ? text.slice(0, 400) : text,
                context,
                rect,
              });
            } catch (e) {}
          };

          doc.addEventListener('selectionchange', handler, { passive: true });
          doc.addEventListener('mouseup', handler, { passive: true });
          doc.addEventListener('touchend', handler, { passive: true });
          doc.__llHadSelection = false;
          doc.__llLastSelectionText = '';
          doc.__llSelectionDebug = true;
          console.log('✅ Selection debug attached to', doc.location?.href || 'document');
        } catch (e) {}
      }

      function attachRelocatedBridge() {
        try {
          if (window.__llRelocatedBridge) return;

          // These are defined by the epubjs template (same JS context).
          const r = (typeof rendition !== 'undefined' && rendition) ? rendition : (window.rendition || null);
          const b = (typeof book !== 'undefined' && book) ? book : (window.book || null);
          if (!r || !r.on) return;

          const emitLocation = function(source) {
            try {
              const reactNativeWebview = window.ReactNativeWebView !== undefined && window.ReactNativeWebView!== null ? window.ReactNativeWebView: window;
              const location = (typeof r.currentLocation === 'function') ? r.currentLocation() : null;
              if (!location || !location.start || !location.start.cfi) return;

              let totalLocations = 0;
              let progress = 0;
              let currentSection = null;

              try {
                totalLocations = b && b.locations && typeof b.locations.total === 'number' ? b.locations.total : 0;
              } catch (e1) {}

              try {
                const percent = b && b.locations && b.locations.percentageFromCfi && location.start && location.start.cfi
                  ? b.locations.percentageFromCfi(location.start.cfi)
                  : 0;
                progress = Number.isFinite(percent) ? Math.floor(percent * 100) : 0;
              } catch (e2) {
                progress = 0;
              }

              // Best-effort: resolve section from href without loading/manipulating spine docs.
              try {
                const href = location && location.start ? location.start.href : null;
                if (b && b.navigation && typeof b.navigation.get === 'function' && href) {
                  currentSection = b.navigation.get(href);
                }
              } catch (e3) {
                currentSection = null;
              }

              reactNativeWebview.postMessage(JSON.stringify({
                type: 'onLocationChange',
                totalLocations: totalLocations,
                currentLocation: location,
                progress: progress,
                currentSection: currentSection,
                llSafeRelocated: true,
                llSource: source || 'unknown',
              }));
            } catch (e4) {}
          };

          // Primary: normal epub.js event.
          r.on('relocated', function() {
            emitLocation('relocated');
          });

          // Backstop: ensure we still emit after explicit navigation calls.
          // This covers cases where epub.js doesn't emit 'relocated' (or a handler throws elsewhere).
          if (!window.__llRelocatedBridgePatched) {
            window.__llRelocatedBridgePatched = true;

            try {
              if (typeof r.next === 'function') {
                const origNext = r.next.bind(r);
                r.next = function() {
                  const out = origNext.apply(null, arguments);
                  Promise.resolve(out).then(function() { setTimeout(function() { emitLocation('next'); }, 0); })
                    .catch(function() { setTimeout(function() { emitLocation('next'); }, 0); });
                  return out;
                };
              }
            } catch (e5) {}

            try {
              if (typeof r.prev === 'function') {
                const origPrev = r.prev.bind(r);
                r.prev = function() {
                  const out = origPrev.apply(null, arguments);
                  Promise.resolve(out).then(function() { setTimeout(function() { emitLocation('prev'); }, 0); })
                    .catch(function() { setTimeout(function() { emitLocation('prev'); }, 0); });
                  return out;
                };
              }
            } catch (e6) {}

            try {
              if (typeof r.display === 'function') {
                const origDisplay = r.display.bind(r);
                r.display = function() {
                  const out = origDisplay.apply(null, arguments);
                  Promise.resolve(out).then(function() { setTimeout(function() { emitLocation('display'); }, 0); })
                    .catch(function() { setTimeout(function() { emitLocation('display'); }, 0); });
                  return out;
                };
              }
            } catch (e7) {}
          }

          window.__llRelocatedBridge = true;
          console.log('✅ Relocated bridge attached');
        } catch (e) {}
      }
      
      // Apply to main doc
      applyCSS(document);
      attachSelectionDebug(document);

      // Ensure onLocationChange is always emitted, even if the template's handler throws.
      // We retry briefly because 'book'/'rendition' might not be initialized yet.
      attachRelocatedBridge();
      let llRelocatedAttempts = 0;
      const llRelocatedTimer = setInterval(() => {
        attachRelocatedBridge();
        llRelocatedAttempts++;
        if (window.__llRelocatedBridge || llRelocatedAttempts > 50) clearInterval(llRelocatedTimer);
      }, 100);
      
      // Patch iframes
      function patchIframes() {
        document.querySelectorAll('iframe').forEach((iframe, i) => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc && !doc.__llCSS) {
              applyCSS(doc);
              console.log('✅ Patched iframe', i);
            }
            if (doc && !doc.__llSelectionDebug) {
              attachSelectionDebug(doc);
            }
          } catch (e) {
            if (!iframe.__listener) {
              iframe.addEventListener('load', () => {
                try {
                  const doc = iframe.contentDocument || iframe.contentWindow?.document;
                  if (doc) {
                    applyCSS(doc);
                    attachSelectionDebug(doc);
                  }
                } catch (e2) {}
              });
              iframe.__listener = true;
            }
          }
        });
      }
      
      patchIframes();
      new MutationObserver(patchIframes).observe(document.documentElement, { childList: true, subtree: true });
      
      let count = 0;
      const interval = setInterval(() => {
        patchIframes();
        if (++count > 100) clearInterval(interval);
      }, 100);

      // Detect clicks on highlights (epub.js adds data-epubcfi attribute to highlight elements)
      document.addEventListener('click', function(e) {
        try {
          var target = e.target;
          // Walk up the DOM to find a highlight element
          for (var i = 0; i < 5 && target; i++) {
            if (target.dataset && target.dataset.epubcfi) {
              var cfi = target.dataset.epubcfi;
              var highlightId = target.dataset.id || null;
              postToRN({ type: 'llHighlightClicked', cfi: cfi, highlightId: highlightId });
              e.stopPropagation();
              e.preventDefault();
              return;
            }
            target = target.parentElement;
          }
        } catch (err) {}
      }, true);
      
      console.log('✅ LingoLeaf JS initialized');
    })();
    true;
  `;


