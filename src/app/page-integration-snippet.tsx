// ─── În page.tsx — adaugă în header ───────────────────────────────────────

// 1. Import-uri noi
import AccountButton from "@/components/AccountButton";
import AuthModal from "@/components/AuthModal";  // înlocuiește vechiul import

// 2. State necesar (adaugă lângă restul de useState)
const [user, setUser] = useState<User | null>(null);
const [userTier, setUserTier] = useState<"free" | "pro" | "premium">("free");
const [showAuth, setShowAuth] = useState(false);

// 3. Fetch user la mount (dacă nu ai deja)
useEffect(() => {
  const supabase = createSupabaseBrowser();

  supabase.auth.getUser().then(({ data }) => {
    setUser(data.user ?? null);
  });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });

  return () => listener.subscription.unsubscribe();
}, []);

// 4. Fetch tier din Supabase când userul e autentificat
useEffect(() => {
  if (!user) return;
  const supabase = createSupabaseBrowser();
  supabase
    .from("credits")
    .select("tier")
    .eq("user_id", user.id)
    .single()
    .then(({ data }) => {
      if (data?.tier) setUserTier(data.tier);
    });
}, [user]);

// 5. În JSX — header:
// Înlocuiește orice buton de cont/auth existent cu:

<header className="app-header">
  {/* Logo / titlu existent */}
  <div className="header-logo">Roastd</div>

  {/* Dreapta */}
  <div className="header-right">
    {user ? (
      <AccountButton
        user={user}
        tier={userTier}
        onSignOut={() => {
          setUser(null);
          setUserTier("free");
        }}
      />
    ) : (
      <button className="sign-in-btn" onClick={() => setShowAuth(true)}>
        Sign in
      </button>
    )}
  </div>

  {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
</header>