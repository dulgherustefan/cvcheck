import { NextRequest } from 'next/server'

// Shared by /api/roast and /api/roast/optimize — both need the same
// file/URL → raw text extraction with the same validation (size, MIME,
// magic bytes, SSRF guard on scraped URLs).

export interface ExtractedContent {
  content: string
  source?: string
  jobDescription: string
}

export type ExtractResult =
  | { ok: true; data: ExtractedContent }
  | { ok: false; error: string; status: number }

const MAX_FILE_SIZE = 5 * 1024 * 1024          // 5 MB
const ALLOWED_MIME  = new Set(['application/pdf', 'text/plain'])

function isBlockedHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.16.') ||
    host === '0.0.0.0' ||
    host === '[::1]'
  )
}

function validateUrl(url: string): { ok: true; parsed: URL } | { ok: false; error: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Only http/https URLs are accepted' }
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, error: 'Invalid URL' }
  }
  return { ok: true, parsed }
}

export async function extractContentFromRequest(req: NextRequest): Promise<ExtractResult> {
  const contentType = req.headers.get('content-type') ?? ''
  let content = ''
  let source: string | undefined
  let jobDescription = ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const url  = formData.get('url') as string | null
    const jd   = formData.get('jobDescription')
    if (typeof jd === 'string') jobDescription = jd

    if (file) {
      if (file.size > MAX_FILE_SIZE) return { ok: false, error: 'File too large (max 5 MB)', status: 400 }
      if (!ALLOWED_MIME.has(file.type)) return { ok: false, error: 'Only PDF and plain-text files are accepted', status: 400 }

      const buffer = Buffer.from(await file.arrayBuffer())

      if (file.type === 'application/pdf') {
        if (buffer.length < 4 || buffer.slice(0, 4).toString('ascii') !== '%PDF') {
          return { ok: false, error: 'Invalid PDF file', status: 400 }
        }
      }

      if (file.type === 'text/plain') {
        content = buffer.toString('utf8')
        source = 'text-upload'
      } else {
        const { extractPdfText } = await import('@/lib/pdf')
        content = await extractPdfText(buffer)
        source = 'pdf-upload'
      }
    } else if (url) {
      const v = validateUrl(url)
      if (!v.ok) return { ok: false, error: v.error, status: 400 }
      const { scrapeUrl } = await import('@/lib/scraper')
      content = await scrapeUrl(url)
      source = url
    } else {
      return { ok: false, error: 'No file or URL provided', status: 400 }
    }
  } else if (contentType.includes('application/json')) {
    let body: { url?: string; jobDescription?: string }
    try {
      body = await req.json()
    } catch {
      return { ok: false, error: 'Invalid JSON body', status: 400 }
    }
    if (typeof body?.jobDescription === 'string') jobDescription = body.jobDescription
    const url = body?.url
    if (!url || typeof url !== 'string') return { ok: false, error: 'No URL provided', status: 400 }

    const v = validateUrl(url)
    if (!v.ok) return { ok: false, error: v.error, status: 400 }
    const { scrapeUrl } = await import('@/lib/scraper')
    content = await scrapeUrl(url)
    source = url
  } else {
    return { ok: false, error: 'Unsupported content type', status: 415 }
  }

  return { ok: true, data: { content, source, jobDescription } }
}
