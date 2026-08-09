type TrustedScriptPolicy = {
	createScript: (input: string) => unknown;
};

let scriptPolicy: TrustedScriptPolicy | null | undefined;

function getScriptPolicy(): TrustedScriptPolicy | null {
	if (scriptPolicy !== undefined) return scriptPolicy;
	const tt = (
		globalThis as {
			trustedTypes?: {
				createPolicy: (name: string, rules: { createScript: (s: string) => string }) => TrustedScriptPolicy;
			};
		}
	).trustedTypes;
	if (!tt?.createPolicy) {
		scriptPolicy = null;
		return null;
	}
	try {
		scriptPolicy = tt.createPolicy("ytmdWorld0", {
			createScript: (s: string) => s,
		});
	} catch {
		try {
			scriptPolicy = tt.createPolicy(`ytmdWorld0_${Date.now()}`, {
				createScript: (s: string) => s,
			});
		} catch {
			scriptPolicy = null;
		}
	}
	return scriptPolicy;
}

/**
 * Run inline JS in page world.
 * YTM enables Trusted Types (`TrustedScript`) so raw `script.textContent = ...` is blocked.
 */
export function runPageScript(source: string, id: string): void {
	const body = `${source}\n//# sourceURL=ytmd-${id}.js`;
	const policy = getScriptPolicy();
	const trusted = policy ? policy.createScript(body) : body;
	const runEval = globalThis.eval.bind(globalThis) as (code: unknown) => unknown;

	try {
		runEval(trusted);
		return;
	} catch {
		/* fall through to script element */
	}

	const el = document.createElement("script");
	el.dataset.ytmdScript = id;
	try {
		(el as unknown as { text: unknown }).text = trusted;
	} catch {
		try {
			el.textContent = typeof trusted === "string" ? trusted : String(trusted);
		} catch (err) {
			throw err instanceof Error ? err : new Error(String(err));
		}
	}
	(document.documentElement ?? document.head).appendChild(el);
	el.remove();
}

/** Strip ESM exports so module source runs as page-world IIFE. */
export function moduleSourceToIife(source: string, invoke: string): string {
	const body = source
		.replace(/\bexport\s+const\s+/g, "const ")
		.replace(/\bexport\s+function\s+/g, "function ")
		.replace(/\bexport\s+\{[^}]*\}\s*;?/g, "");
	return `(() => {\n${body}\n${invoke}\n})();`;
}
