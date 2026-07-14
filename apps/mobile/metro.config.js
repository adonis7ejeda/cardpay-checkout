const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * pnpm monorepo: node_modules are pnpm symlinks into a content-addressable
 * store outside apps/mobile, so Metro must watch the workspace root and
 * follow symlinks to resolve packages like @babel/runtime.
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')],
    // Widening watchFolders to the workspace root also pulls in sibling
    // packages' build/coverage output; exclude those (not node_modules,
    // which Metro must still watch to follow pnpm's symlinked packages).
    blockList: [/apps\/api\/(dist|coverage)\/.*/, /packages\/(core|contracts)\/(dist|coverage)\/.*/, /openspec\/.*/, /\.review-results\/.*/, /\.git\/.*/]
  }
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
