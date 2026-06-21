// ── Email templates for job alerts ───────────────────────────────────────────
// Kept separate from route files so Next.js doesn't complain about non-route exports.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cvcheck.app'

// Job titles/companies/locations come from third-party job boards (Adzuna,
// Remotive, etc.) and user-derived CV meta — never trust them as raw HTML.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// For values used inside href="..." — only allow http(s), else drop to '#'.
function escUrl(s: unknown): string {
  const url = String(s ?? '').trim()
  if (!/^https?:\/\//i.test(url)) return '#'
  return esc(url)
}

export function buildConfirmationEmail({ email, domain, level, unsubscribeToken }: {
  email: string; domain: string; level: string; unsubscribeToken: string
}) {
  const unsubUrl = `${APP_URL}/api/jobs/alert/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
  domain = esc(domain); level = esc(level); email = esc(email)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#08070F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#08070F;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0E0D1C;border:0.5px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden">
        <tr><td style="padding:28px 32px 20px;border-bottom:0.5px solid rgba(255,255,255,0.07)">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;height:28px;background:#7F77DD;border-radius:6px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-size:14px;font-weight:700">✓</span>
            </td>
            <td style="padding-left:10px;font-size:16px;font-weight:700;color:#ECEAF8;letter-spacing:-0.4px">CVCheck</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ECEAF8;letter-spacing:-0.5px">Job alerts activated ✓</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#8884AA;line-height:1.6">
            You'll receive weekly job matches for <strong style="color:#ECEAF8">${domain}</strong> roles at the <strong style="color:#ECEAF8">${level}</strong> level.
          </p>
          <table cellpadding="0" cellspacing="0" style="background:rgba(127,119,221,0.08);border:0.5px solid rgba(127,119,221,0.25);border-radius:8px;width:100%">
            <tr><td style="padding:16px 20px">
              <p style="margin:0;font-size:13px;color:#8884AA;line-height:1.65">
                Every week, we'll scan live job boards for roles that match your CV profile and send you the top matches with fit scores.
              </p>
            </td></tr>
          </table>
          <div style="margin-top:24px">
            <a href="${APP_URL}" style="display:inline-block;background:#ECEAF8;color:#08070F;font-size:13px;font-weight:600;padding:10px 22px;border-radius:5px;text-decoration:none;letter-spacing:-0.2px">
              View your analysis →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:0.5px solid rgba(255,255,255,0.07)">
          <p style="margin:0;font-size:11px;color:#4A4870;line-height:1.6">
            You're receiving this because you subscribed to job alerts on CVCheck.<br>
            <a href="${unsubUrl}" style="color:#4A4870;text-decoration:underline">Unsubscribe</a> · ${email}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildJobAlertEmail({ email, domain, level, jobs, unsubscribeToken }: {
  email: string
  domain: string
  level: string
  jobs: Array<{
    title: string; company: string; location: string
    redirect_url: string; fit_score: number; fit_label: string
    strengths: string[]; salary_min?: number; salary_max?: number
  }>
  unsubscribeToken: string
}) {
  const unsubUrl = `${APP_URL}/api/jobs/alert/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
  domain = esc(domain); level = esc(level); email = esc(email)

  const fitColor = (label: string) => ({
    strong: '#16a34a', good: '#65A30D', partial: '#CA8A04', stretch: '#dc2626',
  }[label] ?? '#8884AA')

  const jobCards = jobs.slice(0, 5).map(job => {
    const salary = job.salary_min
      ? `${Math.round(job.salary_min / 1000)}k${job.salary_max ? `–${Math.round(job.salary_max / 1000)}k` : '+'}`
      : ''
    // fit_label drives a CSS color — restrict to the known set so a crafted
    // label can't break out of the style attribute.
    const safeLabel = ['strong', 'good', 'partial', 'stretch'].includes(job.fit_label) ? job.fit_label : 'partial'
    const color = fitColor(safeLabel)
    const strengthsList = job.strengths.map(s =>
      `<tr><td style="padding:2px 0;font-size:12px;color:#8884AA;line-height:1.5"><span style="color:#16a34a;margin-right:6px">✓</span>${esc(s)}</td></tr>`
    ).join('')

    return `
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#0E0D1C;border:0.5px solid rgba(255,255,255,0.07);border-radius:8px;margin-bottom:10px;overflow:hidden">
      <tr><td style="padding:16px 20px">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td>
            <div style="font-size:14px;font-weight:600;color:#ECEAF8;letter-spacing:-0.2px">${esc(job.title)}</div>
            <div style="font-size:12px;color:#8884AA;margin-top:3px">${esc(job.company)} · ${esc(job.location)}${salary ? ` · <strong style="color:#ECEAF8">${esc(salary)}</strong>` : ''}</div>
          </td>
          <td align="right" style="vertical-align:top;white-space:nowrap">
            <span style="font-size:11px;font-weight:700;color:${color};background:${color}20;border:0.5px solid ${color}40;border-radius:3px;padding:2px 8px;letter-spacing:0.04em;text-transform:uppercase">
              ${Math.round(Number(job.fit_score) || 0)}% · ${esc(safeLabel)}
            </span>
          </td>
        </tr></table>
        ${job.strengths.length > 0 ? `<table cellpadding="0" cellspacing="0" style="margin-top:10px;width:100%">${strengthsList}</table>` : ''}
        <div style="margin-top:12px">
          <a href="${escUrl(job.redirect_url)}" style="font-size:12px;font-weight:600;color:#ECEAF8;background:#1E1C34;border:0.5px solid rgba(255,255,255,0.12);border-radius:4px;padding:6px 14px;text-decoration:none">
            View job →
          </a>
        </div>
      </td></tr>
    </table>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#08070F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#08070F;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:24px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;height:28px;background:#7F77DD;border-radius:6px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-size:14px;font-weight:700">✓</span>
            </td>
            <td style="padding-left:10px;font-size:16px;font-weight:700;color:#ECEAF8;letter-spacing:-0.4px">CVCheck</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding-bottom:20px">
          <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ECEAF8;letter-spacing:-0.6px">
            ${jobs.length} new ${domain} jobs this week
          </h1>
          <p style="margin:0;font-size:14px;color:#8884AA">Matched to your ${level} profile · sorted by fit score</p>
        </td></tr>
        <tr><td>${jobCards}</td></tr>
        <tr><td style="padding:20px 0">
          <a href="${APP_URL}" style="display:inline-block;background:#ECEAF8;color:#08070F;font-size:13px;font-weight:600;padding:11px 24px;border-radius:5px;text-decoration:none;letter-spacing:-0.2px">
            Analyze a new CV →
          </a>
        </td></tr>
        <tr><td style="padding-top:16px;border-top:0.5px solid rgba(255,255,255,0.07)">
          <p style="margin:0;font-size:11px;color:#4A4870;line-height:1.6">
            Weekly job alerts from CVCheck · ${email}<br>
            <a href="${unsubUrl}" style="color:#4A4870;text-decoration:underline">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
