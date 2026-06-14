"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent, type Variants } from 'framer-motion';
import { RotatingText } from '@/components/RotatingText';
import { HeroDotGrid } from '@/components/HeroDotGrid';

const ChevronDownIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="dd-chevron">
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
  </svg>
);

const MenuIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

interface NavLinkProps {
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const NavLink: React.FC<NavLinkProps> = ({ href = '#', children, onClick }) => (
  <a href={href} onClick={onClick} className="nav-link">
    {children}
  </a>
);

const mobileMenuVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.15, ease: 'easeIn' } },
};

const contentDelay = 0.3;
const itemDelayIncrement = 0.1;

const bannerVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: contentDelay } },
};
const headlineVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, delay: contentDelay + itemDelayIncrement } },
};
const subHeadlineVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: contentDelay + itemDelayIncrement * 2 } },
};
const formVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: contentDelay + itemDelayIncrement * 3 } },
};
const metaVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, delay: contentDelay + itemDelayIncrement * 4 } },
};
const worksWithVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, delay: contentDelay + itemDelayIncrement * 5 } },
};
const imageVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.6, delay: contentDelay + itemDelayIncrement * 6, ease: [0.16, 1, 0.3, 1] },
  },
};

interface InteractiveHeroProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

const InteractiveHero: React.FC<InteractiveHeroProps> = ({ onOpenAuth }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [inputMode, setInputMode] = useState<'url' | 'pdf'>('url');

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest) => {
    setIsScrolled(latest > 10);
  });

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  return (
    <section className="hero">
      <HeroDotGrid />
      <div className="hero-fade" aria-hidden="true" />

      <header className={isScrolled ? 'navbar navbar-scrolled' : 'navbar'}>
        <nav className="navbar-inner">
          <div className="navbar-logo">
            <img src="/logo.png" width={32} height={32} alt="CVCheck" />
            <span>CVCheck</span>
          </div>

          <div className="navbar-links">
            <NavLink href="#analysis">CV Analysis</NavLink>
            <NavLink href="#jobs">Job Matching</NavLink>
            <NavLink href="#alerts">Job Alerts</NavLink>
            <NavLink href="#pricing">Pricing</NavLink>
            <NavLink href="/faq">FAQ</NavLink>
          </div>

          <div className="navbar-actions">
            <button className="btn-outline nav-btn-login" onClick={() => onOpenAuth('login')}>
              Log in
            </button>
            <button className="btn-primary nav-btn-accent shimmerBtn" onClick={() => onOpenAuth('signup')}>
              Sign up
            </button>
            <button
              className="navbar-mobile-toggle"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              variants={mobileMenuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="navbar-mobile-menu"
            >
              <NavLink href="#analysis" onClick={() => setIsMobileMenuOpen(false)}>CV Analysis</NavLink>
              <NavLink href="#jobs" onClick={() => setIsMobileMenuOpen(false)}>Job Matching</NavLink>
              <NavLink href="#alerts" onClick={() => setIsMobileMenuOpen(false)}>Job Alerts</NavLink>
              <NavLink href="#pricing" onClick={() => setIsMobileMenuOpen(false)}>Pricing</NavLink>
              <NavLink href="/faq" onClick={() => setIsMobileMenuOpen(false)}>FAQ</NavLink>
              <hr className="navbar-mobile-divider" />
              <NavLink href="#" onClick={() => { setIsMobileMenuOpen(false); onOpenAuth('login'); }}>Log in</NavLink>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="hero-centered-wrap">
        <motion.div variants={bannerVariants} initial="hidden" animate="visible" className="hero-kicker">
          <span className="hero-kicker-dot" />
          AI-powered CV analysis
        </motion.div>

        <motion.h1 variants={headlineVariants} initial="hidden" animate="visible" className="hero-h1">
          Your CV, analyzed.
          <span className="hero-h1-accent">
            <RotatingText
              texts={['Instantly.', 'Honestly.', 'Actionably.', 'For free.']}
              staggerFrom="last"
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '110%', opacity: 0 }}
              staggerDuration={0.01}
              transition={{ type: 'spring', damping: 18, stiffness: 250 }}
              rotationInterval={2200}
              splitBy="characters"
              auto
              loop
            />
          </span>
        </motion.h1>

        <motion.p variants={subHeadlineVariants} initial="hidden" animate="visible" className="hero-p">
          Drop your CV or paste a link. Get a real score, a detailed diagnostic
          and rewritten bullets that actually move the needle.
        </motion.p>

        <motion.form
          variants={formVariants}
          initial="hidden"
          animate="visible"
          className="hero-cta-row"
          onSubmit={(e) => e.preventDefault()}
        >
          {inputMode === 'url' ? (
            <input
              type="url"
              placeholder="Paste your LinkedIn, portfolio or CV URL"
              required
              aria-label="CV or portfolio URL"
              className="hero-input"
            />
          ) : (
            <label htmlFor="hero-file" className="hero-input hero-input-file">
              <span>Click to upload your CV (PDF)</span>
              <input id="hero-file" type="file" accept="application/pdf" className="hero-input-file-hidden" />
            </label>
          )}
          <button type="submit" className="hero-cta-btn shimmerBtn">
            Analyze my CV
          </button>
        </motion.form>

        <motion.div variants={metaVariants} initial="hidden" animate="visible" className="hero-cta-meta">
          <div className="hero-cta-toggle">
            <button
              type="button"
              className={inputMode === 'url' ? 'hero-toggle-btn hero-toggle-active' : 'hero-toggle-btn'}
              onClick={() => setInputMode('url')}
            >
              URL
            </button>
            <button
              type="button"
              className={inputMode === 'pdf' ? 'hero-toggle-btn hero-toggle-active' : 'hero-toggle-btn'}
              onClick={() => setInputMode('pdf')}
            >
              PDF
            </button>
          </div>
          <span className="hero-cta-meta-text">1 free scan · no account required</span>
        </motion.div>

        <motion.div variants={worksWithVariants} initial="hidden" animate="visible" className="hero-works-with">
          <span className="hero-works-label">Analyzes</span>
          <span className="hero-works-item">LinkedIn</span>
          <span className="hero-works-item">PDF CVs</span>
          <span className="hero-works-item">Portfolio sites</span>
          <span className="hero-works-item">GitHub profiles</span>
          <span className="hero-works-item">Notion pages</span>
        </motion.div>

        <motion.div variants={imageVariants} initial="hidden" animate="visible" className="hero-mockup-wrap">
          <img
            src="https://placehold.co/1200x720/111113/9896A8?text=CVCheck+Analysis+Preview"
            alt="CVCheck analysis preview"
            width={1200}
            height={720}
            className="hero-mockup-img"
            loading="lazy"
          />
        </motion.div>
      </main>
    </section>
  );
};

export default InteractiveHero;
