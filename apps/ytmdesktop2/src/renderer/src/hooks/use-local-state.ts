import { type Dispatch, type SetStateAction, useState } from "react";

const LOCAL_STATE_VERSION = 1;

type Envelope<T> = { v: number; value: T };

export function parseLocalState<T>(raw: string | null, fallback: T): T {
	if (!raw) return fallback;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return fallback;
		const env = parsed as Envelope<T>;
		if (env.v !== LOCAL_STATE_VERSION) return fallback;
		return env.value;
	} catch {
		return fallback;
	}
}

export function serializeLocalState<T>(value: T): string {
	return JSON.stringify({ v: LOCAL_STATE_VERSION, value } satisfies Envelope<T>);
}

function readLocalState<T>(key: string, fallback: T): T {
	if (typeof localStorage === "undefined") return fallback;
	try {
		return parseLocalState(localStorage.getItem(key), fallback);
	} catch {
		return fallback;
	}
}

function writeLocalState<T>(key: string, value: T): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(key, serializeLocalState(value));
	} catch {
		/* quota / private mode */
	}
}

/** Persist React state to localStorage. Write on set, not in an effect. */
export function useLocalState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
	const [state, setState] = useState(() => readLocalState(key, initial));

	const setPersisted: Dispatch<SetStateAction<T>> = (update) => {
		setState((prev) => {
			const next = typeof update === "function" ? (update as (value: T) => T)(prev) : update;
			writeLocalState(key, next);
			return next;
		});
	};

	return [state, setPersisted];
}
