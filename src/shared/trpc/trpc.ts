import { initTRPC } from "@trpc/server";
import type { AppTrpcContext } from "./context";

const t = initTRPC.context<AppTrpcContext>().create({
	isServer: true,
	errorFormatter({ shape }) {
		return shape;
	},
});

export const router = t.router;
export const publicProcedure = t.procedure;
