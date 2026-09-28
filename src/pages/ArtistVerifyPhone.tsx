import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { 
  ShieldCheck, 
  Smartphone, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Globe2, 
  KeyRound,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ArtistVerifyPhone() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, roleData, refreshProfile } = useAuth();

  const stateData = (location.state as any) || {};
  const [phone, setPhone] = useState(stateData.phone || roleData?.phone || user?.phone || "+250 788 123 456");
  const [email, setEmail] = useState(stateData.email || roleData?.email || user?.email || "");
  const [artistId, setArtistId] = useState(stateData.artistId || roleData?.id || user?.id || "");

  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendNotice, setResendNotice] = useState("");
  const [testOtpHint, setTestOtpHint] = useState<string | null>(stateData.testOtp || null);
  const [geoData, setGeoData] = useState<{ country_code: string; currency_code: string; country_name: string } | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 1. Fetch geo detection info
  useEffect(() => {
    api.get("/api/artist/geo/detect")
      .then((res) => {
        if (res.data?.success) {
          setGeoData({
            country_code: res.data.country_code || "RW",
            currency_code: res.data.currency_code || "RWF",
            country_name: res.data.country_name || "Rwanda"
          });
        }
      })
      .catch(() => {
        setGeoData({ country_code: "RW", currency_code: "RWF", country_name: "Rwanda" });
      });
  }, []);

  // 2. Cooldown timer for resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // 3. Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    // If multiple digits pasted
    if (value.length > 1) {
      const cleaned = value.replace(/\D/g, "").slice(0, 6);
      if (cleaned.length > 0) {
        const nextDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          nextDigits[i] = cleaned[i] || "";
        }
        setOtpDigits(nextDigits);
        const focusIndex = Math.min(cleaned.length, 5);
        inputRefs.current[focusIndex]?.focus();
        if (cleaned.length === 6) {
          triggerVerification(nextDigits.join(""));
        }
        return;
      }
    }

    const singleDigit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = singleDigit;
    setOtpDigits(nextDigits);

    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto trigger when 6th digit entered
    if (singleDigit && index === 5) {
      const fullCode = nextDigits.join("");
      if (fullCode.length === 6) {
        triggerVerification(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const triggerVerification = async (code: string) => {
    if (code.length !== 6) {
      setError("Please enter all 6 digits of the verification code.");
      return;
    }

    setLoading(true);
    setError("");
    setResendNotice("");

    try {
      const res = await api.post("/api/artist/verify-phone", {
        artistId,
        email,
        phone,
        otp: code
      });

      if (res.data?.success) {
        setSuccess(true);
        if (res.data.token) {
          localStorage.setItem("paytune_auth_token", res.data.token);
        }
        await refreshProfile();
        setTimeout(() => {
          navigate("/artist/dashboard");
        }, 1500);
      } else {
        setError(res.data?.message || "Invalid verification code.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;

    setResending(true);
    setError("");
    setResendNotice("");

    try {
      const res = await api.post("/api/artist/resend-otp", {
        artistId,
        email,
        phone
      });

      if (res.data?.success) {
        setResendNotice(res.data.message || "A new 6-digit code has been sent via SMS.");
        setResendCooldown(res.data.cooldownSeconds || 60);
        if (res.data.testOtp) {
          setTestOtpHint(res.data.testOtp);
        }
        setOtpDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        setError(res.data?.message || "Failed to resend SMS code.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to resend SMS.");
    } finally {
      setResending(false);
    }
  };

  const handleUseTestCode = () => {
    const code = testOtpHint || "123456";
    const digits = code.split("").slice(0, 6);
    setOtpDigits(digits);
    triggerVerification(code);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-center items-center p-4 py-16 relative selection:bg-amber-500 selection:text-black">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-amber-500/10 blur-[130px] pointer-events-none rounded-full" />

      <div className="max-w-md w-full relative z-10">
        {/* Top Back Link */}
        <div className="mb-6">
          <Link to="/artist/login" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Artist Login</span>
          </Link>
        </div>

        {/* Card Container */}
        <div className="bg-[#141414] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          {/* Header Icon */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
              <Smartphone className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-2 italic">Confirm Your Phone</h1>
            <p className="text-gray-400 text-xs leading-relaxed max-w-xs mx-auto">
              For payout security and anti-fraud compliance, please enter the 6-digit SMS code sent to:
            </p>
            <div className="mt-2 font-mono text-sm font-bold text-amber-400 tracking-wider">
              {phone}
            </div>

            {/* Region Detection Pill */}
            {geoData && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300">
                <Globe2 className="w-3 h-3 text-amber-400" />
                <span>
                  Detected Region: <strong className="text-white">{geoData.country_name}</strong> ({geoData.currency_code})
                </span>
              </div>
            )}
          </div>

          {/* Success State */}
          {success ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-xl font-bold text-emerald-400">Phone Verified Successfully!</h2>
              <p className="text-gray-400 text-xs">
                Redirecting to your Creator Studio Dashboard...
              </p>
              <div className="pt-2">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin mx-auto" />
              </div>
            </div>
          ) : (
            <>
              {/* Feedback messages */}
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {resendNotice && (
                <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{resendNotice}</span>
                </div>
              )}

              {/* 6-Digit Code Input Box */}
              <div className="mb-6">
                <div className="flex justify-between gap-2 sm:gap-3">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-12 h-14 text-center text-2xl font-mono font-bold bg-black/60 border border-white/15 focus:border-amber-500 rounded-xl text-amber-400 focus:outline-none transition-all"
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 text-center mt-2.5">
                  Code expires in 10 minutes
                </p>
              </div>

              {/* Verify Button */}
              <Button
                type="button"
                onClick={() => triggerVerification(otpDigits.join(""))}
                disabled={loading || otpDigits.join("").length !== 6}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-sm h-12 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Continue</span>
                  </>
                )}
              </Button>

              {/* Resend Action */}
              <div className="text-center pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-gray-400">Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className="inline-flex items-center gap-1.5 font-bold text-amber-400 hover:text-amber-300 disabled:text-gray-600 transition"
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{resendCooldown > 0 ? `Resend SMS in ${resendCooldown}s` : "Resend SMS"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sandbox Quick Testing Helper */}
              <div className="mt-5 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                <div className="flex items-center justify-between text-gray-400 mb-1.5">
                  <span className="font-bold flex items-center gap-1 text-gray-300">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    Sandbox Quick Fill
                  </span>
                  <span className="text-[10px] uppercase font-mono text-amber-400/80">Dev Ready</span>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">
                  In development, you can autofill with test code <code className="text-amber-300 font-mono">123456</code> or your active OTP.
                </p>
                <button
                  type="button"
                  onClick={handleUseTestCode}
                  className="w-full py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-amber-300 font-mono text-xs font-bold transition"
                >
                  Use Code {testOtpHint ? `(${testOtpHint})` : "(123456)"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
