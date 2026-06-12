const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const demoLocalRoot = path.resolve(monorepoRoot, 'packages/demo-local');

const config = getDefaultConfig(projectRoot);

// Monorepo: Metro must watch and resolve packages/demo-local (symlinked via file: dep).
config.watchFolders = [demoLocalRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(demoLocalRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

const webNativeStubs = {
  'react-native-google-mobile-ads': 'react-native-google-mobile-ads.web.ts',
  'react-native-purchases': 'react-native-purchases.web.ts',
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const stubFile = webNativeStubs[moduleName];
  if (platform === 'web' && stubFile) {
    return {
      filePath: path.join(projectRoot, 'src/demo/stubs', stubFile),
      type: 'sourceFile',
    };
  }

  if (moduleName === '@portfolio/demo-local') {
    return {
      filePath: path.join(demoLocalRoot, 'src/index.ts'),
      type: 'sourceFile',
    };
  }

  // zustand's ESM build uses import.meta, which breaks Expo's classic-script web export.
  if (
    platform === 'web' &&
    (moduleName === 'zustand' || moduleName.startsWith('zustand/'))
  ) {
    return {
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
      type: 'sourceFile',
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
