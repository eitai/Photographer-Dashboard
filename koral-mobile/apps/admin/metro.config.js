const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, '../../packages');

const config = getDefaultConfig(projectRoot);

// Watch the shared packages directory
config.watchFolders = [packagesRoot];

// Resolve @koral/* packages from the monorepo packages directory.
// The Proxy fallback ensures that when those packages transitively import
// anything else (react, react-native, expo-secure-store, etc.) Metro
// resolves those imports from the app's own node_modules rather than
// looking for a node_modules folder that doesn't exist inside packages/.
config.resolver.extraNodeModules = new Proxy(
  {
    '@koral/api': path.resolve(packagesRoot, 'api'),
    '@koral/i18n': path.resolve(packagesRoot, 'i18n'),
    '@koral/types': path.resolve(packagesRoot, 'types'),
  },
  {
    get: (target, name) => {
      if (name in target) return target[name];
      // Fall back to the app's node_modules for any other transitive import
      return path.join(projectRoot, 'node_modules', name);
    },
  },
);

module.exports = config;
