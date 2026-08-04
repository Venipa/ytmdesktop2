import {
  RiCodeSSlashLine,
  RiDiscordLine,
  RiInformationLine,
  RiMusic2Line,
  RiPlugLine,
  RiSettings3Line,
} from "@remixicon/react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ComponentType, type CSSProperties, memo, useEffect } from "react";
import LogoIcon from "@/assets/logo.svg?react";
import { ControlBar } from "@/components/control-bar";
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
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_settings")({
	component: SettingsLayout,
});

const tabs = [
	{ to: "/", label: "Generic", icon: RiSettings3Line },
	{ to: "/player", label: "Player", icon: RiMusic2Line },
	{ to: "/discord", label: "Discord", icon: RiDiscordLine },
	{ to: "/custom-css", label: "Custom CSS", icon: RiCodeSSlashLine },
	{ to: "/integrations", label: "Integrations", icon: RiPlugLine },
	{ to: "/about", label: "About", icon: RiInformationLine },
] as const;

type SettingsTabTo = (typeof tabs)[number]["to"];

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

function SettingsLayout() {
	useEffect(() => {
		document.title = "YouTube Music - Settings";
	}, []);

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
									{tabs.map((tab) => (
										<SettingsNavItem key={tab.to} to={tab.to} label={tab.label} icon={tab.icon} />
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
					<SidebarFooter className="gap-y-2 border-t border-sidebar-border py-3 px-0">
						<div className="flex flex-col gap-1 px-3 text-[10px] text-muted-foreground">
							<span>
								v{window.api.version}@{window.app.environment}
							</span>
							<span>{window.app.platform}</span>
						</div>
						<SidebarSeparator className="p-0 m-0" />
						<div className="flex flex-col gap-1 px-3">
							<a
								href="https://github.com/Venipa/ytmdesktop2"
								className="text-xs text-muted-foreground hover:text-sidebar-foreground"
								target="_blank"
								rel="noreferrer"
							>
								Github
							</a>
							<a
								href="https://youtube-music.app"
								className="text-xs text-muted-foreground hover:text-sidebar-foreground"
								target="_blank"
								rel="noreferrer"
							>
								Website
							</a>
						</div>
					</SidebarFooter>
				</Sidebar>
				<SidebarInset className="min-h-0 overflow-hidden">
					<ScrollArea className="h-full">
						<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
							<Outlet />
						</div>
					</ScrollArea>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
