import {
  appDescription,
  appName,
  appTagline,
  brandColor,
  repoName,
} from '@/lib/shared';
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type OgLogoFormat = 'svg' | 'png';

const OG_FONT_FAMILY = 'Inter';

type OgFontWeight = 500 | 600 | 700 | 800;

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

async function getScreenshotDataUrl(): Promise<string> {
  const data = await readFile(join(process.cwd(), 'public/images/player-full.png'));
  return `data:image/png;base64,${data.toString('base64')}`;
}

function DocsHeroOg({
  title,
  description,
  logoSrc,
  screenshotSrc,
}: {
  title: string;
  description?: string;
  logoSrc: string;
  screenshotSrc: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#1a0f22',
        fontFamily: OG_FONT_FAMILY,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={screenshotSrc}
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
          backgroundImage:
            'linear-gradient(90deg, #1a0f22 30%, rgba(26,15,34,0.85) 58%, rgba(26,15,34,0.3) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(180deg, rgba(26,15,34,0.5) 0%, transparent 42%, rgba(26,15,34,0.7) 100%)',
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
          background: 'rgba(139, 28, 195, 0.2)',
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

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 40,
            maxWidth: 760,
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
      </div>
    </div>
  );
}

function AppPresentOg({
  logoSrc,
  screenshotSrc,
}: {
  logoSrc: string;
  screenshotSrc: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#120818',
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
          background: 'rgba(139, 28, 195, 0.22)',
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
          background: 'rgba(139, 28, 195, 0.12)',
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
                  color: brandColor,
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
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.04)',
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
              boxShadow: '0 28px 80px rgba(0,0,0,0.55)',
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
}: {
  title: string;
  description?: string;
  /** Dynamic OG routes prefer SVG; static opengraph-image uses PNG. */
  logo?: OgLogoFormat;
}) {
  const [logoSrc, screenshotSrc, fonts] = await Promise.all([
    getLogoDataUrl(logo),
    getScreenshotDataUrl(),
    loadOgFonts(),
  ]);

  return new ImageResponse(
    (
      <DocsHeroOg
        title={title}
        description={description}
        logoSrc={logoSrc}
        screenshotSrc={screenshotSrc}
      />
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    },
  );
}

/** Root / landing OG — presents the app (PNG logo). */
export async function createHomeOgImage() {
  const [logoSrc, screenshotSrc, fonts] = await Promise.all([
    getLogoDataUrl('png'),
    getScreenshotDataUrl(),
    loadOgFonts(),
  ]);

  return new ImageResponse(
    <AppPresentOg logoSrc={logoSrc} screenshotSrc={screenshotSrc} />,
    {
      width: 1200,
      height: 630,
      fonts,
    },
  );
}
