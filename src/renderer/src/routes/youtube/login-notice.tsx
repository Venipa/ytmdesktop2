import { createFileRoute } from "@tanstack/react-router";
import AlertIcon from "@/assets/icons/alert-triangle.svg?react";
import { ControlBar } from "@/components/control-bar";

export const Route = createFileRoute("/youtube/login-notice")({
	component: LoginNoticePage,
});

function LoginNoticePage() {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<ControlBar title="Google - Login" divider={<span>&nbsp;</span>} />
			<div className="pointer-events-none flex flex-auto flex-shrink-0 select-none items-center bg-blue-500 text-sm text-white">
				<div className="container flex items-start justify-center gap-2">
					<AlertIcon className="mt-1 size-4 flex-shrink-0" />
					<div className="flex flex-col leading-tight">
						<p>
							If there are any issues logging in, press <strong>try again</strong> until it works.
						</p>
						<p className="break-words">
							This is happening due to google tightening security on unofficial apps or to be more specific "electron apps".
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
