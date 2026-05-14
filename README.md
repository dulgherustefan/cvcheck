# Roastd 🔥

> Brutally honest AI feedback on your portfolio, resume, or landing page. Scored out of 100, in under 60 seconds.

---

## Setup rapid (15 minute)

### 1. Instalează dependențele

```bash
cd roastd
npm install
```

### 2. Configurează variabilele de mediu

```bash
cp .env.example .env.local
```

Deschide `.env.local` și completează:

- **ANTHROPIC_API_KEY** → [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
- Restul (Supabase, Stripe) le adăugăm în faze viitoare — pentru MVP au valori placeholder

### 3. Instalează Playwright (pentru scraper)

```bash
npx playwright install chromium
```

### 4. Pornește serverul de development

```bash
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000) 🎉

---

## Structura proiectului

```
roastd/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Landing page + UI rezultate
│   │   ├── layout.tsx            ← Root layout (metadata, fonts)
│   │   └── api/
│   │       └── roast/
│   │           └── route.ts      ← POST /api/roast (endpoint principal)
│   └── lib/
│       ├── types.ts              ← Tipuri TypeScript (structura datelor)
│       ├── prompt.ts             ← SYSTEM PROMPT — inima produsului
│       ├── scraper.ts            ← Playwright scraper
│       └── claude.ts             ← Claude API call + parsing JSON
├── prompts/
│   └── system-prompt.md          ← Documentație prompt + log iterații
├── .env.example                  ← Template variabile de mediu
└── package.json
```

---

## Cum funcționează (flow complet)

```
User introduce URL
       ↓
POST /api/roast
       ↓
scraper.ts → Playwright deschide pagina, extrage text
       ↓
claude.ts → trimite text la Claude Haiku cu system prompt
       ↓
Claude returnează JSON cu scor + roast
       ↓
page.tsx afișează rezultatul + buton share
```

---

## Faze de implementare

- [x] **Faza 1** — Prompt engineering + scaffold
- [ ] **Faza 2** — Supabase (auth + credite + salvare roast-uri)
- [ ] **Faza 3** — Stripe ($4.99/lună)
- [ ] **Faza 4** — OG image dinamic pentru share
- [ ] **Faza 5** — Public gallery + SEO

---

## Cum să îmbunătățești prompt-ul

1. Fă un roast pe un site real
2. Dacă feedback-ul e generic sau fals → deschide `src/lib/prompt.ts`
3. Modifică rubrica sau regulile de ton
4. Incrementează versiunea în `prompts/system-prompt.md`
5. Testează din nou

**Regulă:** Nu deploia o nouă versiune de prompt fără să testezi minim 5 site-uri.
# Roastd
