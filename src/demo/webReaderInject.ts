/**
 * Injected into epubjs content documents (web demo reader).
 * Mirrors native READER_INJECTED_JAVASCRIPT but posts to the host page via __llWebReaderOnMessage.
 */

export type WebReaderBridgeMessage =
  | { type: 'llCenterTap' }
  | { type: 'llSelectionCleared'; sourceHref?: string | null }
  | {
      type: 'llSelectionCommitted';
      sourceHref?: string | null;
      text: string;
      context?: string | null;
      rect: { x: number; y: number; width: number; height: number };
    }
  | {
      type: 'llHighlightClicked';
      cfi?: string;
      highlightId?: string | null;
      rect?: { x: number; y: number; width: number; height: number };
    }
  | { type: 'llSwipe'; direction: 'next' | 'prev' };

export const WEB_READER_INJECTED_JAVASCRIPT = `
(function() {
  function postToHost(payload) {
    try {
      var host = window.parent || window;
      if (host && typeof host.__llWebReaderOnMessage === 'function') {
        host.__llWebReaderOnMessage(payload);
      }
    } catch (e) {}
  }

  function applyCSS(doc) {
    if (doc.__llCSS) return;
    var style = doc.createElement('style');
    style.textContent = \`
      html, body { overscroll-behavior-y: none !important; }
      * {
        -webkit-touch-callout: none !important;
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      ::selection { background: rgba(180, 215, 255, 0.4) !important; }
      [ref="epubjs-hl"], .epubjs-hl { pointer-events: auto !important; }
    \`;
    (doc.head || doc.documentElement).appendChild(style);
    doc.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    }, { capture: true, passive: false });
    doc.__llCSS = true;
  }

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

  function attachSelectionDebug(doc) {
    if (doc.__llSelectionDebug) return;
    function getSelectionPayload() {
      var sel = doc.getSelection ? doc.getSelection() : null;
      var text = sel ? (sel.toString() || '').trim() : '';
      if (!text) return null;
      var rect = null;
      var context = null;
      try {
        if (sel && sel.rangeCount > 0) {
          var range = sel.getRangeAt(0);
          var r = range.getBoundingClientRect();
          var iframeOffset = getIframeOffsetForDoc(doc);
          rect = { x: r.x + iframeOffset.x, y: r.y + iframeOffset.y, width: r.width, height: r.height };
        }
      } catch (e) {}
      return { text: text.length > 400 ? text.slice(0, 400) : text, context, rect };
    }

    doc.addEventListener('selectionchange', function() {
      try {
        var sel = doc.getSelection ? doc.getSelection() : null;
        var text = sel ? (sel.toString() || '').trim() : '';
        if (!text && doc.__llHadSelection) {
          doc.__llHadSelection = false;
          postToHost({ type: 'llSelectionCleared', sourceHref: doc.location && doc.location.href });
        } else if (text) {
          doc.__llHadSelection = true;
        }
      } catch (e) {}
    }, { passive: true });

    function commitSelection() {
      try {
        var payload = getSelectionPayload();
        if (!payload || !payload.rect) return;
        var now = Date.now();
        if (doc.__llLastCommitTime != null && now - doc.__llLastCommitTime < 300) return;
        doc.__llLastCommitTime = now;
        postToHost({
          type: 'llSelectionCommitted',
          sourceHref: doc.location && doc.location.href,
          text: payload.text,
          context: payload.context,
          rect: payload.rect,
        });
      } catch (e) {}
    }

    doc.addEventListener('touchend', function() { setTimeout(commitSelection, 0); }, { passive: true });
    doc.addEventListener('mouseup', function() { setTimeout(commitSelection, 0); }, { passive: true });
    doc.__llHadSelection = false;
    doc.__llSelectionDebug = true;
  }

  var __llHighlightClickedAt = 0;

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
            postToHost({
              type: 'llHighlightClicked',
              cfi: target.dataset.epubcfi,
              highlightId: target.dataset.id || null,
              rect: rect,
            });
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

  var EDGE_MARGIN_PX = 56;
  var MAX_TAP_MOVE_PX = 12;
  var SWIPE_THRESHOLD_PX = 48;

  function attachCenterTap(doc) {
    if (doc.__llCenterTap) return;
    var touchStartTime = 0;
    var touchStartX = 0;
    var touchStartY = 0;
    var touchStartTarget = null;
    var lastCenterTap = 0;

    function isLinkOrHighlight(el) {
      if (!el) return false;
      for (var i = 0; i < 20 && el; i++) {
        if (el.tagName === 'A') return true;
        if (el.dataset && (el.dataset.epubcfi || el.dataset.highlightId)) return true;
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
      if (Date.now() - __llHighlightClickedAt < 500) return;
      var duration = Date.now() - touchStartTime;
      var dx = t.clientX - touchStartX;
      var dy = t.clientY - touchStartY;
      if (dx * dx + dy * dy > MAX_TAP_MOVE_PX * MAX_TAP_MOVE_PX) {
        if (duration < 450 && Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
          postToHost({ type: 'llSwipe', direction: dx < 0 ? 'next' : 'prev' });
        }
        return;
      }
      if (duration > 350) return;
      if (Date.now() - lastCenterTap < 400) return;
      try {
        var sel = doc.getSelection ? doc.getSelection() : null;
        if (sel && (sel.toString() || '').trim().length > 0) return;
        if (isLinkOrHighlight(touchStartTarget || e.target)) return;
        var docWidth = (doc.documentElement && doc.documentElement.clientWidth) || (doc.body && doc.body.clientWidth) || window.innerWidth;
        if (!inCenterZone(t.clientX, docWidth)) return;
        lastCenterTap = Date.now();
        postToHost({ type: 'llCenterTap' });
      } catch (err) {}
    }, { passive: true });

    doc.__llCenterTap = true;
  }

  function patchDoc(doc) {
    if (!doc) return;
    applyCSS(doc);
    attachSelectionDebug(doc);
    attachHighlightClick(doc);
    attachCenterTap(doc);
  }

  function patchIframes() {
    document.querySelectorAll('iframe').forEach(function(iframe) {
      try {
        var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
        patchDoc(doc);
      } catch (e) {
        if (!iframe.__llListener) {
          iframe.addEventListener('load', function() {
            try {
              var d = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
              patchDoc(d);
            } catch (e2) {}
          });
          iframe.__llListener = true;
        }
      }
    });
  }

  patchDoc(document);
  patchIframes();
  new MutationObserver(patchIframes).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(patchIframes, 2000);
})();
true;
`;

declare global {
  interface Window {
    __llWebReaderOnMessage?: (message: WebReaderBridgeMessage) => void;
  }
}
