import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import LogoIcon from "@/assets/logo.svg?react";
import { ControlBar } from "@/components/control-bar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_settings")({
	component: SettingsLayout,
});

const tabs = [
	{ to: "/", label: "Generic" },
	{ to: "/player", label: "Player" },
	{ to: "/discord", label: "Discord" },
	{ to: "/custom-css", label: "Custom CSS" },
	{ to: "/integrations", label: "Integrations" },
	{ to: "/about", label: "About" },
] as const;

function SettingsLayout() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	useEffect(() => {
		document.title = "YouTube Music - Settings";
	}, []);

	return (
		<div className="absolute inset-0 flex h-full flex-col overflow-hidden">
			<ControlBar title="Settings" />
			<div className="flex flex-auto flex-col">
				<div className="border-b border-gray-700 bg-black/80 pt-2 pb-0">
					<div className="container mx-auto flex gap-1 px-2">
						{tabs.map((tab) => {
							const active = pathname === tab.to;
							return (
								<Link
									key={tab.to}
									to={tab.to}
									className={cn(
										"border-b-2 px-3 py-2 text-sm text-muted-foreground transition-colors",
										active ? "border-primary text-foreground" : "border-transparent hover:text-foreground",
									)}
								>
									{tab.label}
								</Link>
							);
						})}
					</div>
				</div>
				<div className="relative flex-auto overflow-auto bg-black/30">
					<div className="container absolute inset-0 mx-auto mb-8 flex flex-col">
						<Outlet />
						<div className="mb-6 flex-auto" />
						<div className="flex flex-shrink-0 flex-row items-end border-t border-t-gray-500 px-3 pt-3 pb-3 -mb-6">
							<div className="flex flex-shrink-0 flex-col gap-1 self-center">
								<div className="flex items-center gap-2 text-xs">
									<LogoIcon className="pointer-events-none size-4" />
									<span>YouTube Music for Desktop</span>
								</div>
								<span className="text-xs text-muted-foreground">
									v{window.api.version}@{window.process.environment} ({window.process.platform})
								</span>
							</div>
							<div className="flex-[1_1_40px]" />
							<div className="flex flex-col items-end justify-end gap-1">
								<a href="https://github.com/Venipa/ytmdesktop2" className="text-xs text-muted-foreground hover:text-foreground" target="_blank" rel="noreferrer">
									Github
								</a>
								<a href="https://youtube-music.app" className="text-xs text-muted-foreground hover:text-foreground" target="_blank" rel="noreferrer">
									Website
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
