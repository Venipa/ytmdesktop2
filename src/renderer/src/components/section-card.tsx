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
		<Card
			className={cn("relative cursor-default overflow-hidden transition-colors", onClick && "cursor-pointer hover:bg-accent/40", className)}
			onClick={onClick}
		>
			{loading && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
					<Spinner />
				</div>
			)}
			<CardContent>{children}</CardContent>
		</Card>
	);
}
