import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart3,
  TrendingUp,
  Download,
  Users,
  DollarSign,
  ArrowDownCircle,
  FileSpreadsheet
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from "recharts";

export const MasterReports: React.FC = () => {
  const [salesReport, setSalesReport] = useState<any>(null);
  const [artistReport, setArtistReport] = useState<any[]>([]);
  const [userReport, setUserReport] = useState<any>(null);
  const [withdrawalReport, setWithdrawalReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("master_token") || localStorage.getItem("admin_token") || "master_token";
    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      axios.get("/api/master/reports/sales", { headers }),
      axios.get("/api/master/reports/artists", { headers }),
      axios.get("/api/master/reports/users", { headers }),
      axios.get("/api/master/reports/withdrawals", { headers })
    ]).then(([sales, artists, users, withdrawals]) => {
      if (sales.status === "fulfilled") setSalesReport(sales.value.data);
      if (artists.status === "fulfilled") setArtistReport(artists.value.data);
      if (users.status === "fulfilled") setUserReport(users.value.data);
      if (withdrawals.status === "fulfilled") setWithdrawalReport(withdrawals.value.data);
      setLoading(false);
    });
  }, []);

  const pieColors = ["#FFB300", "#3B82F6", "#10B981", "#EC4899"];

  const providerData = [
    { name: "MTN Mobile Money", value: 78 },
    { name: "Airtel Money", value: 22 }
  ];

  return (
    <div id="master-reports-module" className="space-y-6">
      {/* Top Header */}
      <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span>Platform Financial & Growth Analytics</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Comprehensive audit reports covering sales, creator payouts, and audience engagement.
          </p>
        </div>
      </div>

      {/* Summary Row */}
      {salesReport?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800">
            <span className="text-xs text-neutral-400">Gross Sales Volume</span>
            <p className="text-xl font-black text-white mt-1">
              {Number(salesReport.summary.total_gross_volume).toLocaleString()} RWF
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800">
            <span className="text-xs text-neutral-400">Platform Net Retained (30%)</span>
            <p className="text-xl font-black text-amber-400 mt-1">
              {Number(salesReport.summary.total_owner_commission).toLocaleString()} RWF
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800">
            <span className="text-xs text-neutral-400">Creator Earnings Disbursed</span>
            <p className="text-xl font-black text-emerald-400 mt-1">
              {Number(salesReport.summary.total_artist_payouts).toLocaleString()} RWF
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800">
            <span className="text-xs text-neutral-400">VAT Remittance (5%)</span>
            <p className="text-xl font-black text-blue-400 mt-1">
              {Number(salesReport.summary.total_vat_collected).toLocaleString()} RWF
            </p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth Bar Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#161616] border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-4">User Growth & Revenue Cohorts</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userReport?.growth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="period" stroke="#737373" fontSize={11} tickLine={false} />
                <YAxis stroke="#737373" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F1F1F",
                    borderColor: "#404040",
                    borderRadius: 12,
                    fontSize: 12
                  }}
                />
                <Bar dataKey="spending" fill="#FFB300" radius={[6, 6, 0, 0]} name="Spending (RWF)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payout Distribution Pie Chart */}
        <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-white mb-2">MoMo Provider Distribution</h3>
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={providerData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {providerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-neutral-300">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFB300]" /> MTN Mobile Money
              </span>
              <span className="font-bold">78%</span>
            </div>
            <div className="flex items-center justify-between text-neutral-300">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" /> Airtel Money
              </span>
              <span className="font-bold">22%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Creators Table */}
      <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800">
        <h3 className="text-sm font-bold text-white mb-3">Artist Performance Rankings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400">
                <th className="p-3">Rank</th>
                <th className="p-3">Artist</th>
                <th className="p-3">Videos</th>
                <th className="p-3">Followers</th>
                <th className="p-3">Total Earnings</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {artistReport.slice(0, 10).map((art, idx) => (
                <tr key={art.id || idx} className="hover:bg-neutral-800/40">
                  <td className="p-3 font-mono text-neutral-500 font-bold">{idx + 1}</td>
                  <td className="p-3 font-bold text-white">{art.name}</td>
                  <td className="p-3 text-neutral-300">{art.videos_count}</td>
                  <td className="p-3 text-neutral-300">{Number(art.subscribers).toLocaleString()}</td>
                  <td className="p-3 font-bold text-amber-400">
                    {Number(art.total_earnings).toLocaleString()} RWF
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold capitalize">
                      {art.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
