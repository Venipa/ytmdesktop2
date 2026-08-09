/** Cheap string similarity (dice on bigrams). 1 = identical. */
export function stringSimilarity(a: string, b: string): number {
	const x = a.toLowerCase().trim();
	const y = b.toLowerCase().trim();
	if (!x || !y) return 0;
	if (x === y) return 1;
	if (x.includes(y) || y.includes(x)) return 0.95;

	const bigrams = (s: string): Map<string, number> => {
		const map = new Map<string, number>();
		for (let i = 0; i < s.length - 1; i++) {
			const g = s.slice(i, i + 2);
			map.set(g, (map.get(g) ?? 0) + 1);
		}
		return map;
	};

	const A = bigrams(x);
	const B = bigrams(y);
	let intersection = 0;
	for (const [g, n] of A) {
		const m = B.get(g);
		if (m) intersection += Math.min(n, m);
	}
	const total = [...A.values()].reduce((s, n) => s + n, 0) + [...B.values()].reduce((s, n) => s + n, 0);
	return total ? (2 * intersection) / total : 0;
}

export function splitArtists(raw: string): string[] {
	return raw
		.split(/[&,]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Best artist-pair similarity across both sides. */
export function artistMatchRatio(queryArtist: string, resultArtist: string): number {
	const left = splitArtists(queryArtist);
	const right = splitArtists(resultArtist);
	if (!left.length || !right.length) return 0;
	let best = 0;
	for (const a of left) {
		for (const b of right) {
			best = Math.max(best, stringSimilarity(a, b));
		}
	}
	return best;
}
