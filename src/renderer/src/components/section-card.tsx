import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface SectionCardProps {
	loading?: boolean;
	className?: string;
	children?: ReactNode;
	onClick?: () => void;
}

export function SectionCard({ loading, className, children, onClick }: SectionCardProps) {
	return (
		<Card className={cn("relative mt-4 overflow-hidden bg-white/5", className)} onClick={onClick}>
			{loading && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-600/70 text-sm text-gray-200">
					<Spinner />
				</div>
			)}
			<CardContent className="p-6">{children}</CardContent>
		</Card>
	);
}
