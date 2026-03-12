const { FuseVersion, FuseV1Options } = require("@electron/fuses");
const { Arch } = require("electron-builder");
const { notarize } = require("@electron/notarize");
const { signAsync } = require("@electron/osx-sign");
/**
 *
 * @param {import("electron-builder").AfterPackContext} context
 */
exports.default = async function (context) {
	const fuses = {
		version: FuseVersion.V1,
		[FuseV1Options.RunAsNode]: false,
		[FuseV1Options.EnableCookieEncryption]: true,
		[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
		[FuseV1Options.EnableNodeCliInspectArguments]: false,
		[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
		[FuseV1Options.OnlyLoadAppFromAsar]: true,
		resetAdHocDarwinSignature: context.electronPlatformName === "darwin" && context.arch === Arch.arm64,
	};
	await context.packager.addElectronFuses(context, fuses);
	if (context.electronPlatformName === "darwin") {
		const requiredEnvVars = ["APPLE_API_KEY", "APPLE_API_ISSUER", "APPLE_API_KEY_ID", "CSC_LINK", "CSC_KEY_PASSWORD"];
		for (const envVar of requiredEnvVars) {
			if (!process.env[envVar]) throw new Error(`Apple Notarize failed, Missing environment variable: ${envVar}`);
		}
    // if we are building for multiple architectures, we need to use the specific architecture folder
    const arch = context.targets.length > 1 ? (context.arch === Arch.arm64 ? "mac-arm64" : "mac-x64") : "mac";
    const appPath = `dist/${arch}/${context.packager.appInfo.productFilename}.app`;
    console.log(`\n\n\tSigning ${appPath} with certificate...`);
    // keychain should already be unlocked
    await signAsync({
      app: appPath,
      platform: "darwin",
      
    });
    console.log(`\tNotarizing ${appPath} for ${arch}...\n\n`);
		await notarize({
			appBundleId: context.packager.appInfo.productFilename,
      keychainProfile: undefined, // we are using the certificate directly for notarization
      keychain: undefined,
      appleId: undefined,
      appleIdPassword: undefined,
      teamId: undefined,
			appPath,
			appleApiKey: process.env.APPLE_API_KEY,
			appleApiIssuer: process.env.APPLE_API_ISSUER,
			appleApiKeyId: process.env.APPLE_API_KEY_ID,
		});
	}
};
