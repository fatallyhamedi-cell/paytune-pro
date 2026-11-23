import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { supabase, supabaseProjectInfo } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import {
  Music,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Chrome,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  X,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthViewMode = "login" | "signup" | "forgot" | "reset";

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { signInWithCredentials, signUpWithCredentials } = useAuth();

  const initialMode: AuthViewMode = (() => {
    const modeParam = searchParams.get("mode");
    if (location.pathname === "/reset-password" || modeParam === "reset-password") return "reset";
    if (modeParam === "forgot") return "forgot";
    if (searchParams.get("tab") === "signup") return "signup";
    return "login";
  })();

  const [viewMode, setViewMode] = useState<AuthViewMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    fullName?: string;
    termsAccepted?: string;
  }>({});

  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });

  const callbackUrl = `${supabaseProjectInfo.url}/auth/v1/callback`;
  const supabaseProvidersUrl = `https://supabase.com/dashboard/project/${supabaseProjectInfo.projectId}/auth/providers`;
  const [isEmbeddedFrame, setIsEmbeddedFrame] = useState(false);

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (location.pathname === "/reset-password" || modeParam === "reset-password") {
      setViewMode("reset");
    } else if (modeParam === "forgot") {
      setViewMode("forgot");
    } else if (searchParams.get("tab") === "signup") {
      setViewMode("signup");
    }
  }, [location.pathname, searchParams]);

  const switchView = (nextMode: AuthViewMode) => {
    setViewMode(nextMode);
    setError("");
    setSuccess("");
    setFieldErrors({});
    setFormData((prev) => ({ ...prev, password: "", confirmPassword: "" }));
    if (nextMode === "signup") {
      setSearchParams({ tab: "signup" }, { replace: true });
    } else if (nextMode === "forgot") {
      setSearchParams({ mode: "forgot" }, { replace: true });
    } else if (nextMode === "reset") {
      setSearchParams({ mode: "reset-password" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading || loading) return;
    setGoogleLoading(true);
    setError("");
    setFieldErrors({});

    try {
      const inIframe = typeof window !== "undefined" && window.self !== window.top;
      if (inIframe) {
        setIsEmbeddedFrame(true);
        setError(
          "Google Sign-In cannot open inside an embedded preview frame. Open PAYTUNE in a full browser tab to continue with Google."
        );
        setGoogleLoading(false);
        return;
      }

      const statusRes = await fetch("/api/auth/google/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json().catch(() => null);
        if (statusData && !statusData.googleEnabled) {
          setShowGoogleModal(true);
          setGoogleLoading(false);
          return;
        }
      }

      const explicitRedirect = searchParams.get("redirect");
      if (explicitRedirect && explicitRedirect.startsWith("/")) {
        sessionStorage.setItem("paytune_oauth_redirect", explicitRedirect);
      }

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError) {
        const msg = oauthError.message || "";
        if (
          msg.includes("provider is not enabled") ||
          msg.includes("validation_failed") ||
          msg.includes("Unsupported provider")
        ) {
          setShowGoogleModal(true);
          setGoogleLoading(false);
          return;
        }
        throw oauthError;
      }

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (
        msg.includes("provider is not enabled") ||
        msg.includes("validation_failed") ||
        msg.includes("Unsupported provider")
      ) {
        setShowGoogleModal(true);
      } else {
        setError(msg || "Google authentication failed");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCopyCallback = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2500);
  };

  const validateForm = (): boolean => {
    const errs: typeof fieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (viewMode === "forgot") {
      if (!formData.email.trim()) {
        errs.email = "Email address is required.";
      } else if (!emailRegex.test(formData.email.trim())) {
        errs.email = "Please enter a valid email address (e.g. name@example.com).";
      }
      setFieldErrors(errs);
      return Object.keys(errs).length === 0;
    }

    if (viewMode === "reset") {
      if (!formData.password) {
        errs.password = "New password is required.";
      } else if (formData.password.length < 6) {
        errs.password = "Password must be at least 6 characters long.";
      }
      if (formData.password !== formData.confirmPassword) {
        errs.confirmPassword = "Passwords do not match.";
      }
      setFieldErrors(errs);
      return Object.keys(errs).length === 0;
    }

    if (!formData.email.trim()) {
      errs.email = "Email address is required.";
    } else if (!emailRegex.test(formData.email.trim())) {
      errs.email = "Please enter a valid email address (e.g. name@example.com).";
    }

    if (!formData.password) {
      errs.password = "Password is required.";
    } else if (formData.password.length < 6) {
      errs.password = "Password must be at least 6 characters long.";
    }

    if (viewMode === "signup") {
      if (!formData.fullName.trim()) {
        errs.fullName = "Full name is required to create your account.";
      } else if (formData.fullName.trim().length < 2) {
        errs.fullName = "Full name must be at least 2 characters.";
      }
      if (!formData.confirmPassword) {
        errs.confirmPassword = "Please confirm your password.";
      } else if (formData.password !== formData.confirmPassword) {
        errs.confirmPassword = "Passwords do not match.";
      }
      if (!termsAccepted) {
        errs.termsAccepted = "Please accept the Terms of Service and Privacy Policy to continue.";
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");

    if (!validateForm()) {
      return;
    }

    const submittedEmail = formData.email.trim();
    const submittedPassword = formData.password;
    const submittedFullName = formData.fullName.trim();

    setFormData((prev) => ({ ...prev, password: "", confirmPassword: "" }));
    setLoading(true);

    try {
      if (viewMode === "forgot") {
        const res = await api.post("/api/auth/forgot-password", { email: submittedEmail });
        setSuccess(
          res.data?.message ||
            "If an account matches this email, a password reset link has been sent. Please check your inbox."
        );
        return;
      }

      if (viewMode === "reset") {
        const { error: updateErr } = await supabase.auth.updateUser({
          password: submittedPassword,
        });
        if (updateErr) throw updateErr;
        setSuccess("Your password has been updated! You can now sign in with your new password.");
        setTimeout(() => {
          switchView("login");
        }, 1200);
        return;
      }

      if (viewMode === "login") {
        if (signInWithCredentials) {
          const result = await signInWithCredentials(submittedEmail, submittedPassword, {
            rememberMe,
          });
          if (!result.success) {
            setError(result.error || "Invalid email or password.");
            return;
          }
          const explicitRedirect = searchParams.get("redirect");
          if (explicitRedirect && explicitRedirect.startsWith("/")) {
            navigate(explicitRedirect, { replace: true });
            return;
          }
          if (result.redirectTo) {
            navigate(result.redirectTo, { replace: true });
            return;
          }
          if (result.role === "artist") {
            navigate("/artist/dashboard", { replace: true });
            return;
          }
          if (result.role === "master" || result.role === "admin") {
            navigate("/master", { replace: true });
            return;
          }
        } else {
          const { error: supaErr } = await supabase.auth.signInWithPassword({
            email: submittedEmail,
            password: submittedPassword,
          });
          if (supaErr) throw supaErr;
        }

        const redirect = searchParams.get("redirect") || "/dashboard";
        navigate(redirect, { replace: true });
      } else {
        let requiresEmailConfirmation = false;
        if (signUpWithCredentials) {
          const result = await signUpWithCredentials(
            submittedEmail,
            submittedPassword,
            submittedFullName,
            termsAccepted
          );
          if (!result.success) {
            if (result.errors) {
              setFieldErrors(result.errors);
            }
            setError(result.error || "Failed to create account.");
            return;
          }
          requiresEmailConfirmation = Boolean(result.requiresEmailConfirmation);
        } else {
          const { data, error: supaErr } = await supabase.auth.signUp({
            email: submittedEmail,
            password: submittedPassword,
            options: {
              data: {
                full_name: submittedFullName,
                role: "user",
              },
            },
          });
          if (supaErr) throw supaErr;
          requiresEmailConfirmation = !data?.session;
        }

        if (requiresEmailConfirmation) {
          setSuccess(
            "Account created! Please check your email inbox to confirm your account before signing in."
          );
          setViewMode("login");
        } else {
          setSuccess("Account registered! Opening your dashboard...");
          setTimeout(() => {
            const redirect = searchParams.get("redirect") || "/dashboard";
            navigate(redirect, { replace: true });
          }, 500);
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || String(err);
      if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
        setError("Invalid email or password. Please try again.");
      } else {
        setError(msg || "An authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex bg-purple-600 p-3 rounded-2xl shadow-xl shadow-purple-100 mb-5 border border-purple-400/20"
          >
            <Music className="w-8 h-8 text-white fill-white" />
          </Link>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-2 italic">PAYTUNE</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
            Your Stage • Your Sound • Forever
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-[32px] p-7 sm:p-8 shadow-xl relative overflow-hidden">
          {/* Separate Artist Entry Banner */}
          <div className="mb-6 p-2.5 rounded-2xl bg-purple-600/10 border border-purple-600/20 text-xs text-purple-900 flex items-center justify-between gap-2">
            <span className="font-bold flex items-center gap-1.5 text-gray-800">
              <Sparkles className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              Are you an Artist?
            </span>
            <Link
              to="/artist/login"
              className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold text-[11px] hover:bg-purple-700 transition whitespace-nowrap"
            >
              Creator Studio Login →
            </Link>
          </div>

          {viewMode === "login" || viewMode === "signup" ? (
            <div className="flex bg-gray-50 p-1 rounded-2xl mb-6 border border-gray-100">
              <button
                type="button"
                onClick={() => switchView("login")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                  viewMode === "login"
                    ? "bg-white text-gray-900 shadow-md border border-gray-100"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchView("signup")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                  viewMode === "signup"
                    ? "bg-white text-gray-900 shadow-md border border-gray-100"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div className="mb-6 space-y-1">
              <button
                type="button"
                onClick={() => switchView("login")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:underline cursor-pointer mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>
              <h2 className="text-lg font-black text-gray-900">
                {viewMode === "forgot" ? "Reset Your Password" : "Choose a New Password"}
              </h2>
              <p className="text-xs text-gray-500">
                {viewMode === "forgot"
                  ? "Enter your account email and we will send you a password reset link."
                  : "Enter and confirm a new password for your PAYTUNE account."}
              </p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4" noValidate>
            {viewMode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-full-name" className="text-[10px] font-black uppercase text-gray-500 ml-1">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="auth-full-name"
                    autoComplete="name"
                    placeholder="Enter your full name"
                    className={`bg-gray-50 h-11 pl-11 rounded-xl text-gray-900 text-sm transition-colors ${
                      fieldErrors.fullName
                        ? "border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-200"
                        : "border-gray-200 focus:border-purple-500/50"
                    }`}
                    value={formData.fullName}
                    onChange={(e) => {
                      setFormData({ ...formData, fullName: e.target.value });
                      if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: undefined });
                    }}
                  />
                </div>
                {fieldErrors.fullName && (
                  <p className="text-[11px] text-rose-500 font-bold ml-1">{fieldErrors.fullName}</p>
                )}
              </div>
            )}

            {(viewMode === "login" || viewMode === "signup" || viewMode === "forgot") && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-[10px] font-black uppercase text-gray-500 ml-1">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    className={`bg-gray-50 h-11 pl-11 rounded-xl text-gray-900 text-sm transition-colors ${
                      fieldErrors.email
                        ? "border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-200"
                        : "border-gray-200 focus:border-purple-500/50"
                    }`}
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                    }}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-rose-500 font-bold ml-1">{fieldErrors.email}</p>
                )}
              </div>
            )}

            {(viewMode === "login" || viewMode === "signup" || viewMode === "reset") && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <Label htmlFor="auth-password" className="text-[10px] font-black uppercase text-gray-500">
                    {viewMode === "reset" ? "New Password" : "Password"}
                  </Label>
                  {viewMode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchView("forgot")}
                      className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={viewMode === "login" ? "current-password" : "new-password"}
                    placeholder={viewMode === "login" ? "Enter your password" : "Minimum 6 characters"}
                    className={`bg-gray-50 h-11 pl-11 pr-10 rounded-xl text-gray-900 text-sm transition-colors ${
                      fieldErrors.password
                        ? "border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-200"
                        : "border-gray-200 focus:border-purple-500/50"
                    }`}
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] text-rose-500 font-bold ml-1">{fieldErrors.password}</p>
                )}
              </div>
            )}

            {(viewMode === "signup" || viewMode === "reset") && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-confirm-password" className="text-[10px] font-black uppercase text-gray-500 ml-1">
                  {viewMode === "reset" ? "Confirm New Password" : "Confirm Password"}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    className={`bg-gray-50 h-11 pl-11 pr-10 rounded-xl text-gray-900 text-sm transition-colors ${
                      fieldErrors.confirmPassword
                        ? "border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-200"
                        : "border-gray-200 focus:border-purple-500/50"
                    }`}
                    value={formData.confirmPassword}
                    onChange={(e) => {
                      setFormData({ ...formData, confirmPassword: e.target.value });
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-[11px] text-rose-500 font-bold ml-1">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            )}

            {viewMode === "login" && (
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Keep me signed in on this device</span>
              </label>
            )}

            {viewMode === "signup" && (
              <div className="space-y-1 pt-0.5">
                <label className="flex items-start gap-2.5 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    id="auth-terms-checkbox"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      if (fieldErrors.termsAccepted) {
                        setFieldErrors({ ...fieldErrors, termsAccepted: undefined });
                      }
                    }}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 shrink-0"
                    required
                  />
                  <span className="leading-relaxed">
                    I agree to PAYTUNE&apos;s{" "}
                    <Link to="/legal?tab=terms" className="text-purple-700 font-bold hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/legal?tab=privacy" className="text-purple-700 font-bold hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {fieldErrors.termsAccepted && (
                  <p className="text-[11px] text-rose-500 font-bold ml-1">{fieldErrors.termsAccepted}</p>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-bold border border-rose-100 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                {isEmbeddedFrame && typeof window !== "undefined" && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-purple-700 hover:underline font-extrabold"
                  >
                    Open PAYTUNE in a new browser tab <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-[11px] font-bold border border-emerald-100">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs uppercase tracking-[0.18em] shadow-lg shadow-purple-200 border-none cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Please wait...
                </span>
              ) : viewMode === "login" ? (
                "Sign In"
              ) : viewMode === "signup" ? (
                "Create Account"
              ) : viewMode === "forgot" ? (
                "Send Reset Link"
              ) : (
                "Update Password"
              )}
            </Button>
          </form>

          {(viewMode === "login" || viewMode === "signup") && (
            <>
              <div className="my-6 flex items-center gap-4">
                <div className="h-px bg-gray-100 flex-1" />
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                  or continue with
                </span>
                <div className="h-px bg-gray-100 flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="w-full h-11 border-gray-200 hover:bg-gray-50 rounded-xl font-black text-xs uppercase tracking-[0.12em] flex items-center justify-center gap-3 text-gray-700 cursor-pointer"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                    Connecting Google...
                  </>
                ) : (
                  <>
                    <Chrome className="w-4 h-4 text-purple-600" />
                    Continue with Google
                  </>
                )}
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-[11px] text-gray-500 leading-relaxed">
            Protecting your music and your privacy.{" "}
            <Link to="/legal?tab=terms" className="text-gray-700 font-semibold hover:underline">
              Terms
            </Link>{" "}
            &middot;{" "}
            <Link to="/legal?tab=privacy" className="text-gray-700 font-semibold hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>

        <div className="mt-7 text-center">
          <Link
            to="/artist/register"
            className="text-xs font-black text-purple-700 uppercase tracking-widest hover:underline decoration-2 underline-offset-8"
          >
            Want to publish music or videos? Join as an Artist &rarr;
          </Link>
        </div>
      </div>

      {showGoogleModal && (
        <div
          id="google-provider-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowGoogleModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-600/20 flex items-center justify-center text-purple-700">
                <Chrome className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Google Sign-In Setup</h3>
                <p className="text-xs text-gray-500">
                  Supabase Project:{" "}
                  <code className="text-purple-700 font-mono font-bold">{supabaseProjectInfo.projectId}</code>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200/80 mb-6">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-purple-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-purple-900 leading-relaxed">
                  <strong>Why this happened:</strong> Google OAuth needs to be enabled in your Supabase Auth Providers settings.
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>To Enable Google in Supabase:</span>
                <a
                  href={supabaseProvidersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-700 flex items-center gap-1 font-bold lowercase tracking-normal text-xs hover:underline"
                >
                  open dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </h4>

              <ol className="space-y-3 text-xs text-gray-600 list-decimal list-inside leading-relaxed">
                <li className="pl-1">
                  Go to{" "}
                  <a
                    href={supabaseProvidersUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-700 font-bold underline"
                  >
                    Supabase Dashboard &gt; Auth &gt; Providers
                  </a>
                  .
                </li>
                <li className="pl-1">
                  Find <strong>Google</strong> and toggle <strong>Enable Google provider</strong> to ON.
                </li>
                <li className="pl-1">
                  In Google Cloud Console (OAuth 2.0 Credentials), set this Authorized redirect URI:
                  <div className="mt-1.5 flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                    <code className="text-[11px] font-mono text-gray-800 flex-1 truncate">{callbackUrl}</code>
                    <button
                      type="button"
                      onClick={handleCopyCallback}
                      className="px-2.5 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedCallback ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-600" />
                      )}
                      {copiedCallback ? "Copied" : "Copy"}
                    </button>
                  </div>
                </li>
                <li className="pl-1">
                  Paste your Google <strong>Client ID</strong> and <strong>Client Secret</strong> into Supabase and click{" "}
                  <strong>Save</strong>.
                </li>
              </ol>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowGoogleModal(false)}
                className="text-xs font-bold rounded-xl h-9 cursor-pointer"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
