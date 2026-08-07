import {
	RiAlbumLine,
	RiArrowRightSLine,
	RiCodeSSlashLine,
	RiComputerLine,
	RiDashboardLine,
	RiDiscordLine,
	RiGithubFill,
	RiGlobalLine,
	RiInformationLine,
	RiKey2Line,
	RiMusic2Line,
	RiPaletteLine,
	RiQrCodeLine,
	RiServerLine,
	RiSettings3Line,
	RiShieldKeyholeLine,
} from "@remixicon/react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ComponentType, type CSSProperties, memo, Suspense, useEffect, useState } from "react";
import LogoIcon from "@/assets/logo.svg?react";
import { ControlBar } from "@/components/control-bar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { SpinnerPage } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_settings")({
	component: SettingsLayout,
});

const tabs = [
	{ to: "/", label: "Generic", icon: RiSettings3Line },
	{ to: "/player", label: "Player", icon: RiMusic2Line },
	{ to: "/discord", label: "Discord", icon: RiDiscordLine },
	{ to: "/lastfm", label: "Last.fm", icon: RiAlbumLine },
	{ to: "/about", label: "About", icon: RiInformationLine },
] as const;

const apiCoreSubs = [
	{ to: "/api-integrations/api", label: "API", icon: RiServerLine },
	{ to: "/api-integrations/authentication", label: "Authentication", icon: RiKey2Line },
] as const;

const apiIntegrationSubs = [
	{ to: "/api-integrations/remote", label: "Remote", icon: RiQrCodeLine },
	{ to: "/api-integrations/streamdeck", label: "Stream Deck", icon: RiDashboardLine },
] as const;

const appearanceSubs = [
	{ to: "/appearance/themes", label: "Themes", icon: RiCodeSSlashLine },
	{ to: "/appearance/display", label: "Display", icon: RiComputerLine },
] as const;

const socials = [
	{ href: "https://github.com/Venipa/ytmdesktop2", label: "GitHub", icon: RiGithubFill },
	{ href: "https://youtube-music.app", label: "Website", icon: RiGlobalLine },
] as const;

type SettingsTabTo =
	| (typeof tabs)[number]["to"]
	| (typeof apiCoreSubs)[number]["to"]
	| (typeof apiIntegrationSubs)[number]["to"]
	| (typeof appearanceSubs)[number]["to"];

/** Avoid Link+useRender compose — breaks first click with hash history. */
const SettingsNavItem = memo(function SettingsNavItem({
	to,
	label,
	icon: Icon,
}: {
	to: SettingsTabTo;
	label: string;
	icon: ComponentType<{ className?: string }>;
}) {
	const navigate = useNavigate();
	const isActive = useRouterState({
		select: (s) => s.location.pathname === to,
	});

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={isActive}
				onClick={() => {
					if (isActive) return;
					void navigate({ to });
				}}
			>
				<Icon />
				<span>{label}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
});

const SettingsNavSubItem = memo(function SettingsNavSubItem({
	to,
	label,
	icon: Icon,
}: {
	to: SettingsTabTo;
	label: string;
	icon: ComponentType<{ className?: string }>;
}) {
	const navigate = useNavigate();
	const isActive = useRouterState({
		select: (s) => s.location.pathname === to,
	});

	return (
		<SidebarMenuSubItem>
			<SidebarMenuSubButton
				isActive={isActive}
				onClick={() => {
					if (isActive) return;
					void navigate({ to });
				}}
			>
				<Icon />
				<span>{label}</span>
			</SidebarMenuSubButton>
		</SidebarMenuSubItem>
	);
});

const ApiIntegrationsNav = memo(function ApiIntegrationsNav() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const isSectionActive = pathname.startsWith("/api-integrations");
	const [open, setOpen] = useState(isSectionActive);

	useEffect(() => {
		if (isSectionActive) setOpen(true);
	}, [isSectionActive]);

	return (
		<SidebarMenuItem>
			<Collapsible open={open} onOpenChange={setOpen} className="group/collapsible w-full">
				<CollapsibleTrigger render={<SidebarMenuButton isActive={isSectionActive} />}>
					<RiShieldKeyholeLine />
					<span>API & Integrations</span>
					<RiArrowRightSLine
						className={cn("ml-auto transition-transform duration-150 ease-out", open && "rotate-90")}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{apiCoreSubs.map((item) => (
							<SettingsNavSubItem key={item.to} {...item} />
						))}
						<li className="px-2 pt-2 pb-0.5" aria-hidden>
							<span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Integrations</span>
						</li>
						{apiIntegrationSubs.map((item) => (
							<SettingsNavSubItem key={item.to} {...item} />
						))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	);
});

const AppearanceNav = memo(function AppearanceNav() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const isSectionActive = pathname.startsWith("/appearance");
	const [open, setOpen] = useState(isSectionActive);

	useEffect(() => {
		if (isSectionActive) setOpen(true);
	}, [isSectionActive]);

	return (
		<SidebarMenuItem>
			<Collapsible open={open} onOpenChange={setOpen} className="group/collapsible w-full">
				<CollapsibleTrigger render={<SidebarMenuButton isActive={isSectionActive} />}>
					<RiPaletteLine />
					<span>Appearance</span>
					<RiArrowRightSLine
						className={cn("ml-auto transition-transform duration-150 ease-out", open && "rotate-90")}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{appearanceSubs.map((item) => (
							<SettingsNavSubItem key={item.to} {...item} />
						))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	);
});

function SettingsLayout() {
	useEffect(() => {
		document.title = "YouTube Music - Settings";
	}, []);

	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<div className="absolute inset-0 flex h-full flex-col overflow-hidden bg-background">
			<ControlBar title="Settings" />
			<SidebarProvider className="min-h-0 flex-1" defaultOpen style={{ "--sidebar-width": "14rem" } as CSSProperties}>
				<Sidebar collapsible="none" className="border-r border-sidebar-border">
					<SidebarHeader className="gap-2 border-b border-sidebar-border p-3">
						<div className="flex items-center gap-2 px-1">
							<LogoIcon className="size-5 shrink-0" />
							<div className="flex min-w-0 flex-col">
								<span className="truncate text-xs font-medium text-sidebar-foreground">YouTube Music</span>
								<span className="truncate text-[10px] text-muted-foreground">Desktop Settings</span>
							</div>
						</div>
					</SidebarHeader>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>Preferences</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu className="flex flex-col gap-1">
									{tabs.slice(0, 4).map((tab) => (
										<SettingsNavItem key={tab.to} to={tab.to} label={tab.label} icon={tab.icon} />
									))}
									<ApiIntegrationsNav />
									<AppearanceNav />
									{tabs.slice(4).map((tab) => (
										<SettingsNavItem key={tab.to} to={tab.to} label={tab.label} icon={tab.icon} />
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
					<SidebarFooter className="gap-y-2 border-t border-sidebar-border py-3 px-0">
						<div className="flex flex-col gap-1 px-3 text-[10px] text-muted-foreground">
							<span>
								v{window.api.version} ({window.app.environment})
							</span>
							<span>{window.app.platform}</span>
						</div>
						<SidebarSeparator className="p-0 m-0" />
						<div className="flex items-center gap-1 px-3">
							{socials.map(({ href, label, icon: Icon }) => (
								<a
									key={href}
									href={href}
									target="_blank"
									rel="noreferrer"
									aria-label={label}
									title={label}
									className={cn(
										"inline-flex size-8 items-center justify-center rounded-md text-muted-foreground",
										"transition-colors duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground",
										"active:scale-[0.97]",
									)}
								>
									<Icon className="size-4" />
									<span className="sr-only">{label}</span>
								</a>
							))}
						</div>
					</SidebarFooter>
				</Sidebar>
				<SidebarInset className="min-h-0 overflow-hidden">
					{pathname.startsWith("/api-integrations") ? (
						<Outlet />
					) : (
						<ScrollArea className="h-full">
							<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 pb-32">
								<Suspense key={pathname} fallback={<SpinnerPage />}>
									<Outlet />
								</Suspense>
							</div>
						</ScrollArea>
					)}
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
