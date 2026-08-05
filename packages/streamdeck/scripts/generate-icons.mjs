import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
	ListMusic,
	Play,
	Repeat,
	Shuffle,
	SkipBack,
	SkipForward,
	ThumbsDown,
	ThumbsUp,
	Volume1,
	Volume2,
} from "lucide-react";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pluginRoot = path.join(root, "com.venipa.ytmdesktop2.sdPlugin");
const imgsRoot = path.join(pluginRoot, "imgs");
const logoSvgPath = path.resolve(root, "../../apps/ytmdesktop2/src/renderer/src/assets/logo.svg");

/** @typedef {{ id: string; Icon: import("lucide-react").LucideIcon }} ActionIcon */

/** @type {ActionIcon[]} */
const ACTIONS = [
	{ id: "play-pause", Icon: Play },
	{ id: "next", Icon: SkipForward },
	{ id: "prev", Icon: SkipBack },
	{ id: "like", Icon: ThumbsUp },
	{ id: "dislike", Icon: ThumbsDown },
	{ id: "shuffle", Icon: Shuffle },
	{ id: "repeat", Icon: Repeat },
	{ id: "volume-up", Icon: Volume2 },
	{ id: "volume-down", Icon: Volume1 },
	{ id: "track-info", Icon: ListMusic },
];

async function writePngPair(basePathWithoutExt, size, render) {
	const oneX = await render(size);
	const twoX = await render(size * 2);
	await writeFile(`${basePathWithoutExt}.png`, oneX);
	await writeFile(`${basePathWithoutExt}@2x.png`, twoX);
}

function lucideSvg(Icon, pixelSize, strokeWidth = 2) {
	return renderToStaticMarkup(
		createElement(Icon, {
			size: pixelSize,
			color: "#ffffff",
			strokeWidth,
			absoluteStrokeWidth: false,
		}),
	);
}

async function renderActionListIcon(Icon, size) {
	const glyph = Math.round(size * 0.72);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
		<g transform="translate(${(size - glyph) / 2}, ${(size - glyph) / 2})">${lucideSvg(Icon, glyph, 2.25)}</g>
	</svg>`;
	return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderKeyIcon(Icon, size) {
	const radius = Math.round(size * 0.18);
	const glyph = Math.round(size * 0.46);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
		<rect width="${size}" height="${size}" rx="${radius}" fill="#141414"/>
		<g transform="translate(${(size - glyph) / 2}, ${(size - glyph) / 2})">${lucideSvg(Icon, glyph, 2)}</g>
	</svg>`;
	return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderLogo(size) {
	const logo = await readFile(logoSvgPath);
	return sharp(logo).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function main() {
	await rm(imgsRoot, { recursive: true, force: true });
	await mkdir(path.join(imgsRoot, "plugin"), { recursive: true });

	await writePngPair(path.join(imgsRoot, "plugin", "marketplace"), 256, renderLogo);
	await writePngPair(path.join(imgsRoot, "plugin", "category-icon"), 28, renderLogo);

	for (const action of ACTIONS) {
		const dir = path.join(imgsRoot, "actions", action.id);
		await mkdir(dir, { recursive: true });
		await writePngPair(path.join(dir, "icon"), 20, (size) => renderActionListIcon(action.Icon, size));
		await writePngPair(path.join(dir, "key"), 72, (size) => renderKeyIcon(action.Icon, size));
	}

	console.log(`Generated Stream Deck icons for ${ACTIONS.length} actions + plugin assets`);
}

await main();
