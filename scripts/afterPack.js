const { FuseVersion, FuseV1Options } = require("@electron/fuses");
const { Arch } = require("electron-builder");
const { notarize } = require("@electron/notarize");
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
		const requiredEnvVars = ["APPLE_API_KEY", "APPLE_API_ISSUER", "APPLE_API_KEY_ID"];
		for (const envVar of requiredEnvVars) {
			if (!process.env[envVar]) throw new Error(`Apple Notarize failed, Missing environment variable: ${envVar}`);
		}
    const arch = context.arch === Arch.arm64 ? "arm64" : "x64";
    const appPath = `dist/mac-${arch}/${context.packager.appInfo.productFilename}.app`;
    console.log(`Notarizing ${appPath} for ${arch}...`);
		await notarize({
			appBundleId: context.packager.appInfo.productFilename,
			appPath,
			appleApiKey: process.env.APPLE_API_KEY,
			appleApiIssuer: process.env.APPLE_API_ISSUER,
			appleApiKeyId: process.env.APPLE_API_KEY_ID,
		});
	}
};
