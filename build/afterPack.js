const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  const { appOutDir, packager } = context;
  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  
  console.log(`[afterPack] Processing ${appPath}`);
  
  // Remove quarantine attribute recursively (important for local distribution)
  try {
    execSync(`xattr -rd com.apple.quarantine "${appPath}"`, { stdio: 'inherit' });
    console.log('[afterPack] Removed quarantine attributes');
  } catch (e) {
    console.log('[afterPack] No quarantine attributes to remove or command failed');
  }
  
  // Ad-hoc sign the app for local distribution
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    console.log('[afterPack] Ad-hoc signed the app');
  } catch (e) {
    console.log('[afterPack] Signing failed:', e.message);
  }
  
  // Also remove quarantine from the output directory itself
  try {
    execSync(`xattr -rd com.apple.quarantine "${appOutDir}"`, { stdio: 'inherit' });
  } catch (e) {
    // Ignore errors
  }
};
