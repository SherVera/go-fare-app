// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// @react-navigation/native 7.3+ only exports "source"/"default"; Metro's
// react-native condition fails unless package exports are disabled.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
