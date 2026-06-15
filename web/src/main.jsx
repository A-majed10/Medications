import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Loader2 } from "lucide-react";
import Auth from "./Auth.jsx";
import OsceApp from "./OsceApp.jsx";
import { api, getToken, setToken } from "./api.js";
import "./index.css";

function Root() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on load if a token is present.
  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  function signOut() { setToken(null); setUser(null); }

  if (loading) {
    return (
      <div className="ui-root flex min-h-screen items-center justify-center bg-stone-100">
        <Loader2 className="h-7 w-7 animate-spin text-[#15564b]" />
      </div>
    );
  }
  if (!user) return <Auth onAuthed={setUser} />;
  return <OsceApp user={user} onUser={setUser} onSignOut={signOut} />;
}

createRoot(document.getElementById("root")).render(<Root />);
