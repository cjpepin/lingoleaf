/**
 * Applies native patches to react-native-webview (iOS):
 * 1. Edit-menu suppression on text selection
 * (Vertical scroll clamp was reverted: it broke epub.js navigation and caused blank pages.)
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-webview',
  'apple',
  'RNCWebViewImpl.m'
);

if (!fs.existsSync(filePath)) {
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// Edit menu: return empty menu when menuItems nil/empty
const menuMarker = '  NSMutableArray<UICommand *> *menuItems = [NSMutableArray new];\n  for(NSDictionary *menuItem in self.menuItems) {';
const menuReplacement = '  NSMutableArray<UICommand *> *menuItems = [NSMutableArray new];\n  if (!self.menuItems || self.menuItems.count == 0) {\n    return [UIMenu menuWithChildren:@[]];\n  }\n  for(NSDictionary *menuItem in self.menuItems) {';
if (!content.includes('return [UIMenu menuWithChildren:@[]];') && content.includes(menuMarker)) {
  content = content.replace(menuMarker, menuReplacement);
}

// Revert vertical scroll clamp if present (it caused blank pages after navigation)
const scrollClamped = '  if (!_scrollEnabled) {\n    scrollView.bounds = _webView.bounds;\n    CGPoint o = scrollView.contentOffset;\n    if (o.y != 0) {\n      scrollView.contentOffset = CGPointMake(o.x, 0);\n    }\n  }';
const scrollOriginal = '  if (!_scrollEnabled) {\n    scrollView.bounds = _webView.bounds;\n  }';
if (content.includes('CGPointMake(o.x, 0)')) {
  content = content.replace(scrollClamped, scrollOriginal);
}

fs.writeFileSync(filePath, content, 'utf8');
