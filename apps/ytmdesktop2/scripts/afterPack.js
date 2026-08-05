const { FuseVersion, FuseV1Options } = require("@electron/fuses");
const { Arch } = require("electron-builder");
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
	// if (context.electronPlatformName === "darwin") {
	// 	const requiredEnvVars = ["APPLE_API_KEY", "APPLE_API_ISSUER", "APPLE_API_KEY_ID", "CSC_LINK", "CSC_KEY_PASSWORD"];
	// 	for (const envVar of requiredEnvVars) {
	// 		if (!process.env[envVar]) throw new Error(`Apple Notarize failed, Missing environment variable: ${envVar}`);
	// 	}
	// 	const appPath = `${context.outDir}/${context.arch === Arch.arm64 ? "mac-arm64" : "mac"}/${context.packager.appInfo.productFilename}.app`;

	// 	console.log(`\n\n\tSigning ${appPath} with certificate...`);

	// 	const keychainProfile = process.env.APPLE_API_KEYCHAIN_PROFILE;
	// 	if (process.env.APPLE_API_ENV === "development") {
	// 		console.log(`\n\n\tStoring API key to notarytool profile...`);
	// 		spawnSync("xcrun", [
	// 			"notarytool",
	// 			"store-credentials",
	// 			keychainProfile,
	// 			"--key",
	// 			`${process.env.APPLE_API_KEY}`,
	// 			"--key-id",
	// 			process.env.APPLE_API_KEY_ID,
	// 			"--issuer",
	// 			process.env.APPLE_API_ISSUER,
	// 		]);
	// 	}

	// 	// keychain should already be unlocked
	// 	await signAsync({
	// 		app: appPath,
	// 		platform: "darwin",
	// 	});
	// 	console.log(`\tNotarizing ${appPath}\n\n`);
	// 	try {
	// 		await notarize({
	// 			appBundleId: context.packager.appInfo.productFilename,
	// 			keychainProfile,
	// 			appPath,
	// 		});
	// 	} catch (error) {
	// 		// if the error is not because the submission log is not yet available, throw the error
	// 		// notarisation will still be scanned by Apple, but we will not know the result until it is available
	// 		if (!error.message.includes("Submission log is not yet available")) {
	// 			console.error(`\tNotarization failed: ${error}`);
	// 			throw error;
	// 		} else {
	// 			console.info(`\tNotarization queued, will check later: \n${error.message}\n\n`);
	// 		}
	// 	}
	// }
};
