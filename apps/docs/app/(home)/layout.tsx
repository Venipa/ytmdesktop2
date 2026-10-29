import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Footer } from "@/components/footer";
import { HomeNav } from "@/components/home-nav";
import { Logo } from "@/components/logo";
import {
  getLatestReleasesByChannel,
  getLatestReleaseUrl,
  getRepositoryUrl,
  pickPrimaryDownload,
} from "@/lib/github";
import { baseOptions } from "@/lib/layout.shared";
import { changelogRoute, docsRoute, formatStarCount, repoStars, socials } from "@/lib/shared";

export default async function Layout({ children }: LayoutProps<"/">) {
  const options = baseOptions();
  const releases = await getLatestReleasesByChannel();
  const release = releases.stable ?? releases.beta ?? releases.alpha ?? null;

  return (
    // Match home content / footer (`max-w-6xl` = 72rem)
    <HomeLayout
      {...options}
      nav={{ ...options.nav, enabled: false }}
      className="[--fd-layout-width:72rem]"
    >
      <HomeNav
        release={release}
        downloadUrl={
          (release && pickPrimaryDownload(release.assets)?.browser_download_url) ??
          getLatestReleaseUrl()
        }
        repositoryUrl={getRepositoryUrl()}
        stars={repoStars != null ? formatStarCount(repoStars) : null}
        discordUrl={socials.discord?.url ?? null}
        docsRoute={docsRoute}
        changelogRoute={changelogRoute}
        logo={<Logo />}
      />
      {children}
      <Footer />
    </HomeLayout>
  );
}
