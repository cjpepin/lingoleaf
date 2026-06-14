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
      var w = window;
      while (w) {
        try {
          if (typeof w.__llWebReaderOnMessage === 'function') {
            w.__llWebReaderOnMessage(payload);
            return;
          }
          if (typeof w.dispatchEvent === 'function') {
            w.dispatchEvent(new CustomEvent('ll-web-reader-message', { detail: payload }));
          }
        } catch (e) {}
        if (!w.parent || w.parent === w) break;
        w = w.parent;
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
      var view = doc && doc.defaultView ? doc.defaultView : window;
      var frame = view && view.frameElement;
      if (frame && frame.getBoundingClientRect) {
        var frameRect = frame.getBoundingClientRect();
        return { x: frameRect.left, y: frameRect.top };
      }
      if (doc !== window.document) {
        var iframes = window.document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
          try {
            if (iframes[i].contentDocument === doc || (iframes[i].contentWindow && iframes[i].contentWindow.document === doc)) {
              var iframeRect = iframes[i].getBoundingClientRect();
              return { x: iframeRect.left, y: iframeRect.top };
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    return { x: 0, y: 0 };
  }

  function findHighlightAtPoint(clientX, clientY, doc) {
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
          var group = groups[g];
          var cfi = (group.dataset && group.dataset.epubcfi) || null;
          var highlightId = (group.dataset && group.dataset.id) || null;
          var rects = group.querySelectorAll('rect');
          for (var r = 0; r < rects.length; r++) {
            var rect = rects[r].getBoundingClientRect();
            if (px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom) {
              return { cfi: cfi, highlightId: highlightId, rect: { x: rect.left + doff.x, y: rect.top + doff.y, width: rect.width, height: rect.height } };
            }
          }
          if (cfi) {
            var groupRect = group.getBoundingClientRect();
            if (px >= groupRect.left && px <= groupRect.right && py >= groupRect.top && py <= groupRect.bottom) {
              return { cfi: cfi, highlightId: highlightId, rect: { x: groupRect.left + doff.x, y: groupRect.top + doff.y, width: groupRect.width, height: groupRect.height } };
            }
          }
        }
        var marked = docs[di].querySelectorAll('[data-epubcfi]');
        for (var m = 0; m < marked.length; m++) {
          var el = marked[m];
          var elRect = el.getBoundingClientRect();
          if (px >= elRect.left && px <= elRect.right && py >= elRect.top && py <= elRect.bottom) {
            return {
              cfi: el.dataset.epubcfi || null,
              highlightId: el.dataset.id || null,
              rect: { x: elRect.left + doff.x, y: elRect.top + doff.y, width: elRect.width, height: elRect.height },
            };
          }
        }
      }
    } catch (e) {}
    return null;
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
        var clientX = e.clientX;
        var clientY = e.clientY;
        if ((clientX == null || clientY == null) && e.changedTouches && e.changedTouches[0]) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        }
        if (clientX == null || clientY == null) return;
        var hit = findHighlightAtPoint(clientX, clientY, doc);
        if (!hit || !hit.cfi) {
          var target = e.target;
          for (var i = 0; i < 8 && target; i++) {
            if (target.dataset && target.dataset.epubcfi) {
              hit = {
                cfi: target.dataset.epubcfi,
                highlightId: target.dataset.id || null,
                rect: null,
              };
              try {
                var bcr = target.getBoundingClientRect();
                var iOff = getIframeOffsetForDoc(doc);
                hit.rect = { x: bcr.left + iOff.x, y: bcr.top + iOff.y, width: bcr.width, height: bcr.height };
              } catch (_) {}
              break;
            }
            target = target.parentElement;
          }
        }
        if (!hit || !hit.cfi) return;
        __llHighlightClickedAt = Date.now();
        postToHost({
          type: 'llHighlightClicked',
          cfi: hit.cfi,
          highlightId: hit.highlightId,
          rect: hit.rect,
        });
        e.stopPropagation();
        e.preventDefault();
      } catch (err) {}
    }
    doc.addEventListener('click', handleHighlightTap, true);
    doc.addEventListener('touchend', handleHighlightTap, true);
    doc.__llHighlightClick = true;
  }

  var EDGE_MARGIN_PX = 56;
  var MAX_TAP_MOVE_PX = 12;
  var SWIPE_THRESHOLD_PX = 48;

  function attachPointerNav(doc) {
    if (doc.__llCenterTap) return;
    var pointerStartTime = 0;
    var pointerStartX = 0;
    var pointerStartY = 0;
    var pointerStartTarget = null;
    var lastCenterTap = 0;
    var activePointerId = null;

    function isLinkOrHighlight(el) {
      if (!el) return false;
      if (el.closest && (el.closest('[data-epubcfi]') || el.closest('.epubjs-hl') || el.closest('[ref="epubjs-hl"]'))) return true;
      for (var i = 0; i < 20 && el; i++) {
        if (el.tagName === 'A') return true;
        if (el.dataset && (el.dataset.epubcfi || el.dataset.highlightId)) return true;
        if (el.getAttribute && (el.getAttribute('ref') === 'epubjs-hl' || (el.classList && el.classList.contains('epubjs-hl')))) return true;
        el = el.parentElement;
      }
      return false;
    }

    function isTapOnHighlight(clientX, clientY, doc) {
      if (Date.now() - __llHighlightClickedAt < 500) return true;
      return Boolean(findHighlightAtPoint(clientX, clientY, doc));
    }

    function inCenterZone(clientX, docWidth) {
      if (docWidth <= 2 * EDGE_MARGIN_PX) return true;
      return clientX >= EDGE_MARGIN_PX && clientX <= docWidth - EDGE_MARGIN_PX;
    }

    function inEdgeZone(clientX, docWidth) {
      if (docWidth <= 2 * EDGE_MARGIN_PX) return null;
      if (clientX < EDGE_MARGIN_PX) return 'prev';
      if (clientX > docWidth - EDGE_MARGIN_PX) return 'next';
      return null;
    }

    function docWidth() {
      return (doc.documentElement && doc.documentElement.clientWidth) || (doc.body && doc.body.clientWidth) || window.innerWidth;
    }

    function beginPointer(clientX, clientY, target, pointerId) {
      pointerStartTime = Date.now();
      pointerStartX = clientX;
      pointerStartY = clientY;
      pointerStartTarget = target;
      activePointerId = pointerId == null ? 'mouse' : pointerId;
    }

    function finishPointer(clientX, clientY, target) {
      if (Date.now() - __llHighlightClickedAt < 500) return;
      if (isTapOnHighlight(clientX, clientY, doc)) return;
      var duration = Date.now() - pointerStartTime;
      var dx = clientX - pointerStartX;
      var dy = clientY - pointerStartY;
      var moved = dx * dx + dy * dy > MAX_TAP_MOVE_PX * MAX_TAP_MOVE_PX;
      if (moved) {
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
        if (isLinkOrHighlight(pointerStartTarget || target)) return;
        var width = docWidth();
        var edge = inEdgeZone(clientX, width);
        if (edge) {
          postToHost({ type: 'llSwipe', direction: edge });
          return;
        }
        if (!inCenterZone(clientX, width)) return;
        lastCenterTap = Date.now();
        postToHost({ type: 'llCenterTap' });
      } catch (err) {}
    }

    doc.addEventListener('pointerdown', function(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      beginPointer(e.clientX, e.clientY, e.target, e.pointerId);
    }, { passive: true });

    doc.addEventListener('pointerup', function(e) {
      if (activePointerId == null) return;
      if (activePointerId !== 'mouse' && e.pointerId !== activePointerId) return;
      finishPointer(e.clientX, e.clientY, e.target);
      activePointerId = null;
    }, { passive: true });

    doc.addEventListener('pointercancel', function() {
      activePointerId = null;
    }, { passive: true });

    doc.addEventListener('touchstart', function(e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      beginPointer(t.clientX, t.clientY, e.target, t.identifier);
    }, { passive: true });

    doc.addEventListener('touchend', function(e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      finishPointer(t.clientX, t.clientY, e.target);
      activePointerId = null;
    }, { passive: true });

    doc.__llCenterTap = true;
  }

  function patchDoc(doc) {
    if (!doc) return;
    applyCSS(doc);
    attachSelectionDebug(doc);
    attachHighlightClick(doc);
    attachPointerNav(doc);
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
