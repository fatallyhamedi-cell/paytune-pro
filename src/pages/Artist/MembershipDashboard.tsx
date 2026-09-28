import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import axios from "axios";
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Award, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  X,
  ShieldCheck,
  Percent,
  Activity,
  UserCheck
} from "lucide-react";
import { 
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MembershipDashboard() {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    mrr: 0,
    activeSubscribers: 0,
    churnRate: 0,
    arpu: 0,
    revenueHistory: [],
    subscribersHistory: []
  });
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);
  const [tierName, setTierName] = useState("");
  const [priceRwf, setPriceRwf] = useState("");
  const [benefitsInput, setBenefitsInput] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMembershipDetails();
  }, []);

  const fetchMembershipDetails = async () => {
    try {
      setLoading(true);
      const [tiersRes, subsRes, analyticsRes] = await Promise.all([
        axios.get("/api/artist/membership/tiers"),
        axios.get("/api/artist/membership/subscribers"),
        axios.get("/api/artist/membership/analytics")
      ]);

      setTiers(Array.isArray(tiersRes.data) ? tiersRes.data : []);
      setSubscribers(Array.isArray(subsRes.data) ? subsRes.data : []);
      if (analyticsRes.data) {
        setAnalytics(analyticsRes.data);
      }
    } catch (err) {
      console.error("Failed loading membership dashboard details", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (tier: any = null) => {
    if (tier) {
      setEditingTier(tier);
      setTierName(tier.name);
      setPriceRwf(tier.price_rwf.toString());
      setBenefitsInput(Array.isArray(tier.benefits) ? tier.benefits.join(", ") : "");
      setIsActive(tier.is_active);
    } else {
      setEditingTier(null);
      setTierName("");
      setPriceRwf("");
      setBenefitsInput("Exclusive pre-releases, Live backstage streams, Badge icon");
      setIsActive(true);
    }
    setShowForm(true);
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierName.trim() || !priceRwf) return;

    setSubmitting(true);
    const benefitsList = benefitsInput.split(",").map(b => b.trim()).filter(b => b.length > 0);

    try {
      if (editingTier) {
        // Update
        const res = await axios.put(`/api/artist/membership/tiers/${editingTier.id}`, {
          name: tierName,
          price_rwf: Number(priceRwf),
          benefits: benefitsList,
          is_active: isActive
        });
        setTiers(prev => prev.map(t => t.id === editingTier.id ? res.data : t));
        alert("Membership tier renewed and saved successfully!");
      } else {
        // Create
        const res = await axios.post("/api/artist/membership/tiers", {
          name: tierName,
          price_rwf: Number(priceRwf),
          benefits: benefitsList
        });
        setTiers(prev => [...prev, res.data]);
        alert("New membership tier created successfully!");
      }
      setShowForm(false);
      // Reload analytics to capture new tier states if pricing changed
      fetchMembershipDetails();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to persist membership tier data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    if (!window.confirm("Are you sure you want to delete this level? This cannot be undone and is only allowed if there are zero active members currently in this tier.")) return;
    try {
      await axios.delete(`/api/artist/membership/tiers/${tierId}`);
      setTiers(prev => prev.filter(t => t.id !== tierId));
      alert("Tier removed successfully.");
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Unable to remove this tier. There might be active users subscripted.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400 font-bold uppercase tracking-widest py-32">Loading Channel Memberships Studio...</div>;
  }

  const cards = [
    { label: "Monthly Recurring Revenue", value: `${(analytics?.mrr || 0).toLocaleString()} RWF`, subtext: "Split share calculated", icon: DollarSign, color: "text-amber-500", bg: "bg-amber-500/5 border-amber-500/10" },
    { label: "Active Members", value: analytics?.activeSubscribers || 0, subtext: "Exclusive Channel Members", icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/10" },
    { label: "Average Revenue / User", value: `${(analytics?.arpu || 0).toLocaleString()} RWF`, subtext: "ARPU across Tiers", icon: Activity, color: "text-indigo-500", bg: "bg-indigo-500/5 border-indigo-500/10" },
    { label: "Subscription Churn Rate", value: `${analytics?.churnRate || 0}%`, subtext: "Cancelled vs Total", icon: Percent, color: "text-rose-500", bg: "bg-rose-500/5 border-rose-500/10" }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-600 italic">
            Channel Memberships
          </h1>
          <p className="text-gray-500 mt-2 font-black text-xs uppercase tracking-widest">
            Setup premium channels and recurring payouts for your VIP fans
          </p>
        </div>
        <Button 
          onClick={() => handleOpenForm(null)}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-2xl h-12 px-6 font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-amber-100 dark:shadow-none border-none flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Level Tier
        </Button>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {cards.map((card, i) => (
          <Card key={i} className={`bg-white dark:bg-[#151515] border rounded-[24px] ${card.bg}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest">{card.label}</p>
                <div className={`p-2.5 rounded-xl bg-white dark:bg-black/25 shadow-sm`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{card.value}</p>
              <p className="text-[9px] text-gray-450 dark:text-gray-500 mt-1 uppercase font-bold tracking-widest">{card.subtext}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Tiers List */}
        <div className="lg:col-span-2 space-y-6 text-left">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" />
            Active Membership Tiers
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tiers.length > 0 ? (
              tiers.map((t) => (
                <Card key={t.id} className="bg-white dark:bg-[#151515] border border-gray-100 dark:border-[#222] rounded-[30px] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-left">
                  <div className="text-left">
                    <div className="flex justify-between items-start text-left">
                      <div className="text-left">
                        <span className={`inline-flex items-center text-[9px] font-black uppercase px-2 py-0.5 rounded-full mb-2 ${t.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                          {t.is_active ? "Live & Active" : "Disabled"}
                        </span>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t.name}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-amber-500">RWF {Number(t.price_rwf || 0).toLocaleString()}</p>
                        <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-widest leading-none">/ month</p>
                      </div>
                    </div>

                    <div className="py-4 border-t border-b border-gray-50 dark:border-gray-800 my-4 text-left">
                      <p className="text-[10px] font-black uppercase text-gray-450 tracking-widest mb-2">Perks List</p>
                      <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 font-medium">
                        {(t.benefits || []).map((b: string, idx: number) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="text-amber-500">✓</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleOpenForm(t)}
                      variant="outline"
                      className="flex-1 rounded-xl h-10 text-[11px] font-black uppercase tracking-widest"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      Configure
                    </Button>
                    <Button
                      onClick={() => handleDeleteTier(t.id)}
                      variant="outline"
                      className="text-red-500 border-red-500/10 hover:bg-red-500/5 rounded-xl h-10 w-10 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[42px] bg-gray-50/50 dark:bg-[#121212]/5">
                <Award className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                <h4 className="text-base font-black text-gray-400 uppercase tracking-tighter">No subscription levels yet</h4>
                <p className="text-xs text-gray-450 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Create tiers with custom benefits to support continuous monthly earnings!</p>
              </div>
            )}
          </div>
        </div>

        {/* Revenue Projection Area */}
        <div className="text-left">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic flex items-center gap-2 mb-6">
            <TrendingUp className="w-6 h-6 text-amber-500" />
            MRR Forecast
          </h2>

          <Card className="bg-white dark:bg-[#151515] border border-gray-100 dark:border-[#222] rounded-[30px] p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Support & Growth History</p>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.revenueHistory || []}>
                  <defs>
                    <linearGradient id="mrrColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#mrrColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* VIP Subscribers table */}
      <div className="text-left mt-12 bg-white dark:bg-[#151515] border border-gray-105 dark:border-[#222] rounded-[35px] p-8 shadow-sm">
        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic mb-6">
          Channel Member Roster ({subscribers.length})
        </h2>

        {subscribers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-[10px] uppercase tracking-widest font-black text-gray-400">
                  <th className="pb-3 pl-3">Member Name</th>
                  <th className="pb-3 text-center">Subscription Tier</th>
                  <th className="pb-3 text-center">Renewal Date</th>
                  <th className="pb-3 text-right pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub, i) => {
                  const prof = sub.profiles || {};
                  const tierName = sub.membership_tiers?.name || "VIP Supporter";
                  const nextRenewal = new Date(sub.current_period_end).toLocaleDateString();
                  const isCancel = sub.cancel_at_period_end;

                  return (
                    <tr key={sub.id} className="border-b border-gray-55 dark:border-[#222]/40 last:border-0 hover:bg-gray-50/50 dark:hover:bg-[#1A1A1A]/30 text-xs font-bold text-gray-850 dark:text-gray-300">
                      <td className="py-4 pl-3">
                        <p className="font-extrabold text-sm text-gray-900 dark:text-white">{prof.full_name || "PAYTUNE Fan"}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">@{prof.username || "vip_fan"}</p>
                      </td>
                      <td className="py-4 text-center">
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                          {tierName}
                        </span>
                      </td>
                      <td className="py-4 text-center text-gray-500">
                        {nextRenewal} {isCancel && <span className="text-red-500 text-[9px] uppercase font-black tracking-tighter block">(Ends)</span>}
                      </td>
                      <td className="py-4 text-right pr-3">
                        {sub.status === "active" ? (
                          <span className="text-emerald-500 uppercase text-[10px] font-black tracking-widest">Active</span>
                        ) : sub.status === "cancelled" || isCancel ? (
                          <span className="text-red-400 uppercase text-[10px] font-black tracking-widest">Cancelled</span>
                        ) : (
                          <span className="text-gray-400 uppercase text-[10px] font-black tracking-widest">Expired</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400 font-extrabold">
            <Users className="w-12 h-12 mx-auto opacity-10 mb-2" />
            <p className="text-sm italic">You don't have any paid channel members yet. Advertise your membership levels to fans!</p>
          </div>
        )}
      </div>

      {/* Create / Edit Tier Overlay Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <Card className="bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800 p-8 rounded-[40px] max-w-md w-full relative text-left shadow-2xl">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-6 right-6 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic mb-6">
              {editingTier ? "Configure Level Level" : "Create New Supporter Level"}
            </h3>

            <form onSubmit={handleSaveTier} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-450 dark:text-gray-500 mb-1">Level Name</label>
                <input
                  type="text"
                  required
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-amber-500 text-xs font-bold text-gray-850 dark:text-white"
                  placeholder="e.g. VIP Backstage, Super Fan Gold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-450 dark:text-gray-500 mb-1">Monthly Price (RWF)</label>
                <input
                  type="number"
                  required
                  value={priceRwf}
                  onChange={(e) => setPriceRwf(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-amber-500 text-xs font-bold text-gray-850 dark:text-white"
                  placeholder="e.g. 5000"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-450 dark:text-gray-500 mb-1">Benefits (Comma separated)</label>
                <textarea
                  required
                  value={benefitsInput}
                  onChange={(e) => setBenefitsInput(e.target.value)}
                  rows={3}
                  className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-amber-500 text-xs font-bold text-gray-850 dark:text-white resize-none"
                  placeholder="Benefit 1, Benefit 2, Gold Badge, Live backstage streams"
                ></textarea>
              </div>

              {editingTier && (
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="isActive" className="text-xs font-black uppercase tracking-widest text-gray-500 select-none cursor-pointer">
                    Enable Tier for New Subs
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 h-11 text-xs font-black uppercase rounded-xl border"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white h-11 text-xs font-black uppercase rounded-xl border-none shadow-lg shadow-amber-100"
                >
                  {submitting ? "Saving..." : "Save Tier"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
