// SEO landing pages — one per high-intent keyword cluster. Each maps to a real,
// mostly-free product capability so the copy stays truthful (no doorway pages).
// Rendered by src/app/[slug]/page.tsx and listed in the sitemap.

export interface LandingBullet {
  title: string
  desc: string
}

export interface LandingSection {
  h2: string
  body: string[]
}

export interface LandingFaq {
  q: string
  a: string
}

export interface LandingPage {
  slug: string
  /** Title before the "· CVCheck" template suffix. */
  title: string
  metaDescription: string
  eyebrow: string
  h1: string
  lead: string
  ctaLabel: string
  bulletsLabel: string
  bullets: LandingBullet[]
  sections: LandingSection[]
  faq: LandingFaq[]
  related: string[]
}

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: 'ats-resume-checker',
    title: 'Free ATS Resume Checker',
    metaDescription:
      'Check whether your resume passes the ATS. Get a free ATS compatibility score, see the formatting that trips up applicant tracking systems, and find the keywords you are missing. No signup.',
    eyebrow: 'ATS Resume Checker',
    h1: 'Free ATS resume checker',
    lead: 'Most resumes are read by an applicant tracking system before a human ever sees them. Paste your resume and get an instant ATS compatibility score, plus the formatting and keyword issues that quietly get applications filtered out.',
    ctaLabel: 'Check my resume free',
    bulletsLabel: 'Free on every check',
    bullets: [
      { title: 'ATS compatibility verdict', desc: 'Friendly, minor issues, or problems detected, with the reasons behind it.' },
      { title: 'Score out of 100', desc: 'ATS compatibility is 20 of the 100 points, scored alongside six other dimensions.' },
      { title: 'Red flags, ranked', desc: 'Dealbreakers, warnings, and minor issues that break parsing or hurt your chances.' },
      { title: 'No account needed', desc: 'One free scan, no signup, and your resume is never used to train AI.' },
    ],
    sections: [
      {
        h2: 'What an ATS actually checks',
        body: [
          'An applicant tracking system parses your resume into plain text and fields before anyone reads it. If it cannot cleanly find your job titles, dates, and skills, your application can get ranked down or filtered out, no matter how strong the experience behind it is.',
          'The usual culprits are multi-column layouts, tables, text inside images, non-standard section headings, and a job title the recruiter would never search for. CVCheck reads your resume the way a parser would and flags the parts that do not survive the trip.',
        ],
      },
      {
        h2: 'How the ATS score is calculated',
        body: [
          'ATS compatibility is one of seven scored dimensions and is worth 20 of the 100 total points. We check whether your title is searchable, whether each section parses cleanly, and which role-specific keywords are present or missing for your field.',
          'You get the verdict and the score for free. Upgrading to the full report (a one-time €1.99) lists the specific keywords your field expects but your resume is missing, and shows how to fix each red flag on your actual text.',
        ],
      },
    ],
    faq: [
      { q: 'What is an ATS?', a: 'An applicant tracking system is the software employers use to collect and filter applications. It parses your resume into text and fields, then ranks or screens candidates before a recruiter reviews them.' },
      { q: 'Is the ATS checker really free?', a: 'Yes. The ATS verdict, your score out of 100, and your red flags are free with no account. The full report with missing keywords and fixes is a one-time €1.99.' },
      { q: 'What can I upload?', a: 'A PDF resume, a portfolio site URL, or a GitHub profile URL. CVCheck reads whichever you give it.' },
      { q: 'Will it show the exact keywords I am missing?', a: 'The free check tells you whether keyword coverage is a problem. The full report lists the specific missing keywords for your field so you can add the ones that matter.' },
    ],
    related: ['rate-my-resume', 'resume-review'],
  },
  {
    slug: 'rate-my-resume',
    title: 'Rate My Resume: Free AI Resume Score',
    metaDescription:
      'Get an honest score for your resume out of 100, graded across the seven dimensions recruiters and ATS systems actually judge. Free, no signup, results in seconds.',
    eyebrow: 'Rate My Resume',
    h1: 'Rate my resume',
    lead: 'Stop guessing whether your resume is good enough. Get a brutally honest score out of 100, broken down across the seven things recruiters and applicant tracking systems actually judge.',
    ctaLabel: 'Score my resume free',
    bulletsLabel: 'What your score includes',
    bullets: [
      { title: 'One number out of 100', desc: 'A single, honest score you can track as you improve.' },
      { title: 'Seven-dimension breakdown', desc: 'See exactly which part of your resume is dragging the score down.' },
      { title: 'First impression readout', desc: 'What a recruiter concludes about your level in the first seven seconds.' },
      { title: 'Red flags with severity', desc: 'The dealbreakers and warnings pulling your score down, ranked.' },
    ],
    sections: [
      {
        h2: 'The seven things we score',
        body: [
          'Your score is the sum of seven weighted dimensions, so the breakdown tells you where to spend your effort: first impression (15), impact and achievements (25), ATS compatibility (20), red flags (20), career story (10), format (5), and credibility (5).',
          'Impact and red flags carry the most weight because they are what actually decide interviews. Quantified results and the absence of dealbreakers move the needle far more than a clean font.',
        ],
      },
      {
        h2: 'From a score to a plan',
        body: [
          'A single number turns vague anxiety into a concrete target, and the per-dimension breakdown shows which section to fix first instead of rewriting everything at once.',
          'The score, breakdown, and red flags are free. The full report (a one-time €1.99) rewrites your weakest bullet points on your real text and gives you the top three priority actions with examples.',
        ],
      },
    ],
    faq: [
      { q: 'How is the score calculated?', a: 'It is the sum of seven weighted dimensions totalling 100 points: first impression, impact and achievements, ATS compatibility, red flags, career story, format, and credibility.' },
      { q: 'How honest is the rating?', a: 'It is tuned to be blunt rather than flattering. The scoring reflects what recruiters and ATS systems check, so the feedback is closer to a hiring manager than a friend being polite.' },
      { q: 'Is rating my resume free?', a: 'Yes. The score and full breakdown are free with no signup. Bullet rewrites and priority fixes are in the one-time €1.99 report.' },
      { q: 'What counts as a good score?', a: 'Most first drafts land in the 50s and 60s. Anything in the 80s is genuinely strong. The breakdown matters more than the number: a low dimension is your fastest win.' },
    ],
    related: ['ats-resume-checker', 'resume-review'],
  },
  {
    slug: 'resume-review',
    title: 'Free Resume Review: Instant AI Feedback',
    metaDescription:
      'Get an instant, honest resume review: what a recruiter notices in seven seconds, your red flags, and exactly what is costing you interviews. Free AI feedback, no signup.',
    eyebrow: 'Resume Review',
    h1: 'Free resume review',
    lead: 'A recruiter spends about seven seconds on your resume before deciding. Get that first impression in writing, plus the red flags, weak bullets, and quick wins that decide whether you get the interview.',
    ctaLabel: 'Review my resume free',
    bulletsLabel: 'In your free review',
    bullets: [
      { title: 'Seven-second first impression', desc: 'The role, level, and seniority your resume signals at a glance.' },
      { title: 'Red flags, ranked by severity', desc: 'Dealbreakers, warnings, and minor issues, each spelled out.' },
      { title: 'A quick win', desc: 'The single highest-impact change you can make right now.' },
      { title: 'Score out of 100', desc: 'An overall grade so you can see progress as you edit.' },
    ],
    sections: [
      {
        h2: 'See your resume the way a recruiter does',
        body: [
          "The review opens with the recruiter's first impression: what job and seniority level your resume communicates in the first few seconds, and whether that matches the roles you are targeting.",
          'This is the gap that sinks most applications: a strong candidate whose resume reads a level junior, or in the wrong function entirely. Seeing it written down is usually the fastest fix on the page.',
        ],
      },
      {
        h2: 'Every red flag, and what to do first',
        body: [
          'Red flags are grouped by severity, from dealbreakers a recruiter will reject on to minor polish issues, so you know what is urgent and what can wait.',
          'The first impression, red flags, and overall score are free. The full report (a one-time €1.99) rewrites your actual bullet points and lays out the top three actions to fix first, with concrete examples.',
        ],
      },
    ],
    faq: [
      { q: 'How is this different from asking a friend?', a: 'It is instant, objective, and based on the patterns recruiters and ATS systems actually use, rather than a polite opinion. You get specifics: the exact red flags and the first impression in writing.' },
      { q: 'Do I need to create an account?', a: 'No. You can review a resume for free with no signup, and your resume is never used to train AI.' },
      { q: 'How long does the review take?', a: 'About thirty seconds. Paste a link or upload a PDF and the analysis comes back right away.' },
      { q: 'Can I review a URL instead of uploading a file?', a: 'Yes. You can paste a portfolio site or a GitHub profile URL, or upload a PDF resume.' },
    ],
    related: ['rate-my-resume', 'ats-resume-checker'],
  },
]

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug)
}
