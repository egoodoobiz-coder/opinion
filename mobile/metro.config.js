const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// For pnpm monorepo: resolve node_modules from workspace root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, "../../");

config.resolver.nodeModulesPaths = [
  path.join(workspaceRoot, "node_modules"),
];

// Enable symlink resolution for pnpm hoisted dependencies
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
