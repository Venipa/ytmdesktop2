import {
  appDescription,
  appName,
  appTagline,
  brandColor,
  repoName,
} from '@/lib/shared';
import { ImageResponse } from 'next/og';
import { Vibrant } from 'node-vibrant/node';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

type OgLogoFormat = 'svg' | 'png';

/** Screenshot: in-context capture. Render: fixed wide chrome. Render-auto: chrome sized to image aspect. */
export type OgImageType = 'screenshot' | 'render' | 'render-auto';

const OG_FONT_FAMILY = 'Inter';
const DEFAULT_OG_IMAGE = '/images/player-full.png';

type OgFontWeight = 500 | 600 | 700 | 800;
type Rgb = [number, number, number];

interface OgTheme {
  background: string;
  backgroundDeep: string;
  accent: string;
  accentRgb: Rgb;
  orbPrimary: string;
  orbSecondary: string;
  washHorizontal: string;
  washVertical: string;
}

const FALLBACK_ACCENT_RGB: Rgb = [139, 28, 195];
/** Brand OG canvas — never replace with DarkMuted (muddy mid-tones). */
const BASE_BACKGROUND_RGB: Rgb = [26, 15, 34];
const BASE_BACKGROUND_DEEP_RGB: Rgb = [18, 8, 24];

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount));
  return [
    clampChannel(a[0] + (b[0] - a[0]) * t),
    clampChannel(a[1] + (b[1] - a[1]) * t),
    clampChannel(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgbCss(rgb: Rgb, alpha = 1): string {
  if (alpha >= 1) return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function hexFromRgb(rgb: Rgb): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function toRgb(rgb: number[] | undefined, fallback: Rgb): Rgb {
  if (!rgb || rgb.length < 3) return fallback;
  return [clampChannel(rgb[0]!), clampChannel(rgb[1]!), clampChannel(rgb[2]!)];
}

/** Parse `#rrggbb` / `rrggbb` → RGB, or null if invalid. */
function parseHexColor(value: string | undefined): Rgb | null {
  if (!value) return null;
  const hex = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

/** Fixed dark base, lightly tinted by image accent — keeps canvas deep + readable. */
function buildTheme(accentRgb: Rgb): OgTheme {
  const background = mixRgb(BASE_BACKGROUND_RGB, accentRgb, 0.12);
  const backgroundDeep = mixRgb(BASE_BACKGROUND_DEEP_RGB, accentRgb, 0.1);

  return {
    background: hexFromRgb(background),
    backgroundDeep: hexFromRgb(backgroundDeep),
    accent: hexFromRgb(accentRgb),
    accentRgb,
    orbPrimary: rgbCss(accentRgb, 0.28),
    orbSecondary: rgbCss(accentRgb, 0.14),
    washHorizontal: `linear-gradient(90deg, ${hexFromRgb(background)} 30%, ${rgbCss(background, 0.85)} 58%, ${rgbCss(background, 0.3)} 100%)`,
    washVertical: `linear-gradient(180deg, ${rgbCss(background, 0.5)} 0%, transparent 42%, ${rgbCss(background, 0.7)} 100%)`,
  };
}

const FALLBACK_THEME: OgTheme = buildTheme(FALLBACK_ACCENT_RGB);

async function loadOgFonts(): Promise<
  Array<{
    name: string;
    data: Buffer;
    weight: OgFontWeight;
    style: 'normal';
  }>
> {
  const weights: OgFontWeight[] = [500, 600, 700, 800];
  const fontsDir = join(process.cwd(), 'assets/fonts');

  return Promise.all(
    weights.map(async (weight) => ({
      name: OG_FONT_FAMILY,
      data: await readFile(join(fontsDir, `inter-latin-${weight}-normal.woff`)),
      weight,
      style: 'normal' as const,
    })),
  );
}

async function getLogoDataUrl(format: OgLogoFormat): Promise<string> {
  if (format === 'svg') {
    const svg = await readFile(join(process.cwd(), 'public/logo.svg'), 'utf8');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const data = await readFile(join(process.cwd(), 'public/logo.png'));
  return `data:image/png;base64,${data.toString('base64')}`;
}

function resolvePublicPath(imagePath: string): string {
  const normalized = imagePath.replace(/^\//, '');
  return join(process.cwd(), 'public', normalized);
}

async function getPublicImageDataUrl(imagePath: string): Promise<string> {
  const absolute = resolvePublicPath(imagePath);
  const data = await readFile(absolute);
  const ext = absolute.split('.').pop()?.toLowerCase();
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'webp'
        ? 'image/webp'
        : 'image/png';
  return `data:${mime};base64,${data.toString('base64')}`;
}

async function getImageNaturalSize(imagePath: string): Promise<{ width: number; height: number }> {
  const meta = await sharp(resolvePublicPath(imagePath)).metadata();
  return {
    width: meta.width ?? 900,
    height: meta.height ?? 351,
  };
}

/** Scale image to fit OG right column while keeping aspect ratio. */
function fitRenderSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth = 560,
  maxHeight = 500,
): { width: number; height: number } {
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

/** Resolve accent: frontmatter `color` wins, else vibrant from image. */
async function extractOgTheme(imagePath: string, color?: string): Promise<OgTheme> {
  const manual = parseHexColor(color);
  if (manual) return buildTheme(manual);

  try {
    const palette = await Vibrant.from(resolvePublicPath(imagePath)).getPalette();
    const accent = toRgb(
      palette.Vibrant?.rgb ?? palette.DarkVibrant?.rgb ?? palette.Muted?.rgb,
      FALLBACK_ACCENT_RGB,
    );

    return buildTheme(accent);
  } catch {
    return FALLBACK_THEME;
  }
}

function DocsBrandHeader({ logoSrc }: { logoSrc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        alt=""
        width={52}
        height={52}
        style={{ borderRadius: 12 }}
      />
      <span
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: -0.5,
          color: '#fafafa',
        }}
      >
        {appName}
      </span>
    </div>
  );
}

function DocsTitleBlock({
  title,
  description,
  maxWidth = 760,
}: {
  title: string;
  description?: string;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginTop: 40,
        maxWidth,
      }}
    >
      <div
        style={{
          fontSize: 68,
          fontWeight: 800,
          lineHeight: 1.08,
          color: '#fafafa',
          letterSpacing: -0.8,
        }}
      >
        {title}
      </div>
      {description ? (
        <div
          style={{
            marginTop: 20,
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.35,
            color: '#a1a1aa',
            letterSpacing: -0.2,
          }}
        >
          {description}
        </div>
      ) : null}
    </div>
  );
}

/** Screenshot OG — feature shown in-context (desktop / screen chrome). */
function DocsScreenshotOg({
  title,
  description,
  logoSrc,
  imageSrc,
  theme,
}: {
  title: string;
  description?: string;
  logoSrc: string;
  imageSrc: string;
  theme: OgTheme;
}) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: theme.background,
        fontFamily: OG_FONT_FAMILY,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt=""
        width={920}
        height={608}
        style={{
          position: 'absolute',
          right: -100,
          bottom: -140,
          opacity: 0.4,
          transform: 'rotate(-8deg)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: theme.washHorizontal,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: theme.washVertical,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -100,
          left: -60,
          width: 480,
          height: 480,
          borderRadius: 999,
          background: theme.orbPrimary,
        }}
      />

      <div
        style={{
          display: 'flex',
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: '64px 72px',
        }}
      >
        <DocsBrandHeader logoSrc={logoSrc} />
        <DocsTitleBlock title={title} description={description} />
      </div>
    </div>
  );
}

/** Render OG — feature chrome only, no desktop/screenshot framing. */
function DocsRenderOg({
  title,
  description,
  logoSrc,
  imageSrc,
  theme,
  imageWidth,
  imageHeight,
}: {
  title: string;
  description?: string;
  logoSrc: string;
  imageSrc: string;
  theme: OgTheme;
  imageWidth: number;
  imageHeight: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: theme.background,
        fontFamily: OG_FONT_FAMILY,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -40,
          width: 520,
          height: 520,
          borderRadius: 999,
          background: theme.orbPrimary,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -160,
          left: -80,
          width: 420,
          height: 420,
          borderRadius: 999,
          background: theme.orbSecondary,
        }}
      />

      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          padding: '56px 64px',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: 480,
            maxWidth: 480,
            flexShrink: 0,
          }}
        >
          <DocsBrandHeader logoSrc={logoSrc} />
          <DocsTitleBlock title={title} description={description} maxWidth={480} />
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt=""
            width={imageWidth}
            height={imageHeight}
            style={{
              width: imageWidth,
              height: imageHeight,
              borderRadius: 20,
              boxShadow: `0 28px 80px ${rgbCss(theme.accentRgb, 0.35)}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function AppPresentOg({
  logoSrc,
  screenshotSrc,
  theme,
}: {
  logoSrc: string;
  screenshotSrc: string;
  theme: OgTheme;
}) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: theme.backgroundDeep,
        fontFamily: OG_FONT_FAMILY,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -120,
          left: '40%',
          width: 560,
          height: 560,
          borderRadius: 999,
          background: theme.orbPrimary,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -160,
          left: -80,
          width: 420,
          height: 420,
          borderRadius: 999,
          background: theme.orbSecondary,
        }}
      />

      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          padding: '48px 56px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 480,
            maxWidth: 480,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
              width={72}
              height={72}
              style={{ borderRadius: 16 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: '#fafafa',
                  letterSpacing: -0.6,
                  lineHeight: 1.1,
                }}
              >
                {appName}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 18,
                  fontWeight: 600,
                  color: theme.accent || brandColor,
                  letterSpacing: 0,
                }}
              >
                {repoName}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 36,
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 1.15,
              color: '#fafafa',
              letterSpacing: -0.8,
            }}
          >
            {appTagline}
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: 24,
              fontWeight: 500,
              lineHeight: 1.4,
              color: '#a1a1aa',
              letterSpacing: -0.2,
            }}
          >
            {appDescription}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            {['Last.fm', 'Discord', 'Themes', 'Stream Deck'].map((label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: `1px solid ${rgbCss(theme.accentRgb, 0.28)}`,
                  background: rgbCss(theme.accentRgb, 0.08),
                  color: '#e4e4e7',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: 620,
            height: 520,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotSrc}
            alt=""
            width={600}
            height={396}
            style={{
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.14)',
              imageRendering: 'smooth',
              boxShadow: `0 28px 80px ${rgbCss(theme.accentRgb, 0.4)}`,
              transform: 'rotate(-2deg)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export async function createOgImage({
  title,
  description,
  logo = 'svg',
  image,
  imageType = 'screenshot',
  color,
}: {
  title: string;
  description?: string;
  /** Dynamic OG routes prefer SVG; static opengraph-image uses PNG. */
  logo?: OgLogoFormat;
  /** Public path, e.g. `/images/features-trayview-compact.png`. */
  image?: string;
  imageType?: OgImageType;
  /** Manual accent hex (`#rrggbb`). Skips vibrant when set. */
  color?: string;
}) {
  const imagePath = image ?? DEFAULT_OG_IMAGE;
  const useRender = imageType === 'render' || imageType === 'render-auto';

  const [logoSrc, imageSrc, fonts, theme, renderSize] = await Promise.all([
    getLogoDataUrl(logo),
    getPublicImageDataUrl(imagePath),
    loadOgFonts(),
    extractOgTheme(imagePath, color),
    useRender && imageType === 'render-auto'
      ? getImageNaturalSize(imagePath).then(({ width, height }) => fitRenderSize(width, height))
      : Promise.resolve({ width: 900, height: 351 }),
  ]);

  const body = useRender ? (
    <DocsRenderOg
      title={title}
      description={description}
      logoSrc={logoSrc}
      imageSrc={imageSrc}
      theme={theme}
      imageWidth={renderSize.width}
      imageHeight={renderSize.height}
    />
  ) : (
    <DocsScreenshotOg
      title={title}
      description={description}
      logoSrc={logoSrc}
      imageSrc={imageSrc}
      theme={theme}
    />
  );

  return new ImageResponse(body, {
    width: 1200,
    height: 630,
    fonts,
  });
}

/** Root / landing OG — presents the app (PNG logo). */
export async function createHomeOgImage() {
  const [logoSrc, screenshotSrc, fonts, theme] = await Promise.all([
    getLogoDataUrl('png'),
    getPublicImageDataUrl(DEFAULT_OG_IMAGE),
    loadOgFonts(),
    extractOgTheme(DEFAULT_OG_IMAGE, '#4a0f22'),
  ]);

  return new ImageResponse(
    <AppPresentOg logoSrc={logoSrc} screenshotSrc={screenshotSrc} theme={theme} />,
    {
      width: 1200,
      height: 630,
      fonts,
    },
  );
}
