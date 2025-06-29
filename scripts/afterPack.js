const { FuseVersion, FuseV1Options } = require("@electron/fuses");
const { Arch } = require("electron-builder");

exports.default = async function (context) {
	const fuses = {
		version: FuseVersion.V1,
		strictlyRequireAllFuses: true,
		[FuseV1Options.RunAsNode]: false,
		[FuseV1Options.EnableCookieEncryption]: true,
		[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
		[FuseV1Options.EnableNodeCliInspectArguments]: false,
		[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
		[FuseV1Options.OnlyLoadAppFromAsar]: true,
		[FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
		[FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
		resetAdHocDarwinSignature: context.electronPlatformName === "darwin" && context.arch === Arch.arm64,
	};
	await context.packager.addElectronFuses(context, fuses);
};
