// Lightweight PDF text extraction using pdf-parse
// Install: npm install pdf-parse @types/pdf-parse

export async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid SSR issues
  const pdfParse = await import('pdf-parse').then(m => m.default || m)

  const data = await pdfParse(buffer)

  const lines = data.text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 2)

  return `PDF DOCUMENT (${data.numpages} pages)\n\n${lines.join('\n')}`
}
