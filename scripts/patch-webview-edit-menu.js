/**
 * Applies native patches to react-native-webview (iOS):
 * 1. Edit-menu suppression on text selection (Speak/Spell/Lookup/etc.)
 * 2. WKContentView canPerformAction swizzle (suppresses native edit menu at source)
 * 3. iOS 18+ Writing Tools suppression
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

// ─────────────────────────────────────────────────────────────────────
// PATCH A: editMenuInteraction delegate — return empty menu when menuItems nil/empty
// ─────────────────────────────────────────────────────────────────────
const menuMarker = '  NSMutableArray<UICommand *> *menuItems = [NSMutableArray new];\n  for(NSDictionary *menuItem in self.menuItems) {';
const menuReplacement = '  NSMutableArray<UICommand *> *menuItems = [NSMutableArray new];\n  if (!self.menuItems || self.menuItems.count == 0) {\n    return [UIMenu menuWithChildren:@[]];\n  }\n  for(NSDictionary *menuItem in self.menuItems) {';
if (!content.includes('return [UIMenu menuWithChildren:@[]];') && content.includes(menuMarker)) {
  content = content.replace(menuMarker, menuReplacement);
}

// ─────────────────────────────────────────────────────────────────────
// PATCH B: startLongPress — do not present edit menu when menuItems nil/empty
// ─────────────────────────────────────────────────────────────────────
const startLongPressMarker = '    if (pressSender.state != UIGestureRecognizerStateEnded || !self.menuItems) {\n        return;\n    }\n    if (@available(iOS 16.0, *)) {';
const startLongPressReplacement = '    if (pressSender.state != UIGestureRecognizerStateEnded || !self.menuItems || self.menuItems.count == 0) {\n        return;\n    }\n    if (@available(iOS 16.0, *)) {';
if (content.includes(startLongPressMarker) && !content.includes('|| self.menuItems.count == 0) {\n        return;')) {
  content = content.replace(startLongPressMarker, startLongPressReplacement);
}

// ─────────────────────────────────────────────────────────────────────
// PATCH C: iOS 18+ Writing Tools (Apple Intelligence) — disable in WKWebView
// ─────────────────────────────────────────────────────────────────────
const writingToolsMarker = '  WKWebViewConfiguration *wkWebViewConfig = [WKWebViewConfiguration new];\n';
const writingToolsReplacement =
  '  WKWebViewConfiguration *wkWebViewConfig = [WKWebViewConfiguration new];\n' +
  '#if defined(__IPHONE_OS_VERSION_MAX_ALLOWED) && __IPHONE_OS_VERSION_MAX_ALLOWED >= 180000 /* iOS 18 */\n' +
  '  if (@available(iOS 18.0, *)) {\n' +
  '    if ([wkWebViewConfig respondsToSelector:@selector(writingToolsBehavior)]) {\n' +
  '      wkWebViewConfig.writingToolsBehavior = UIWritingToolsBehaviorNone;\n' +
  '    }\n' +
  '  }\n' +
  '#endif\n';
if (content.includes(writingToolsMarker) && !content.includes('writingToolsBehavior')) {
  content = content.replace(writingToolsMarker, writingToolsReplacement);
}

// ─────────────────────────────────────────────────────────────────────
// PATCH D: buildMenuWithBuilder — actively REMOVE all system menus when
//          menuItems is nil/empty (previously just returned early, leaving
//          Speak/Spell/Lookup from WKContentView in the menu).
// ─────────────────────────────────────────────────────────────────────
// Match the CURRENT patched version (from a previous run of this script)
const buildMenuCurrentPatched =
  '- (void)buildMenuWithBuilder:(id<UIMenuBuilder>)builder API_AVAILABLE(ios(13.0))  {\n' +
  '    if (!self.menuItems || self.menuItems.count == 0) {\n' +
  '      return;\n' +
  '    }\n' +
  '    if (@available(iOS 16.0, *)) {\n' +
  '      if(self.menuItems){\n' +
  '        [builder removeMenuForIdentifier:UIMenuLookup];\n' +
  '      }\n' +
  '    }\n' +
  '    [super buildMenuWithBuilder:builder];\n' +
  '}\n#else // TARGET_OS_OSX';

// Also match the ORIGINAL unpatched version
const buildMenuOriginal =
  '- (void)buildMenuWithBuilder:(id<UIMenuBuilder>)builder API_AVAILABLE(ios(13.0))  {\n' +
  '    if (@available(iOS 16.0, *)) {\n' +
  '      if(self.menuItems){\n' +
  '        [builder removeMenuForIdentifier:UIMenuLookup];\n' +
  '      }\n' +
  '    }\n' +
  '    [super buildMenuWithBuilder:builder];\n' +
  '}\n#else // TARGET_OS_OSX';

const buildMenuFix =
  '- (void)buildMenuWithBuilder:(id<UIMenuBuilder>)builder API_AVAILABLE(ios(13.0))  {\n' +
  '    if (!self.menuItems || self.menuItems.count == 0) {\n' +
  '      // Actively remove ALL system menus so Speak/Spell/Lookup never appear\n' +
  '      if (@available(iOS 16.0, *)) {\n' +
  '        [builder removeMenuForIdentifier:UIMenuLookup];\n' +
  '      }\n' +
  '      [builder removeMenuForIdentifier:UIMenuStandardEdit];\n' +
  '      [builder removeMenuForIdentifier:UIMenuFormat];\n' +
  '      [builder removeMenuForIdentifier:UIMenuFind];\n' +
  '      [builder removeMenuForIdentifier:UIMenuReplace];\n' +
  '      [builder removeMenuForIdentifier:UIMenuShare];\n' +
  '      [builder removeMenuForIdentifier:UIMenuTextStyle];\n' +
  '      [builder removeMenuForIdentifier:UIMenuTextStylePasteboard];\n' +
  '      [builder removeMenuForIdentifier:UIMenuSpelling];\n' +
  '      [builder removeMenuForIdentifier:UIMenuSpellingPanel];\n' +
  '      [builder removeMenuForIdentifier:UIMenuSpellingOptions];\n' +
  '      return;\n' +
  '    }\n' +
  '    if (@available(iOS 16.0, *)) {\n' +
  '      if(self.menuItems){\n' +
  '        [builder removeMenuForIdentifier:UIMenuLookup];\n' +
  '      }\n' +
  '    }\n' +
  '    [super buildMenuWithBuilder:builder];\n' +
  '}\n#else // TARGET_OS_OSX';

// Check for the marker text that indicates our new patch is already applied
const buildMenuFixApplied = 'Actively remove ALL system menus so Speak/Spell/Lookup never appear';
if (!content.includes(buildMenuFixApplied)) {
  if (content.includes(buildMenuCurrentPatched)) {
    content = content.replace(buildMenuCurrentPatched, buildMenuFix);
  } else if (content.includes(buildMenuOriginal)) {
    content = content.replace(buildMenuOriginal, buildMenuFix);
  }
}

// ─────────────────────────────────────────────────────────────────────
// PATCH E: Swizzle WKContentView's canPerformAction:withSender: at runtime.
//
//          This is the critical fix. The native "Speak | Spell" popup comes
//          from WKContentView (Apple's internal first-responder inside WKWebView).
//          Our overrides on RNCWKWebView never get consulted because
//          canPerformAction: is only checked on the FIRST responder.
//          By swizzling WKContentView itself, we can return NO when the
//          parent RNCWKWebView has no custom menuItems.
// ─────────────────────────────────────────────────────────────────────
const swizzleMarker = '@implementation RNCWKWebView\n#if !TARGET_OS_OSX';
const swizzleCode =
  '@implementation RNCWKWebView\n' +
  '#if !TARGET_OS_OSX\n' +
  '+ (void)load {\n' +
  '    static dispatch_once_t onceToken;\n' +
  '    dispatch_once(&onceToken, ^{\n' +
  '        // Swizzle WKContentView canPerformAction:withSender: to suppress native edit menu\n' +
  '        Class wkContentViewClass = NSClassFromString(@"WKContentView");\n' +
  '        if (!wkContentViewClass) return;\n' +
  '        SEL canPerformSel = @selector(canPerformAction:withSender:);\n' +
  '        Method originalMethod = class_getInstanceMethod(wkContentViewClass, canPerformSel);\n' +
  '        if (!originalMethod) return;\n' +
  '        IMP originalIMP = method_getImplementation(originalMethod);\n' +
  '        IMP newIMP = imp_implementationWithBlock(^BOOL(id _self, SEL action, id sender) {\n' +
  '            UIView *view = (UIView *)_self;\n' +
  '            while (view != nil) {\n' +
  '                if ([view isKindOfClass:[RNCWKWebView class]]) {\n' +
  '                    RNCWKWebView *wv = (RNCWKWebView *)view;\n' +
  '                    if (!wv.menuItems || wv.menuItems.count == 0) {\n' +
  '                        return NO;\n' +
  '                    }\n' +
  '                    break;\n' +
  '                }\n' +
  '                view = view.superview;\n' +
  '            }\n' +
  '            return ((BOOL(*)(id, SEL, SEL, id))originalIMP)(_self, canPerformSel, action, sender);\n' +
  '        });\n' +
  '        method_setImplementation(originalMethod, newIMP);\n' +
  '    });\n' +
  '}\n';
const swizzleAppliedMarker = 'Swizzle WKContentView canPerformAction';
if (!content.includes(swizzleAppliedMarker)) {
  if (content.includes(swizzleMarker)) {
    content = content.replace(swizzleMarker, swizzleCode);
  }
}

// ─────────────────────────────────────────────────────────────────────
// PATCH F: After each navigation finishes, strip UIEditMenuInteraction
//          from WKContentView subviews (belt-and-suspenders for iOS 16+).
// ─────────────────────────────────────────────────────────────────────
const didFinishMarker =
  '- (void)webView:(WKWebView *)webView\ndidFinishNavigation:(WKNavigation *)navigation\n{';
const didFinishReplacement =
  '- (void)webView:(WKWebView *)webView\ndidFinishNavigation:(WKNavigation *)navigation\n{\n' +
  '#if !TARGET_OS_OSX\n' +
  '  if (!_menuItems || _menuItems.count == 0) {\n' +
  '    [self _llStripEditMenuInteractions:webView];\n' +
  '  }\n' +
  '#endif';
const stripMethodMarker = '@implementation RNCWebViewImpl\n{';
const stripMethodCode =
  '@implementation RNCWebViewImpl\n{\n' +
  '// Forward-declared helper for stripping UIEditMenuInteraction\n';
const stripMethodImpl =
  '\n// Strip UIEditMenuInteraction from WKContentView subviews\n' +
  '- (void)_llStripEditMenuInteractions:(UIView *)root {\n' +
  '#if !TARGET_OS_OSX\n' +
  '  if (@available(iOS 16.0, *)) {\n' +
  '    for (UIView *subview in root.subviews) {\n' +
  '      NSString *className = NSStringFromClass([subview class]);\n' +
  '      if ([className containsString:@"ContentView"]) {\n' +
  '        NSArray *interactions = [subview.interactions copy];\n' +
  '        for (id<UIInteraction> interaction in interactions) {\n' +
  '          if ([interaction isKindOfClass:[UIEditMenuInteraction class]]) {\n' +
  '            [subview removeInteraction:interaction];\n' +
  '          }\n' +
  '        }\n' +
  '      }\n' +
  '      [self _llStripEditMenuInteractions:subview];\n' +
  '    }\n' +
  '  }\n' +
  '#endif\n' +
  '}\n';

const stripAppliedMarker = '_llStripEditMenuInteractions';
if (!content.includes(stripAppliedMarker)) {
  // Insert the strip method body right before didMoveToWindow
  const didMoveMarker = '- (void)didMoveToWindow\n{';
  if (content.includes(didMoveMarker)) {
    content = content.replace(didMoveMarker, stripMethodImpl + '\n' + didMoveMarker);
  }

  // Call the strip method after didFinishNavigation
  if (content.includes(didFinishMarker)) {
    content = content.replace(didFinishMarker, didFinishReplacement);
  }

  // Also call after addSubview in didMoveToWindow (with a small delay to let WKContentView load)
  const addSubviewLine = '    [self addSubview:_webView];\n    [self setHideKeyboardAccessoryView: _savedHideKeyboardAccessoryView];';
  const addSubviewReplacement =
    '    [self addSubview:_webView];\n' +
    '    if (!_menuItems || _menuItems.count == 0) {\n' +
    '      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{\n' +
    '        [self _llStripEditMenuInteractions:self->_webView];\n' +
    '      });\n' +
    '    }\n' +
    '    [self setHideKeyboardAccessoryView: _savedHideKeyboardAccessoryView];';
  if (content.includes(addSubviewLine)) {
    content = content.replace(addSubviewLine, addSubviewReplacement);
  }
}

// ─────────────────────────────────────────────────────────────────────
// PATCH G: Revert vertical scroll clamp if present (it caused blank pages)
// ─────────────────────────────────────────────────────────────────────
const scrollClamped = '  if (!_scrollEnabled) {\n    scrollView.bounds = _webView.bounds;\n    CGPoint o = scrollView.contentOffset;\n    if (o.y != 0) {\n      scrollView.contentOffset = CGPointMake(o.x, 0);\n    }\n  }';
const scrollOriginal = '  if (!_scrollEnabled) {\n    scrollView.bounds = _webView.bounds;\n  }';
if (content.includes('CGPointMake(o.x, 0)')) {
  content = content.replace(scrollClamped, scrollOriginal);
}

fs.writeFileSync(filePath, content, 'utf8');
