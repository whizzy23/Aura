const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractTextFromBuffer(file) {
	if (!file) return '';
	if (file.mimetype === 'application/pdf') {
		const pdfData = await pdfParse(file.buffer);
		return pdfData.text || '';
	}
	if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
		const result = await mammoth.extractRawText({ buffer: file.buffer });
		return result.value || '';
	}
	return '';
}

module.exports = { extractTextFromBuffer };