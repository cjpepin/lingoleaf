/**
 * Patches react-native Fabric touch handlers to avoid debug-assert app termination
 * when UIKit and local touch registries temporarily diverge.
 *
 * This keeps existing behavior (skip unknown touches) without aborting the app.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const targets = [
  'node_modules/react-native/React/Fabric/RCTSurfaceTouchHandler.mm',
  'node_modules/react-native/React/Fabric/RCTSurfacePointerHandler.mm',
];

const ASSERT_REPLACEMENTS = [
  /^\s*RCTAssert\(iterator != _activeTouches\.end\(\), @"Inconsistency between local and UIKit touch registries"\);\n/gm,
  /^\s*RCTAssert\(iterator != _activePointers\.end\(\), @"Inconsistency between local and UIKit touch registries"\);\n/gm,
];

for (const rel of targets) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  let patched = content;
  for (const re of ASSERT_REPLACEMENTS) {
    patched = patched.replace(re, '');
  }

  if (patched !== content) {
    fs.writeFileSync(filePath, patched, 'utf8');
  }
}
