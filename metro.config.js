// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// @react-navigation/native 7.3+ only exports "source"/"default"; Metro's
// react-native condition fails unless package exports are disabled.
config.resolver.unstable_enablePackageExports = false;

// Ignorar carpetas de agentes/skills para evitar bloqueos de archivos en Windows (EBUSY/ENOENT)
const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

config.resolver.blockList = [...existingBlockList, /[\\/]\.agents[\\/].*/];

module.exports = config;
