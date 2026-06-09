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
          html, body {
            overscroll-behavior-y: none !important;
          }
          * {
            -webkit-touch-callout: none !important;
            -webkit-user-select: text !important;
            user-select: text !important;
          }
          ::selection {
            background: rgba(180, 215, 255, 0.4) !important;
          }
          [ref="epubjs-hl"], .epubjs-hl {
            pointer-events: auto !important;
          }
        \`;
        (doc.head || doc.documentElement).appendChild(style);

        // Extra hardening: also set inline styles on root/body so iOS WKWebView
        // respects the suppression of the native "Speak/Spell" callout.
        try {
          if (doc.documentElement && doc.documentElement.style) {
            doc.documentElement.style.webkitTouchCallout = 'none';
            doc.documentElement.style.webkitUserSelect = 'text';
          }
          if (doc.body && doc.body.style) {
            doc.body.style.webkitTouchCallout = 'none';
            doc.body.style.webkitUserSelect = 'text';
          }
        } catch (e) {}
        
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
          // Find iframe offset if this doc is inside an iframe
          function getIframeOffset() {
            try {
              if (doc === window.document) return { x: 0, y: 0 };
              // Find the iframe element that contains this doc
              const iframes = window.document.querySelectorAll('iframe');
              for (let i = 0; i < iframes.length; i++) {
                try {
                  if (iframes[i].contentDocument === doc || iframes[i].contentWindow?.document === doc) {
                    const iframeRect = iframes[i].getBoundingClientRect();
                    return { x: iframeRect.x, y: iframeRect.y };
                  }
                } catch (e) {}
              }
            } catch (e) {}
            return { x: 0, y: 0 };
          }

          function getSelectionPayload() {
            const sel = doc.getSelection ? doc.getSelection() : null;
            const text = sel ? (sel.toString() || '').trim() : '';
            if (!text) return null;
            let rect = null;
            let context = null;
            try {
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const r = range.getBoundingClientRect();
                // Add iframe offset so coords are relative to main window
                const iframeOffset = getIframeOffset();
                rect = { x: r.x + iframeOffset.x, y: r.y + iframeOffset.y, width: r.width, height: r.height };
                try {
                  const sc = range.startContainer;
                  const ec = range.endContainer;
                  if (sc && ec && sc === ec && sc.nodeType === 3) {
                    const full = (sc.textContent || '');
                    const start = range.startOffset;
                    const end = range.endOffset;
                    const isWs = (ch) => ch === ' ' || ch === '\\n' || ch === '\\t' || ch === '\\r';
                    let left = start;
                    while (left > 0 && isWs(full[left - 1])) left--;
                    while (left > 0 && !isWs(full[left - 1])) left--;
                    while (left > 0 && isWs(full[left - 1])) left--;
                    while (left > 0 && !isWs(full[left - 1])) left--;
                    let right = end;
                    while (right < full.length && isWs(full[right])) right++;
                    while (right < full.length && !isWs(full[right])) right++;
                    const slice = full.slice(left, right).trim();
                    if (slice && slice !== text) context = slice;
                  }
                } catch (e) {}
              }
            } catch (e) {}
            return { text: text.length > 400 ? text.slice(0, 400) : text, context, rect };
          }

          doc.addEventListener('selectionchange', function() {
            try {
              const sel = doc.getSelection ? doc.getSelection() : null;
              const text = sel ? (sel.toString() || '').trim() : '';
              const href = doc.location?.href || null;
              if (!text) {
                if (doc.__llHadSelection) {
                  doc.__llHadSelection = false;
                  postToRN({ type: 'llSelectionCleared', sourceHref: href });
                }
              } else {
                doc.__llHadSelection = true;
              }
            } catch (e) {}
          }, { passive: true });

          function commitSelection() {
            try {
              const payload = getSelectionPayload();
              if (!payload || !payload.rect) return;
              const now = Date.now();
              if (doc.__llLastCommitTime != null && now - doc.__llLastCommitTime < 300) return;
              doc.__llLastCommitTime = now;
              postToRN({
                type: 'llSelectionCommitted',
                sourceHref: doc.location?.href || null,
                text: payload.text,
                context: payload.context,
                rect: payload.rect,
              });
            } catch (e) {}
          }

          doc.addEventListener('touchend', function() {
            setTimeout(commitSelection, 0);
          }, { passive: true });
          doc.addEventListener('mouseup', function() {
            setTimeout(commitSelection, 0);
          }, { passive: true });

          doc.__llHadSelection = false;
          doc.__llSelectionDebug = true;
          console.log('✅ Selection committed on touchend/mouseup attached to', doc.location?.href || 'document');
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
            if (doc && !doc.__llHighlightClick) {
              attachHighlightClick(doc);
            }
            if (doc && !doc.__llCenterTap) {
              attachCenterTap(doc);
            }
          } catch (e) {
            if (!iframe.__listener) {
              iframe.addEventListener('load', () => {
                try {
                  const doc = iframe.contentDocument || iframe.contentWindow?.document;
                  if (doc) {
                    applyCSS(doc);
                    attachSelectionDebug(doc);
                    attachHighlightClick(doc);
                    attachCenterTap(doc);
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
      
      // Fast initial patching (first 10s)
      let count = 0;
      const interval = setInterval(() => {
        patchIframes();
        if (++count > 100) clearInterval(interval);
      }, 100);

      // Persistent low-frequency backstop: re-patch iframes every 2s indefinitely.
      // Catches cases where epub.js reloads iframe content (chapter navigation)
      // without adding/removing the iframe element from the DOM.
      setInterval(function() { patchIframes(); }, 2000);

      // Offset of a document's viewport relative to main window (for iframe content)
      function getIframeOffsetForDoc(doc) {
        try {
          if (doc === window.document) return { x: 0, y: 0 };
          var iframes = window.document.querySelectorAll('iframe');
          for (var i = 0; i < iframes.length; i++) {
            try {
              if (iframes[i].contentDocument === doc || (iframes[i].contentWindow && iframes[i].contentWindow.document === doc)) {
                var iframeRect = iframes[i].getBoundingClientRect();
                return { x: iframeRect.left, y: iframeRect.top };
              }
            } catch (e) {}
          }
        } catch (e) {}
        return { x: 0, y: 0 };
      }

      // Shared: set when we send llHighlightClicked so center-tap skips opening nav
      var __llHighlightClickedAt = 0;

      // Original highlight click handler — works because CSS sets pointer-events:auto on .epubjs-hl
      function attachHighlightClick(doc) {
        if (doc.__llHighlightClick) return;
        function handleHighlightTap(e) {
          try {
            var target = e.target;
            for (var i = 0; i < 8 && target; i++) {
              if (target.dataset && target.dataset.epubcfi) {
                __llHighlightClickedAt = Date.now();
                var rect = null;
                try {
                  var bcr = target.getBoundingClientRect();
                  var iOff = getIframeOffsetForDoc(doc);
                  rect = { x: bcr.left + iOff.x, y: bcr.top + iOff.y, width: bcr.width, height: bcr.height };
                } catch (_) {}
                postToRN({ type: 'llHighlightClicked', cfi: target.dataset.epubcfi, highlightId: target.dataset.id || null, rect: rect });
                e.stopPropagation();
                e.preventDefault();
                return;
              }
              target = target.parentElement;
            }
          } catch (err) {}
        }
        doc.addEventListener('click', handleHighlightTap, true);
        doc.addEventListener('touchend', handleHighlightTap, true);
        doc.__llHighlightClick = true;
      }
      attachHighlightClick(document);

      // Center tap — never open nav if tap is on a highlight (check flag first, then by coords)
      var EDGE_MARGIN_PX = 56;
      var MAX_TAP_MOVE_PX = 12;
      function isTapOnHighlight(clientX, clientY, doc) {
        if (Date.now() - __llHighlightClickedAt < 500) return true;
        try {
          var iOff = getIframeOffsetForDoc(doc);
          var mainX = clientX + iOff.x;
          var mainY = clientY + iOff.y;
          var docs = [window.document];
          var iframes = window.document.querySelectorAll('iframe');
          for (var i = 0; i < iframes.length; i++) {
            try {
              var d = iframes[i].contentDocument || (iframes[i].contentWindow && iframes[i].contentWindow.document);
              if (d) docs.push(d);
            } catch (e) {}
          }
          for (var di = 0; di < docs.length; di++) {
            var doff = getIframeOffsetForDoc(docs[di]);
            var px = mainX - doff.x;
            var py = mainY - doff.y;
            var groups = docs[di].querySelectorAll('.epubjs-hl, [ref="epubjs-hl"]');
            for (var g = 0; g < groups.length; g++) {
              var rects = groups[g].querySelectorAll('rect');
              for (var r = 0; r < rects.length; r++) {
                var rect = rects[r].getBoundingClientRect();
                if (px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom) return true;
              }
            }
          }
        } catch (e) {}
        return false;
      }
      function attachCenterTap(doc) {
        if (doc.__llCenterTap) return;
        var touchStartTime = 0;
        var touchStartX = 0;
        var touchStartY = 0;
        var touchStartTarget = null;
        var lastCenterTap = 0;
        function isLinkOrHighlight(el) {
          if (!el) return false;
          if (el.closest && (el.closest('[data-epubcfi]') || el.closest('[data-highlight-id]') || el.closest('.epubjs-hl') || el.closest('[ref="epubjs-hl"]'))) return true;
          for (var i = 0; i < 20 && el; i++) {
            if (el.tagName === 'A' || (el.dataset && (el.dataset.epubcfi || el.dataset.highlightId))) return true;
            if (el.getAttribute && (el.getAttribute('ref') === 'epubjs-hl' || (el.classList && el.classList.contains('epubjs-hl')))) return true;
            el = el.parentElement;
          }
          return false;
        }
        function inCenterZone(clientX, docWidth) {
          if (docWidth <= 2 * EDGE_MARGIN_PX) return true;
          return clientX >= EDGE_MARGIN_PX && clientX <= docWidth - EDGE_MARGIN_PX;
        }
        doc.addEventListener('touchstart', function(e) {
          var t = e.changedTouches && e.changedTouches[0];
          if (t) {
            touchStartTime = Date.now();
            touchStartX = t.clientX;
            touchStartY = t.clientY;
            touchStartTarget = e.target;
          }
        }, { passive: true });
        doc.addEventListener('touchend', function(e) {
          var t = e.changedTouches && e.changedTouches[0];
          if (!t) return;
          // First check: is this tap on a highlight? If yes, never open navigate modal
          if (isTapOnHighlight(t.clientX, t.clientY, doc)) return;
          var duration = Date.now() - touchStartTime;
          if (duration > 350) return;
          var dx = t.clientX - touchStartX;
          var dy = t.clientY - touchStartY;
          if (dx * dx + dy * dy > MAX_TAP_MOVE_PX * MAX_TAP_MOVE_PX) return;
          if (Date.now() - lastCenterTap < 400) return;
          try {
            var sel = doc.getSelection ? doc.getSelection() : null;
            if (sel && (sel.toString() || '').trim().length > 0) return;
            if (isLinkOrHighlight(touchStartTarget || e.target)) return;
            var docWidth = (doc.documentElement && doc.documentElement.clientWidth) || (doc.body && doc.body.clientWidth) || window.innerWidth;
            if (!inCenterZone(t.clientX, docWidth)) return;
            lastCenterTap = Date.now();
            postToRN({ type: 'llCenterTap' });
          } catch (err) {}
        }, { passive: true });
        doc.__llCenterTap = true;
      }
      attachCenterTap(document);
      
      console.log('✅ LingoLeaf JS initialized');
    })();
    true;
  `;


