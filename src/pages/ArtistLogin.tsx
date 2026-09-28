import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { 
  Music, 
  Mail, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  Globe2, 
  PhoneCall, 
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ArtistLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInArtist } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [geoInfo, setGeoInfo] = useState<{ country_code: string; currency_code: string; country_name: string } | null>(null);

  // Fetch detected country from request IP
  useEffect(() => {
    api.get("/api/artist/geo/detect")
      .then((res) => {
        if (res.data?.success) {
          setGeoInfo({
            country_code: res.data.country_code || "RW",
            currency_code: res.data.currency_code || "RWF",
            country_name: res.data.country_name || "Rwanda"
          });
        }
      })
      .catch(() => {
        setGeoInfo({ country_code: "RW", currency_code: "RWF", country_name: "Rwanda" });
      });
  }, []);

  const handleFillDemoArtist = (type: 'unverified' | 'verified') => {
    if (type === 'unverified') {
      setEmail("unverified.artist@paytune.com");
      setPassword("Paytune2026!");
    } else {
      setEmail("artist@paytune.com");
      setPassword("Paytune2026!");
    }
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setWarning("");

    if (!email.trim() || !password) {
      setError("Please enter both your artist email and password.");
      return;
    }

    setLoading(true);

    try {
      if (signInArtist) {
        const res = await signInArtist(email.trim(), password);
        if (!res.success) {
          setError(res.error || "Failed to log in to Creator Studio.");
          return;
        }

        // If phone is not verified, redirect to phone verification screen
        if (res.phone_verified === false || res.redirectTo === '/artist/verify-phone') {
          setWarning("Phone confirmation required. Redirecting to SMS verification...");
          setTimeout(() => {
            navigate("/artist/verify-phone", { 
              state: { 
                artistId: res.artist?.id,
                email: email.trim(),
                phone: res.artist?.phone
              }
            });
          }, 600);
          return;
        }

        // Verified artist: proceed to Artist Dashboard
        navigate("/artist/dashboard");
      } else {
        // Direct API call
        const res = await api.post("/api/artist/login", { email: email.trim(), password });
        if (res.data?.success) {
          if (!res.data.phone_verified) {
            navigate("/artist/verify-phone", {
              state: {
                artistId: res.data.artistId,
                email: email.trim(),
                phone: res.data.phone
              }
            });
          } else {
            navigate("/artist/dashboard");
          }
        } else {
          setError(res.data?.message || "Login failed.");
        }
      }
    } catch (err: any) {
      const respData = err?.response?.data;
      if (respData?.error === "google_auth_forbidden_for_artists") {
        setError("Google Sign-In is not permitted for artist accounts. Please use email and password.");
      } else if (respData?.error === "account_blocked") {
        setError("Your artist account has been suspended. Please contact PAYTUNE support.");
      } else if (respData?.error === "pending_approval") {
        setError("Your artist application is pending approval by PAYTUNE administrators.");
      } else {
        setError(respData?.message || err?.message || "Invalid artist email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-center items-center p-4 py-16 relative selection:bg-amber-500 selection:text-black">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 blur-[130px] pointer-events-none rounded-full" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500 text-black font-black mb-5 shadow-xl shadow-amber-500/20 hover:scale-105 transition-transform">
            <Music className="w-7 h-7 fill-black" />
          </Link>
          <h1 className="text-3xl font-black tracking-tight mb-2 italic">Creator Studio Login</h1>
          <p className="text-gray-400 text-sm">
            Access your PAYTUNE channel analytics, pay-per-view videos, and MoMo payouts.
          </p>

          {/* Geo Detection Badge */}
          {geoInfo && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
              <Globe2 className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Detected Region: <strong className="text-white">{geoInfo.country_name}</strong> ({geoInfo.currency_code})
              </span>
            </div>
          )}
        </div>

        {/* Notice: No Google OAuth for artists */}
        <div className="mb-6 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">Artist Security Policy:</span> Google Sign-In is restricted to viewers and fans. Artists authenticate exclusively via <strong>Email & Password</strong> with SMS OTP verification for payout security.
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-[#141414] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {warning && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-start gap-2.5">
              <PhoneCall className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <span>{warning}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Artist Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="email"
                  placeholder="artist@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/50 border-white/10 h-12 pl-12 rounded-xl text-white placeholder:text-gray-600 focus:border-amber-500/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black/50 border-white/10 h-12 pl-12 rounded-xl text-white placeholder:text-gray-600 focus:border-amber-500/50"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-sm h-12 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Sandbox Quick Testing Bar */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2.5 text-center">
              Quick Test Accounts (Sandbox)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemoArtist('unverified')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] text-amber-300 transition text-left"
              >
                <div className="font-bold flex items-center gap-1">
                  <PhoneCall className="w-3 h-3" /> Unverified Artist
                </div>
                <div className="text-[10px] text-gray-400">Tests SMS OTP Flow</div>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemoArtist('verified')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] text-emerald-300 transition text-left"
              >
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Verified Artist
                </div>
                <div className="text-[10px] text-gray-400">Direct Dashboard</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 text-center text-sm text-gray-400 space-y-2">
          <p>
            Don't have an artist channel yet?{" "}
            <Link to="/signup/artist" className="text-amber-400 font-bold hover:underline">
              Apply to become a Creator
            </Link>
          </p>
          <p>
            Fan or viewer?{" "}
            <Link to="/auth" className="text-gray-300 hover:underline">
              Regular User Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
