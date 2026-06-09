/**
 * Patches @epubjs-react-native/core:
 * 1. Sets bounces: false on the reader WebView so the reader doesn't drag vertically.
 * 2. Replaces Fling with Pan for horizontal swipes so short swipes don't turn the page (min distance ~70px).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// 1. View.js: bounces: false
const viewFiles = [
  'node_modules/@epubjs-react-native/core/lib/module/View.js',
  'node_modules/@epubjs-react-native/core/lib/commonjs/View.js',
];
const viewMarker = "scrollEnabled: false,\n    mixedContentMode:";
const viewReplacement = "scrollEnabled: false,\n    bounces: false,\n    mixedContentMode:";

for (const rel of viewFiles) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes('bounces: false,')) continue;
  if (!content.includes(viewMarker)) continue;
  content = content.replace(viewMarker, viewReplacement);
  fs.writeFileSync(filePath, content, 'utf8');
}

// 2. GestureHandler: Pan with min distance + longer LongPress so native text selection wins
const SWIPE_MIN_PX = 70; // lower = easier page turn; 70 balances with selection drag
const SWIPE_FAIL_VERTICAL_PX = 50;
const LONG_PRESS_MS = 800; // longer than native selection (~400–500ms) so WebView gets long-press first
const gestureFiles = [
  'node_modules/@epubjs-react-native/core/lib/module/utils/GestureHandler.js',
  'node_modules/@epubjs-react-native/core/lib/commonjs/utils/GestureHandler.js',
];

const flingMarker = /const swipeLeft = Gesture\.Fling\(\)\.runOnJS\(true\)\.direction\([^)]+\)\.onStart\(onSwipeLeft\);\s*const swipeRight = Gesture\.Fling\(\)\.runOnJS\(true\)\.direction\([^)]+\)\.onStart\(onSwipeRight\);/s;
const flingReplacement = `const horizontalSwipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-${SWIPE_MIN_PX}, ${SWIPE_MIN_PX}])
    .failOffsetY([-${SWIPE_FAIL_VERTICAL_PX}, ${SWIPE_FAIL_VERTICAL_PX}])
    .onEnd((e) => {
      if (e.translationX < -${SWIPE_MIN_PX}) onSwipeLeft();
      else if (e.translationX > ${SWIPE_MIN_PX}) onSwipeRight();
    });`;

const flingMarkerCjs = /const swipeLeft = _reactNativeGestureHandler\.Gesture\.Fling\(\)\.runOnJS\(true\)\.direction\([^)]+\)\.onStart\(onSwipeLeft\);\s*const swipeRight = _reactNativeGestureHandler\.Gesture\.Fling\(\)\.runOnJS\(true\)\.direction\([^)]+\)\.onStart\(onSwipeRight\);/s;
const flingReplacementCjs = `const horizontalSwipe = _reactNativeGestureHandler.Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-${SWIPE_MIN_PX}, ${SWIPE_MIN_PX}])
    .failOffsetY([-${SWIPE_FAIL_VERTICAL_PX}, ${SWIPE_FAIL_VERTICAL_PX}])
    .onEnd((e) => {
      if (e.translationX < -${SWIPE_MIN_PX}) onSwipeLeft();
      else if (e.translationX > ${SWIPE_MIN_PX}) onSwipeRight();
    });`;

for (const rel of gestureFiles) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const isCjs = rel.includes('commonjs');

  // 2a. Replace Fling with Pan (if not already done)
  if (!content.includes('horizontalSwipe')) {
    const marker = isCjs ? flingMarkerCjs : flingMarker;
    const replacement = isCjs ? flingReplacementCjs : flingReplacement;
    if (!marker.test(content)) continue;
    content = content.replace(marker, replacement);
    if (isCjs) {
      content = content.replace(
        '_reactNativeGestureHandler.Gesture.Exclusive(swipeLeft, swipeRight,',
        '_reactNativeGestureHandler.Gesture.Exclusive(horizontalSwipe,'
      );
      content = content.replace(
        '_reactNativeGestureHandler.Gesture.Exclusive(swipeLeft, swipeRight)',
        '_reactNativeGestureHandler.Gesture.Exclusive(horizontalSwipe)'
      );
    } else {
      content = content.replace(
        'Gesture.Exclusive(swipeLeft, swipeRight,',
        'Gesture.Exclusive(horizontalSwipe,'
      );
      content = content.replace(
        'Gesture.Exclusive(swipeLeft, swipeRight)',
        'Gesture.Exclusive(horizontalSwipe)'
      );
    }
  }

  // 2b. LongPress: minDuration(800) so native text selection (~400–500ms) wins
  const longPressRe = isCjs
    ? /(const longPress = _reactNativeGestureHandler\.Gesture\.LongPress\(\)\.runOnJS\(true\))\.onStart\(onLongPress\)/
    : /(const longPress = Gesture\.LongPress\(\)\.runOnJS\(true\))\.onStart\(onLongPress\)/;
  if (longPressRe.test(content) && !content.includes('minDuration(800)')) {
    content = content.replace(longPressRe, `$1.minDuration(${LONG_PRESS_MS}).onStart(onLongPress)`);
  }

  // 2c. If already patched with 70px, bump to 95 so selection drag is less likely to trigger pan
  if (content.includes('horizontalSwipe') && content.includes('-70, 70')) {
    content = content.replace(/-70, 70/g, `-${SWIPE_MIN_PX}, ${SWIPE_MIN_PX}`);
    content = content.replace(/translationX < -70/g, `translationX < -${SWIPE_MIN_PX}`);
    content = content.replace(/translationX > 70/g, `translationX > ${SWIPE_MIN_PX}`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
}
