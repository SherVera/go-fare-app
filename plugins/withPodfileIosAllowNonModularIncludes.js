const {withDangerousMod} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Patches ios/Podfile after Expo prebuild for:
 *
 * - $RNFirebaseAsStaticFramework — aligns @react-native-firebase pods when using
 *   `ios.useFrameworks: 'static'` (see invertase docs / issue #6594).
 *
 * - CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES — needed so
 *   react-native-maps (framework target) can `#import <React/...>` without failing
 *   as a non-modular include under Xcode 26.
 */
function withPodfileIosRnfbMapsCompat(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.projectRoot, 'ios', 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes('$RNFirebaseAsStaticFramework')) {
        contents = contents.replace(
          /(prepare_react_native_project!\n)/,
          `$1\n$RNFirebaseAsStaticFramework = true\n`,
        );
      }

      if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        const anchor =
          ':ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n  end';
        if (contents.includes(anchor)) {
          contents = contents.replace(
            anchor,
            `:ccache_enabled => ccache_enabled?(podfile_properties),\n    )
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end`,
          );
        } else {
          console.warn('[withPodfileIosRnfbMapsCompat] post_install anchor not found; skipping');
        }
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
}

module.exports = withPodfileIosRnfbMapsCompat;
