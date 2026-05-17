"use client";

import { useState, useRef, useEffect } from "react";
import { createSupabaseBrowser } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import UpgradeModal from "./UpgradeModal";
import AccountModal from "./AccountModal";

interface AccountButtonProps {
  user: User;
  tier: "free" | "pro" | "premium";
  onSignOut?: () => void;
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "var(--tier-free)" },
  pro: { label: "Pro", color: "var(--tier-pro)" },
  premium: { label: "Premium", color: "var(--tier-premium)" },
};

export default function AccountButton({ user, tier, onSignOut }: AccountButtonProps) {
  const [open, setOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseBrowser();

  const email = user.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();
  const tierInfo = TIER_LABELS[tier] ?? TIER_LABELS.free;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setOpen(false);
    onSignOut?.();
  }

  return (
    <>
      <div className="account-btn-wrapper" ref={dropdownRef}>
        <button
          className="account-btn"
          onClick={() => setOpen((v) => !v)}
          aria-label="Account menu"
        >
          <span className="account-avatar">{initials}</span>
          <span className="account-email-short">{email.split("@")[0]}</span>
          <span className="account-tier-badge" style={{ background: tierInfo.color }}>
            {tierInfo.label}
          </span>
          <svg
            className={`account-chevron ${open ? "open" : ""}`}
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div className="account-dropdown">
            {/* Header */}
            <div className="dropdown-header">
              <span className="dropdown-avatar">{initials}</span>
              <div className="dropdown-userinfo">
                <span className="dropdown-email">{email}</span>
                <span className="dropdown-plan" style={{ color: tierInfo.color }}>
                  Plan: <strong>{tierInfo.label}</strong>
                </span>
              </div>
            </div>

            <div className="dropdown-divider" />

            {/* Upgrade CTA — only if not premium */}
            {tier !== "premium" && (
              <button
                className="dropdown-item dropdown-upgrade"
                onClick={() => { setShowUpgrade(true); setOpen(false); }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5 6.5 5z" fill="currentColor" />
                </svg>
                {tier === "free" ? "Upgrade to Pro or Premium" : "Upgrade to Premium"}
              </button>
            )}
            {tier === "premium" && (
              <div className="dropdown-item dropdown-premium-badge">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5 6.5 5z" fill="currentColor" />
                </svg>
                Premium — toate funcțiile active
              </div>
            )}

            <div className="dropdown-divider" />

            {/* Account settings */}
            <button
              className="dropdown-item"
              onClick={() => { setShowAccount(true); setOpen(false); }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 13c0-2.2 2.7-4 6-4s6 1.8 6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Contul meu
            </button>

            <button
              className="dropdown-item"
              onClick={() => { setShowAccount(true); setOpen(false); }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Schimbă parola
            </button>

            <div className="dropdown-divider" />

            <button
              className="dropdown-item dropdown-signout"
              onClick={handleSignOut}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} user={user} />}
      {showAccount && (
        <AccountModal
          user={user}
          tier={tier}
          onClose={() => setShowAccount(false)}
          onUpgrade={() => { setShowAccount(false); setShowUpgrade(true); }}
        />
      )}

      <style jsx>{`
        .account-btn-wrapper {
          position: relative;
        }

        .account-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px 6px 6px;
          background: var(--surface-2, rgba(255,255,255,0.06));
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 100px;
          cursor: pointer;
          color: var(--text-primary, #fff);
          font-size: 13px;
          transition: background 0.15s, border-color 0.15s;
        }
        .account-btn:hover {
          background: var(--surface-3, rgba(255,255,255,0.1));
          border-color: var(--border-hover, rgba(255,255,255,0.2));
        }

        .account-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--accent, #ff4d4d);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }

        .account-email-short {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }

        .account-tier-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 100px;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .account-chevron {
          transition: transform 0.2s;
          opacity: 0.6;
        }
        .account-chevron.open {
          transform: rotate(180deg);
        }

        /* Dropdown */
        .account-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 260px;
          background: var(--dropdown-bg, #1a1a1a);
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          z-index: 1000;
          animation: dropIn 0.15s ease;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .dropdown-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
        }
        .dropdown-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--accent, #ff4d4d);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }
        .dropdown-userinfo {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .dropdown-email {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dropdown-plan {
          font-size: 12px;
          color: var(--text-secondary, rgba(255,255,255,0.5));
        }

        .dropdown-divider {
          height: 1px;
          background: var(--border, rgba(255,255,255,0.08));
          margin: 0;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 11px 16px;
          background: transparent;
          border: none;
          color: var(--text-secondary, rgba(255,255,255,0.7));
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s, color 0.12s;
        }
        .dropdown-item:hover {
          background: var(--surface-2, rgba(255,255,255,0.06));
          color: var(--text-primary, #fff);
        }

        .dropdown-upgrade {
          color: var(--tier-pro, #f59e0b) !important;
          font-weight: 600;
        }
        .dropdown-upgrade:hover {
          background: rgba(245,158,11,0.08) !important;
        }

        .dropdown-premium-badge {
          color: var(--tier-premium, #a855f7) !important;
          font-weight: 600;
          cursor: default;
        }
        .dropdown-premium-badge:hover {
          background: transparent !important;
        }

        .dropdown-signout {
          color: var(--text-danger, rgba(255,80,80,0.8)) !important;
        }
        .dropdown-signout:hover {
          background: rgba(255,80,80,0.08) !important;
          color: #ff5050 !important;
        }
      `}</style>
    </>
  );
}
