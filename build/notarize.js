const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  // Skip notarization for local unsigned builds
  // Notarization requires Apple Developer ID and credentials
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  
  // Check if we have notarization credentials
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.log('Skipping notarization: No Apple ID credentials found');
    console.log('To enable notarization, set APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD environment variables');
    return;
  }

  console.log(`Notarizing ${appName}...`);
  
  return await notarize({
    appBundleId: 'com.captureit.remote-desktop',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
