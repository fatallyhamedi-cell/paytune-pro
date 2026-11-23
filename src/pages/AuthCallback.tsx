import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, Music } from "lucide-react";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing sign-in and loading your PAYTUNE profile...");

  useEffect(() => {
    let active = true;

    const completeOAuthCallback = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

        const urlError =
          searchParams.get("error_description") ||
          searchParams.get("error") ||
          hashParams.get("error_description") ||
          hashParams.get("error");

        if (urlError) {
          throw new Error(decodeURIComponent(urlError));
        }

        const authType = searchParams.get("type") || hashParams.get("type");
        const code = searchParams.get("code");
        let session = null;

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data?.session || null;
        }

        if (!session) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) throw sessionErr;
          session = sessionData?.session || null;
        }

        if (!session?.access_token) {
          throw new Error("No active authentication session was returned.");
        }

        localStorage.removeItem("artist_token");
        localStorage.removeItem("paytune_artist_token");
        localStorage.removeItem("artist");
        localStorage.removeItem("artist_id");
        localStorage.removeItem("paytune_artist_data");
        localStorage.removeItem("master_token");
        localStorage.removeItem("paytune_master_token");
        localStorage.removeItem("paytune_custom_session");
        queryClient.clear();

        localStorage.setItem("paytune_auth_token", session.access_token);
        api.defaults.headers.common["Authorization"] = `Bearer ${session.access_token}`;

        if (authType === "recovery") {
          window.dispatchEvent(new Event("paytune-auth-changed"));
          if (!active) return;
          setStatus("success");
          setMessage("Verified reset link. Opening password update screen...");
          setTimeout(() => {
            if (active) navigate("/auth?mode=reset-password", { replace: true });
          }, 300);
          return;
        }

        let targetRoute = "/dashboard";
        let resolvedRole = "user";
        try {
          const meRes = await api.get("/api/auth/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          resolvedRole = String(meRes.data?.user?.role || meRes.data?.roleData?.role || "user").toLowerCase();
          if (resolvedRole === "master" || resolvedRole === "master_admin" || resolvedRole === "admin") {
            targetRoute = "/master";
          } else if (resolvedRole === "artist") {
            targetRoute = "/artist/dashboard";
          }
        } catch {
          // Fall back to /dashboard for ordinary Google listeners
        }

        const savedRedirect = sessionStorage.getItem("paytune_oauth_redirect");
        if (savedRedirect) {
          sessionStorage.removeItem("paytune_oauth_redirect");
          const isRestrictedCreatorRoute =
            savedRedirect.startsWith("/artist/dashboard") || savedRedirect.startsWith("/master");
          if (
            savedRedirect.startsWith("/") &&
            !savedRedirect.startsWith("/artist/login") &&
            (!isRestrictedCreatorRoute || resolvedRole === "artist" || resolvedRole === "master" || resolvedRole === "admin")
          ) {
            targetRoute = savedRedirect;
          }
        }

        window.dispatchEvent(new Event("paytune-auth-changed"));

        if (!active) return;
        setStatus("success");
        setMessage("Signed in successfully! Redirecting...");
        setTimeout(() => {
          if (active) navigate(targetRoute, { replace: true });
        }, 400);
      } catch (err: any) {
        if (!active) return;
        setStatus("error");
        setMessage(err?.message || "Unable to complete Google authentication.");
      }
    };

    completeOAuthCallback();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#14141b] border border-white/10 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
        <div className="inline-flex bg-purple-600 p-3 rounded-2xl shadow-lg shadow-purple-600/20">
          <Music className="w-7 h-7 text-white" />
        </div>

        {status === "loading" && (
          <>
            <div className="flex items-center justify-center gap-2 text-purple-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-bold uppercase tracking-wider">Verifying Session</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <span className="text-sm font-bold uppercase tracking-wider">Authentication Complete</span>
            </div>
            <p className="text-xs text-gray-400">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex items-center justify-center gap-2 text-rose-400">
              <AlertCircle className="w-6 h-6" />
              <span className="text-sm font-bold uppercase tracking-wider">Sign-In Failed</span>
            </div>
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
              {message}
            </p>
            <div className="pt-2">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider transition"
              >
                Return to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
