function parseModelJson(text, fallback = {}) {
	if (!text) return fallback;
	try {
		const cleaned = text
			.replace(/```json\n?/g, '')
			.replace(/```\n?/g, '')
			.trim();
		return JSON.parse(cleaned);
	} catch (_err) {
		return fallback;
	}
}

module.exports = { parseModelJson };