const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

const APP_ID = "net.venipa.ytmdesktop";
const DESCRIPTION =
	"Unofficial YouTube Music desktop client with Discord RPC, Theming, Last.fm, Streamdeck, and local API.";

/**
 * @param {import("electron-builder").BeforePackContext["targets"]} targets
 * @returns {Generator<{ name: string, options?: Record<string, unknown> }>}
 */
function* iterateTargets(targets) {
	if (!targets) return;
	if (targets instanceof Map) {
		yield* targets.keys();
		return;
	}
	if (typeof targets[Symbol.iterator] === "function") {
		for (const entry of targets) {
			yield Array.isArray(entry) ? entry[0] : entry;
		}
	}
}

/**
 * Stamp Flatpak/AppStream metainfo with the release version before pack.
 * Also rewrites flatpak.files to an absolute source path — @malept/flatpak-bundler
 * uses path.resolve(cwd), which breaks when electron-builder is not started from projectDir.
 *
 * @param {import("electron-builder").BeforePackContext} context
 */
exports.default = async function beforePack(context) {
	if (context.electronPlatformName !== "linux") return;

	const version = context.packager.appInfo.version;
	const projectDir = context.packager.projectDir;
	const date = new Date().toISOString().slice(0, 10);
	const metainfoPath = path.join(projectDir, "build", `${APP_ID}.metainfo.xml`);
	const metainfoDest = `/share/metainfo/${APP_ID}.metainfo.xml`;

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Copyright ${date.slice(0, 4)} Venipa -->
<component type="desktop-application">
  <id>${APP_ID}</id>
  <name>YouTube Music for Desktop</name>
  <summary>Unofficial YouTube Music desktop client</summary>
  <developer id="net.venipa">
    <name translate="no">Venipa</name>
  </developer>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>
  <url type="homepage">https://youtube-music.app</url>
  <url type="bugtracker">https://github.com/Venipa/ytmdesktop2/issues</url>
  <url type="vcs-browser">https://github.com/Venipa/ytmdesktop2</url>
  <description>
    <p>${DESCRIPTION}</p>
  </description>
  <launchable type="desktop-id">${APP_ID}.desktop</launchable>
  <icon type="stock">${APP_ID}</icon>
  <releases>
    <release version="${version}" date="${date}"/>
  </releases>
  <categories>
    <category>AudioVideo</category>
    <category>Audio</category>
    <category>Player</category>
  </categories>
  <content_rating type="oars-1.1"/>
</component>
`;

	await mkdir(path.dirname(metainfoPath), { recursive: true });
	await writeFile(metainfoPath, xml, "utf8");

	const filesEntry = [metainfoPath, metainfoDest];
	for (const target of iterateTargets(context.targets)) {
		if (target?.name !== "flatpak" || !target.options) continue;
		const existing = Array.isArray(target.options.files) ? target.options.files : [];
		target.options.files = [...existing.filter((pair) => !(Array.isArray(pair) && String(pair[1]).endsWith(`${APP_ID}.metainfo.xml`))), filesEntry];
	}

	// Keep yaml config in sync for anything that re-reads packager.config.flatpak
	const flatpakConfig = context.packager.config.flatpak;
	if (flatpakConfig && typeof flatpakConfig === "object") {
		flatpakConfig.files = [filesEntry];
	}
};
