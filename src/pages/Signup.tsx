import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlaySquare, Mail, Lock, User, AtSign, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";

export default function Signup() {
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1. Create Supabase Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Could not create account");

      // 2. Create Profile in public.profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          full_name: formData.fullName,
          username: formData.username,
        }]);

      if (profileError) throw profileError;

      alert("Sign up successful! Please check your email for verification.");
      navigate("/login");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-white text-gray-900 transition-colors`}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 mb-10 group">
          <div className="bg-amber-500 p-2.5 rounded-2xl group-hover:scale-110 transition-all shadow-lg shadow-amber-100 border border-amber-400">
            <PlaySquare className="w-8 h-8 text-white fill-white" />
          </div>
          <span className="text-4xl font-black tracking-tighter italic text-gray-900">PAYTUNE</span>
        </Link>
        <h2 className="text-center text-3xl font-black tracking-tight italic text-gray-900">Create your account</h2>
        <p className="mt-2 text-center text-sm text-gray-400 font-bold uppercase tracking-widest">
          Already have an account?{" "}
          <Link to="/login" className="font-black text-amber-600 hover:text-amber-700 underline underline-offset-4 decoration-amber-200">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className={`py-10 px-4 bg-white shadow-xl sm:rounded-[40px] sm:px-12 border border-gray-100 relative overflow-hidden`}>
          <form className="space-y-6" onSubmit={handleSignup}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-gray-400 ml-1`}>Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    required
                    type="text"
                    className={`block w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl leading-5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold text-gray-900`}
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-gray-400 ml-1`}>Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <AtSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    required
                    type="text"
                    className={`block w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl leading-5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold text-gray-900`}
                    placeholder="johndoe"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-gray-400 ml-1`}>Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  required
                  type="email"
                  className={`block w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl leading-5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold text-gray-900`}
                  placeholder="you@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-gray-400 ml-1`}>Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  required
                  type="password"
                  className={`block w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl leading-5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold text-gray-900`}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-wider animate-pulse">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <div>
              <button
                disabled={isLoading}
                type="submit"
                className="group relative w-full flex justify-center py-5 px-4 border border-transparent rounded-2xl shadow-xl shadow-amber-100 text-lg font-black text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em]"
              >
                {isLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : "Join PayTune"}
              </button>
            </div>
          </form>

          <div className="mt-10 text-center border-t border-gray-50 pt-8">
            <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest italic">"Support your favorite Rwandan artists directly."</p>
          </div>
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50/50 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
