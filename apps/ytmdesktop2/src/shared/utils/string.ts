export function escapeHTML(string?: string | null) {
	if (!string) return null;
	const htmlEscapes: { [key: string]: string } = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
		"`": "&#96;",
		"=": "&#61;",
		"/": "&#47;",
	};

	const reUnescapedHtml = /[&<>"'`=\/]/g;
	const reHasUnescapedHtml = /[&<>"'`=\/]/;

	if (!reHasUnescapedHtml.test(string)) return string;

	return string.replace(reUnescapedHtml, (chr) => htmlEscapes[chr]);
}
