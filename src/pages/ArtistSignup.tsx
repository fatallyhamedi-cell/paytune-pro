import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { 
  Music, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Loader2,
  Globe2,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ArtistSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [detectedGeo, setDetectedGeo] = useState<{ country_code: string; currency_code: string; country_name: string } | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    momoCode: "",
    momoProvider: "MTN"
  });

  useEffect(() => {
    api.get("/api/artist/geo/detect")
      .then((res) => {
        if (res.data?.success) {
          setDetectedGeo({
            country_code: res.data.country_code || "RW",
            currency_code: res.data.currency_code || "RWF",
            country_name: res.data.country_name || "Rwanda"
          });
        }
      })
      .catch(() => {
        setDetectedGeo({ country_code: "RW", currency_code: "RWF", country_name: "Rwanda" });
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Register artist via endpoint with geo detection & SMS OTP generation
      const res = await api.post("/api/artist/register", {
        email: formData.email.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        momoCode: formData.momoCode.trim() || formData.phone.trim(),
        momoProvider: formData.momoProvider
      });

      if (res.data?.success) {
        if (res.data.token) {
          localStorage.setItem("paytune_auth_token", res.data.token);
        }

        // Navigate immediately to SMS phone confirmation screen
        navigate("/artist/verify-phone", {
          state: {
            artistId: res.data.artistId,
            email: formData.email.trim(),
            phone: res.data.phone,
            testOtp: res.data.testOtp
          }
        });
        return;
      } else {
        setError(res.data?.message || "Failed to create artist profile.");
      }
    } catch (err: any) {
      const resp = err?.response?.data;
      setError(resp?.message || err.message || "An unexpected error occurred during artist registration.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-sm">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2 italic">Application Received!</h1>
          <p className="text-gray-500 mb-8 font-medium">Your artist account has been created. Our team will review your details and approve you shortly. Check your email for more info!</p>
          <Link to="/">
            <Button className="bg-gray-900 text-white font-bold h-12 px-8 rounded-xl shadow-lg">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 py-20">
      <div className="max-w-lg w-full">
        <div className="text-center mb-12">
          <Link to="/" className="inline-flex bg-amber-500 p-3 rounded-2xl shadow-xl shadow-amber-100 mb-6 border border-amber-400/20">
            <Music className="w-8 h-8 text-white fill-white" />
          </Link>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter mb-4 italic">The Stage is Yours</h1>
          <p className="text-amber-600 font-black uppercase tracking-widest text-xs mb-3">Join PAYTUNE as an Artist • Earn 70% Revenue • Rwanda to the World</p>
          {detectedGeo && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              <Globe2 className="w-3.5 h-3.5 text-amber-600" />
              <span>
                Detected Region: <strong>{detectedGeo.country_name}</strong> ({detectedGeo.currency_code})
              </span>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-[40px] p-10 shadow-xl relative">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Stage Name / Full Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Mama C" 
                    className="bg-gray-50 border-gray-200 h-12 pl-12 rounded-xl focus:border-amber-500/50 text-gray-900"
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Contact Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="0788..." 
                    className="bg-gray-50 border-gray-200 h-12 pl-12 rounded-xl focus:border-amber-500/50 text-gray-900"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  type="email"
                  placeholder="artist@email.com" 
                  className="bg-gray-50 border-gray-200 h-12 pl-12 rounded-xl focus:border-amber-500/50 text-gray-900"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  type="password"
                  placeholder="••••••••" 
                  className="bg-gray-50 border-gray-200 h-12 pl-12 rounded-xl focus:border-amber-500/50 text-gray-900"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="h-px bg-gray-100 my-4" />

            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 space-y-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                 <CreditCard className="w-4 h-4 text-amber-600" />
                 <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Payout Information</span>
              </div>
              
              <div className="space-y-2">
                <Label className="text-[9px] font-bold uppercase text-gray-500 ml-1">Payout Provider</Label>
                <Select value={formData.momoProvider} onValueChange={(v) => setFormData({...formData, momoProvider: v})}>
                  <SelectTrigger className="bg-white border-gray-100 h-11 rounded-xl text-gray-900 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="MTN" className="text-gray-900 hover:bg-gray-50">MTN MoMo</SelectItem>
                    <SelectItem value="Airtel" className="text-gray-900 hover:bg-gray-50">Airtel Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[9px] font-bold uppercase text-gray-500 ml-1">Mobile Money Number (Must be registered)</Label>
                <Input 
                  placeholder="Enter payout number" 
                  className="bg-white border-gray-100 h-11 rounded-xl focus:border-amber-500/50 text-gray-900 font-black shadow-sm"
                  value={formData.momoCode}
                  onChange={(e) => setFormData({...formData, momoCode: e.target.value})}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold border border-rose-100 shadow-sm animate-pulse">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button 
              disabled={loading}
              className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-lg uppercase tracking-[0.1em] shadow-lg shadow-amber-200 border-none relative overflow-hidden group"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                <div className="flex items-center gap-3">
                   Apply as Artist
                   <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </div>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-tight leading-relaxed">
            By applying, you agree to our <span className="text-gray-600 hover:underline cursor-pointer">Artist Agreement</span> (70/30 Net Split).<br />
            Content moderation applies to all uploads.
          </p>
        </div>
        
        <div className="mt-10 text-center">
           <Link to="/artist/login" className="text-sm font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest">
              Already have an artist account? <span className="text-gray-900 font-black hover:underline decoration-amber-500 underline-offset-4">Artist Sign In</span>
           </Link>
        </div>
      </div>
    </div>
  );
}
