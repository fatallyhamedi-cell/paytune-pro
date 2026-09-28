import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { FileText, Shield, Sparkles, Scale, BookOpen, Clock, ArrowRight } from "lucide-react";

export default function LegalPages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "terms";

  const tabs = [
    { id: "terms", label: "Terms of Service", icon: Scale },
    { id: "privacy", label: "Privacy Policy", icon: Shield },
    { id: "artist-agreement", label: "Artist Agreement", icon: FileText }
  ];

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#090909] text-gray-900 dark:text-gray-100 py-10 px-4 md:px-8 transition-colors duration-200">
      <div className="max-w-4xl mx-auto">
        
        {/* Header section styled with ambient border */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-black uppercase tracking-wider mb-4 border border-amber-500/10">
            <Sparkles className="w-3.5 h-3.5" /> Compliance & Legal Center
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">
            PAYTUNE Agreement Guidelines
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xl mx-auto font-medium">
            Please read these documents carefully. They govern your utilization of Paytune as a Fan, Artist, or Platform operator.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center gap-2 mb-8 bg-white dark:bg-[#111] p-1.5 rounded-2xl border border-gray-100 dark:border-[#222] shadow-sm max-w-md mx-auto">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                  isActive
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#181818]"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Document Content */}
        <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-[#222] rounded-[32px] p-6 md:p-10 shadow-sm transition-colors">
          
          {currentTab === "terms" && (
            <article className="space-y-6 prose dark:prose-invert max-w-none text-sm leading-relaxed text-gray-650 dark:text-gray-300">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#222] pb-4 mb-6">
                <span className="text-lg font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <Scale className="text-amber-500 w-5 h-5" /> Terms of Service
                </span>
                <span className="text-xs font-bold font-mono text-gray-400 flex items-center gap-1.5 bg-gray-50 dark:bg-black/40 px-3 py-1 rounded-full border border-gray-200/50 dark:border-[#222]">
                  <Clock className="w-3.5 h-3.5" /> Effective: June 2026
                </span>
              </div>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">1. Platform Scope & Purpose</h3>
                <p>
                  Welcome to PAYTUNE. We offer a direct web-based platform facilitating connection between musical artists in Rwanda and fans globally. 
                  By registering an account and utilizing our payment gateways (MTN Mobile Money, Airtel Money, Stripe), or accessing any published content, 
                  you unconditionally agree to comply with and be bound by these Terms of Service.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">2. Purchases & Lifetime Library</h3>
                <p>
                  Content on PAYTUNE is acquired via single-payment lifetime access licenses (unless otherwise specified, such as Channel Memberships). 
                  Purchases are tied to your personal Fan Account profile. You are permitted to listen to, view, and stream the media coordinates infinitely 
                  for personal, non-commercial use on compatible devices. 
                </p>
                <p className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl text-xs font-bold text-amber-600 dark:text-amber-500">
                  ⚠️ REFUND CLAUSE: All purchases processed via Mobile Money APIs (MTN MoMo, Airtel) or international Stripe linkages are final upon media settlement confirmation. Please watch the 30-second free public previews carefully before executing cash transactions.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">3. Account Integrity & Rules of Play</h3>
                <p>
                  You are solely responsible for protecting your secret login credentials. Sharing accounts is strictly forbidden. 
                  You are prohibited from downloading, ripping, recording, or redistributing the transcode chunks of HLS stream media of Paytune. 
                  Any violation results in immediate profile lock and forfeiture of library nodes without compensation.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">4. Automated Financial Settlements</h3>
                <p>
                  Platform payments split automatically at the moment of payment routing. All transactions include a standard withholding 
                  for state-regulated Value Added Tax (VAT) of 5%. The remainder separates into 70% artist payout balance allocations and 30% platform developer commission cuts.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">5. Content Moderation & Compliance</h3>
                <p>
                  The platform administrators (Master role) reserves absolute discretion to moderate, disable, or delete content matching compliance reports (such as copyright infringement, low quality, inappropriate guidelines breach). Deleted contents are fully retired.
                </p>
              </section>
            </article>
          )}

          {currentTab === "privacy" && (
            <article className="space-y-6 prose dark:prose-invert max-w-none text-sm leading-relaxed text-gray-650 dark:text-gray-300">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#222] pb-4 mb-6">
                <span className="text-lg font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <Shield className="text-amber-500 w-5 h-5" /> Privacy Policy
                </span>
                <span className="text-xs font-bold font-mono text-gray-400 flex items-center gap-1.5 bg-gray-50 dark:bg-black/40 px-3 py-1 rounded-full border border-gray-200/50 dark:border-[#222]">
                  <Clock className="w-3.5 h-3.5" /> Effective: June 2026
                </span>
              </div>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">1. Protection Principles</h3>
                <p>
                  Your privacy is a core pillar of our design. In compliance with the Rwanda Personal Data Protection and Privacy Law (Law N° 058/2021) 
                  and standard international GDPR practices, we strictly process only the data coordinates absolutely necessary to authenticate user identities 
                  and run smooth, verifiable MTN / Airtel financial ledgers.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">2. Information Collection</h3>
                <p>
                  We compile and maintain:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><span className="font-extrabold text-gray-900 dark:text-white">Profile Elements:</span> Email addresses, full names, user roles, phone numbers, and optional profile images.</li>
                  <li><span className="font-extrabold text-gray-900 dark:text-white">Usage Contexts:</span> Video play history, scroll behaviors, ratings, and playlist configurations mapped to your user ID.</li>
                  <li><span className="font-extrabold text-gray-900 dark:text-white">Financial Audits:</span> Transaction IDs, mobile money payment phone numbers, and payment receipt confirmations.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">3. How Your Information is Utilized</h3>
                <p>
                  Your details process strictly inside the server boundary to:
                  - Identify and lock premium content to verified buyers.
                  - Enable automated MTN MoMo ledger splits and instant artist withdrawal dispersals.
                  - Formulate aggregated YouTube-style analytics dashboards for creator insights (excluding direct identifiers).
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">4. Third-Party Security</h3>
                <p>
                  We leverage Supabase Auth and Database for storage stability, MongoDB for fallback analytics replicas, Cloudinary for optimized and secure HLS encoding routing, and MTN API sandboxes for transaction gateways. Paytune never sells, rents, or licenses your personal data pointers to marketing brokers.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">5. Your Data Rights</h3>
                <p>
                  You possess full authority to query, export, correct, or permanently erase your user profile and metadata directly from the settings menu. Deleting your profile permanently purges database tables immediately.
                </p>
              </section>
            </article>
          )}

          {currentTab === "artist-agreement" && (
            <article className="space-y-6 prose dark:prose-invert max-w-none text-sm leading-relaxed text-gray-650 dark:text-gray-300">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#222] pb-4 mb-6">
                <span className="text-lg font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <FileText className="text-amber-500 w-5 h-5" /> Artist License Agreement
                </span>
                <span className="text-xs font-bold font-mono text-gray-400 flex items-center gap-1.5 bg-gray-50 dark:bg-black/40 px-3 py-1 rounded-full border border-gray-200/50 dark:border-[#222]">
                  <Clock className="w-3.5 h-3.5" /> Effective: June 2026
                </span>
              </div>

              <p className="font-bold">
                NOTICE: BY SUBMITTING YOUR ARTIST REGISTRATION AND UPLOADING AUDIO-VISUAL WORKS TO PAYTUNE, YOU RECOGNIZE THAT YOU HAVE FULLY READ, AGREED TO, AND UNDERSTOOD COMPLIANCE TERMS HEREIN.
              </p>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">1. IP Licensing Grant</h3>
                <p>
                  You retain complete intellectual property ownership of any musical and audio-visual assets uploaded. 
                  However, you grant PAYTUNE a non-exclusive, sub-licensable, worldwide, royalty-free license to host, transcode, chunk, and serve 
                  the media packages for streaming playback, including utilizing 30-second trailers for marketing display purposes.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">2. Financial Split Mechanics</h3>
                <p>
                  PAYTUNE allocates revenue based on strict ledger separation rules:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-black/40 p-5 rounded-2xl border border-gray-250/50 dark:border-[#222]">
                  <div>
                    <h4 className="text-xs font-black uppercase text-gray-400">VAT (Withholding)</h4>
                    <p className="text-lg font-black text-orange-500 mt-1">5% Base Cut</p>
                    <p className="text-[10px] text-gray-400 font-medium">withheld directly for national tax compliance</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-gray-400">Creator Portion</h4>
                    <p className="text-lg font-black text-emerald-500 mt-1">70% Of Net</p>
                    <p className="text-[10px] text-gray-400 font-medium">credited automatically to your pending balances</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-gray-400">Platform Share</h4>
                    <p className="text-lg font-black text-rose-500 mt-1">30% Of Net</p>
                    <p className="text-[10px] text-gray-400 font-medium">allocated to infrastructure maintenance & operations</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">3. Disbursement & Payout Parameters</h3>
                <p>
                  Withdrawals can be requested via your Studio Earnings dashboard when your pending ledger surpasses the threshold limit of 5,000 RWF. 
                  Disbursements are routed using standard MTN Mobile Money or Airtel Money API channels to your registered telephone number. 
                  All transfers are manually audited by the platform administrators to ensure absolute transaction security before gateway release.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">4. Content Guarantee</h3>
                <p>
                  You guarantee and agree that you own all copyright, performance rights, and composition license handles of uploaded audiovisuals. 
                  Uploading third-party copyrighted materials is strictly actionable, leading to permanent account lock and forfeiture of accumulated balances.
                </p>
              </section>
            </article>
          )}

        </div>

        {/* Back navigation */}
        <div className="mt-8 text-center flex items-center justify-center gap-4 text-xs font-black uppercase tracking-wider">
          <Link to="/" className="text-gray-400 hover:text-amber-500 flex items-center gap-1">
            Home Core
          </Link>
          <span className="text-gray-300 dark:text-[#222]">•</span>
          <Link to="/auth" className="text-gray-400 hover:text-amber-500 flex items-center gap-1">
            Access Account
          </Link>
        </div>

      </div>
    </div>
  );
}
