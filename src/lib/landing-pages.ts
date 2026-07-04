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
    related: ['rate-my-resume', 'resume-review', 'cv-checker'],
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
    related: ['ats-resume-checker', 'resume-review', 'resume-job-match'],
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
    related: ['rate-my-resume', 'ats-resume-checker', 'cover-letter-generator'],
  },
  {
    slug: 'cv-checker',
    title: 'Free CV Checker',
    metaDescription:
      'Check your CV instantly and see the score, red flags, and ATS compatibility recruiters actually check. Free, no signup, results in seconds.',
    eyebrow: 'CV Checker',
    h1: 'Free CV checker',
    lead: 'Upload your CV, paste a portfolio link, or drop a GitHub profile, and get an honest score out of 100 in seconds. See what is working, what is not, and what to fix first, before you send it anywhere.',
    ctaLabel: 'Check my CV free',
    bulletsLabel: 'What you get for free',
    bullets: [
      { title: 'Score out of 100', desc: 'A single number plus the seven-part breakdown behind it.' },
      { title: 'ATS compatibility check', desc: 'Whether your CV parses cleanly through the software that screens it first.' },
      { title: 'Red flags, ranked', desc: 'Dealbreakers and warnings, so you know what to fix first.' },
      { title: 'Works with PDF or a link', desc: 'Upload a CV file, or paste a portfolio or GitHub URL instead.' },
    ],
    sections: [
      {
        h2: 'What a CV checker actually checks',
        body: [
          'A CV checker should do more than spot typos. CVCheck reads your CV the way a recruiter and an applicant tracking system both do: whether your title is searchable, whether your achievements are quantified, and whether anything in your work history raises a flag before anyone gets to your skills.',
          'The result is a score out of 100 built from seven weighted parts, so a low score always comes with a reason attached instead of one unexplained number.',
        ],
      },
      {
        h2: 'Free score, paid fixes',
        body: [
          'The score, the breakdown, and every red flag are free with no account. You will know exactly where your CV stands before deciding whether to fix anything.',
          'If you want the fixes done for you, the one-time €1.99 report rewrites your weakest bullet points, lists the keywords your field expects, and writes a cover letter based on your actual experience.',
        ],
      },
    ],
    faq: [
      { q: 'Is this the same as a resume checker?', a: '"CV" and "resume" mean the same thing here. Both PDF uploads and profile links work either way.' },
      { q: 'What formats can I check?', a: 'A PDF CV, a portfolio site URL, or a GitHub profile URL.' },
      { q: 'Do I need an account?', a: 'No. The score, breakdown, and red flags are free with no signup.' },
      { q: 'How is the score calculated?', a: 'Seven weighted parts: first impression, impact and achievements, ATS compatibility, red flags, career story, format, and credibility.' },
    ],
    related: ['rate-my-resume', 'ats-resume-checker', 'resume-job-match'],
  },
  {
    slug: 'resume-job-match',
    title: 'Resume Job Match Checker',
    metaDescription:
      'Paste a job description and see how well your resume matches it, plus the exact keywords you are missing for that specific role. Free, no signup.',
    eyebrow: 'Job Match Checker',
    h1: 'Match your resume to a job',
    lead: 'Generic resume advice tells you to "tailor it more." This tells you exactly what to change: paste the job description and see your match score against that specific role, plus the keywords it is looking for that your resume does not have yet.',
    ctaLabel: 'Check my match free',
    bulletsLabel: 'What the match check shows',
    bullets: [
      { title: 'Match score for that job', desc: 'Not a generic score. How your resume specifically lines up with the role you pasted.' },
      { title: 'Missing keywords', desc: 'The exact terms the job description uses that your resume does not.' },
      { title: 'Fit verdict', desc: 'Strong fit, possible fit, or weak fit, so you know if it is worth applying before you spend the time.' },
      { title: 'Works alongside your full score', desc: 'You still get the overall CV score and red flags in the same free check.' },
    ],
    sections: [
      {
        h2: '"Tailor your resume" is not specific enough',
        body: [
          'Most advice stops at "customize your resume for each job" without saying what to actually change. Pasting the job description alongside your resume turns that into a specific, checkable list: which keywords from the posting are missing, and how close your experience is to what they are asking for.',
          'This matters most when you are close to qualified but not an obvious match on paper, which is exactly the resume that gets filtered out by keyword-based screening before a person reads it.',
        ],
      },
      {
        h2: 'One CV, many jobs',
        body: [
          'You do not need a different resume for every application. Running the same CV against a few job descriptions shows which keywords are consistently missing across postings in that field, usually a faster fix than rewriting the whole document.',
          'The match score and missing keywords are free every time you check. The full report also rewrites the specific bullet points that would raise your match.',
        ],
      },
    ],
    faq: [
      { q: 'Do I need a job description to use this?', a: 'No, you can get your general CV score without one. Adding a job description unlocks the match score and keyword comparison against that specific role.' },
      { q: 'Is the match check free?', a: 'Yes, the match score, fit verdict, and your overall CV score are free with no signup.' },
      { q: 'Can I check the same resume against multiple jobs?', a: 'Yes, run a new check for each job description you want to compare against.' },
      { q: 'What counts as a strong match?', a: 'It depends on the role, but the fit verdict (strong, possible, or weak) gives you a quick read before you spend time on missing keywords.' },
    ],
    related: ['ats-resume-checker', 'rate-my-resume', 'cv-checker'],
  },
  {
    slug: 'cover-letter-generator',
    title: 'AI Cover Letter Generator',
    metaDescription:
      'Generate a cover letter based on your actual resume and a specific job description, not a generic template. Starts with a free CV score.',
    eyebrow: 'Cover Letter Generator',
    h1: 'AI cover letter generator',
    lead: 'A cover letter template with your name swapped in reads like a template. This writes one from your actual resume and the job description you are applying to, so it references real experience instead of generic filler.',
    ctaLabel: 'Get my free CV score',
    bulletsLabel: 'How it works',
    bullets: [
      { title: 'Start with your CV score', desc: 'Upload your resume or paste a link, free, no signup, to see your score first.' },
      { title: 'Add the job description', desc: 'Paste the posting you are applying to so the letter can reference it directly.' },
      { title: 'Get a letter from your real experience', desc: 'Not a generic template. It pulls from your actual bullet points and history.' },
      { title: 'Included in the full report', desc: 'One-time €1.99, alongside your rewritten bullets and ATS keyword list.' },
    ],
    sections: [
      {
        h2: 'Why generic cover letter templates fall flat',
        body: [
          'A cover letter generator that only knows your name and the job title produces the same three paragraphs everyone else gets: "I am excited to apply," "I believe I would be a great fit," and nothing specific underneath. Recruiters read hundreds of these.',
          'CVCheck writes the letter after reading your actual resume and the job description you pasted, so it references specific experience and specific requirements instead of filling in a template.',
        ],
      },
      {
        h2: 'Part of the full report, not a separate tool',
        body: [
          'The cover letter is not a standalone product. It comes with the same one-time €1.99 report that rewrites your bullets and lists your missing ATS keywords, so you get the full picture of your application in one pass instead of three different tools.',
          'The free score, red flags, and ATS verdict still apply with no account needed. The cover letter is one part of what unlocks with the paid report.',
        ],
      },
    ],
    faq: [
      { q: 'Is the cover letter generator free?', a: 'The CV score is free. The cover letter is part of the one-time €1.99 full report, alongside bullet rewrites and ATS keywords.' },
      { q: 'Does it need a job description?', a: 'Yes, paste the job posting so the letter can reference the specific role instead of writing something generic.' },
      { q: 'Does it use my real experience?', a: 'Yes, it is generated from your actual resume content, not a fill-in-the-blank template.' },
      { q: 'Can I edit the letter after?', a: 'Yes, it is a starting draft based on your real experience, meant to be edited to sound like you.' },
    ],
    related: ['resume-job-match', 'ats-resume-checker', 'cv-checker'],
  },
]

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug)
}
