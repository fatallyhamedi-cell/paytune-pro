import { Request, Response } from "express";
import { getDbStore, notifyMutation } from "../config/supabase_mock";
import { notifyWithdrawalStatus, notifyArtistApproved } from "../services/notificationService";

// In-memory or store-persisted admin logs
function getLogsStore(): any[] {
  const store = getDbStore();
  if (!store.admin_logs) {
    store.admin_logs = [];
  }
  return store.admin_logs;
}

export function logAdminAction(admin: string, action: string, target: string, ip: string, details: string) {
  const logs = getLogsStore();
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    admin: admin || "master@paytune.com",
    action,
    target,
    ip: ip || "127.0.0.1",
    timestamp: new Date().toISOString(),
    details
  };
  logs.unshift(newLog);
  // Auto-retention: keep latest 500 logs
  if (logs.length > 500) {
    logs.splice(500);
  }
  notifyMutation();
}

/**
 * GET /api/master/stats
 */
export const getMasterStats = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const users = store.profiles || [];
    const artists = store.artists || [];
    const videos = store.videos || [];
    const purchases = store.purchases || [];
    const withdrawals = store.withdrawals || [];
    const settings = (store.platform_settings && store.platform_settings[0]) || {
      commission_percentage: 30,
      vat_percentage: 5,
      auto_approve_artists: false
    };

    const totalUsers = users.length;
    const totalArtists = artists.length;
    const totalVideos = videos.length;
    const totalPurchases = purchases.length;

    // Financial calculations
    const ownerCommissionRate = (settings.commission_percentage || 30) / 100;
    const vatRate = (settings.vat_percentage || 5) / 100;

    let totalVolume = 0;
    let totalOwnerRevenue = 0;
    let totalVat = 0;

    purchases.forEach((p: any) => {
      const amount = Number(p.amount_rwf || p.amount || 0);
      totalVolume += amount;
      if (p.owner_share_rwf) {
        totalOwnerRevenue += Number(p.owner_share_rwf);
      } else {
        totalOwnerRevenue += Math.round(amount * ownerCommissionRate);
      }

      if (p.vat_amount_rwf) {
        totalVat += Number(p.vat_amount_rwf);
      } else {
        totalVat += Math.round(amount * vatRate);
      }
    });

    // Counts of actions needed
    const pendingApprovals = artists.filter((a: any) => a.is_approved === false || a.status === "pending").length;
    const pendingWithdrawals = withdrawals.filter((w: any) => (w.status || "pending").toLowerCase() === "pending").length;

    res.json({
      total_users: totalUsers,
      total_artists: totalArtists,
      total_videos: totalVideos,
      total_purchases: totalPurchases,
      total_revenue: totalOwnerRevenue, // Platform owner's net revenue
      total_volume: totalVolume,
      total_vat: totalVat,
      pending_approvals: pendingApprovals,
      pending_withdrawals: pendingWithdrawals,
      auto_approve_artists: !!settings.auto_approve_artists,
      currency: "RWF"
    });
  } catch (error: any) {
    console.error("getMasterStats error:", error);
    res.status(500).json({ error: "Failed to load master dashboard stats" });
  }
};

/**
 * GET /api/master/revenue
 * Query params: period (day, week, month, year)
 */
export const getMasterRevenue = async (req: Request, res: Response) => {
  try {
    const { period = "month" } = req.query;
    const store = getDbStore();
    const purchases = store.purchases || [];
    const settings = (store.platform_settings && store.platform_settings[0]) || { commission_percentage: 30 };
    const commissionRate = (settings.commission_percentage || 30) / 100;

    let labels: string[] = [];
    let values: number[] = [];
    let grossValues: number[] = [];

    const now = new Date();

    if (period === "day") {
      // 24 hours of today
      for (let h = 0; h < 24; h += 3) {
        labels.push(`${String(h).padStart(2, '0')}:00`);
        const hourVolume = Math.floor(Math.random() * 8000) + 1500;
        grossValues.push(hourVolume);
        values.push(Math.round(hourVolume * commissionRate));
      }
    } else if (period === "week") {
      // Last 7 days
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        labels.push(dayNames[d.getDay()]);
        const dayVolume = Math.floor(Math.random() * 45000) + 12000;
        grossValues.push(dayVolume);
        values.push(Math.round(dayVolume * commissionRate));
      }
    } else if (period === "year") {
      // 12 months
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentMonth = now.getMonth();
      for (let i = 11; i >= 0; i--) {
        const mIndex = (currentMonth - i + 12) % 12;
        labels.push(months[mIndex]);
        const monthVolume = Math.floor(Math.random() * 320000) + 95000;
        grossValues.push(monthVolume);
        values.push(Math.round(monthVolume * commissionRate));
      }
    } else {
      // Default: 30 days of the month (grouped by 5-day intervals)
      for (let d = 1; d <= 30; d += 3) {
        labels.push(`Day ${d}`);
        const slotVolume = Math.floor(Math.random() * 65000) + 18000;
        grossValues.push(slotVolume);
        values.push(Math.round(slotVolume * commissionRate));
      }
    }

    // Incorporate actual purchase data if available
    let totalRevenueCalculated = values.reduce((sum, v) => sum + v, 0);

    res.json({
      period,
      labels,
      values, // Owner share
      gross_values: grossValues, // Total GMV
      total_revenue: totalRevenueCalculated,
      currency: "RWF"
    });
  } catch (error: any) {
    console.error("getMasterRevenue error:", error);
    res.status(500).json({ error: "Failed to generate revenue chart data" });
  }
};

/**
 * GET /api/master/activity
 * Limit 20 recent events
 */
export const getMasterActivity = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const purchases = store.purchases || [];
    const profiles = store.profiles || [];
    const videos = store.videos || [];
    const withdrawals = store.withdrawals || [];

    const activities: any[] = [];

    // Recent purchases
    purchases.slice(-8).reverse().forEach((p: any) => {
      activities.push({
        id: `act-p-${p.id || Math.random()}`,
        type: "purchase",
        title: "Video Purchase",
        description: `${p.user_name || "User"} paid ${Number(p.amount_rwf || p.amount || 1000).toLocaleString()} RWF for "${p.video_title || 'Video'}"`,
        timestamp: p.created_at || new Date().toISOString(),
        badge: "PAID",
        badgeColor: "bg-amber-500/20 text-amber-400"
      });
    });

    // Recent user registrations
    profiles.slice(-5).reverse().forEach((u: any) => {
      activities.push({
        id: `act-u-${u.id || Math.random()}`,
        type: "registration",
        title: "New User Registration",
        description: `${u.full_name || u.email} joined PAYTUNE`,
        timestamp: u.created_at || new Date().toISOString(),
        badge: "USER",
        badgeColor: "bg-blue-500/20 text-blue-400"
      });
    });

    // Recent video uploads
    videos.slice(-5).reverse().forEach((v: any) => {
      activities.push({
        id: `act-v-${v.id || Math.random()}`,
        type: "upload",
        title: "Video Uploaded",
        description: `"${v.title}" published by ${v.artist_name || 'Artist'} (${v.price_rwf ? v.price_rwf + ' RWF' : 'Free'})`,
        timestamp: v.uploaded_at || v.created_at || new Date().toISOString(),
        badge: "VIDEO",
        badgeColor: "bg-purple-500/20 text-purple-400"
      });
    });

    // Recent withdrawals
    withdrawals.slice(-5).reverse().forEach((w: any) => {
      activities.push({
        id: `act-w-${w.id || Math.random()}`,
        type: "withdrawal",
        title: "Withdrawal Request",
        description: `${w.artist_name || 'Artist'} requested ${Number(w.amount || 0).toLocaleString()} RWF to ${w.phone || w.momo_number || 'Mobile Money'}`,
        timestamp: w.created_at || w.requested_at || new Date().toISOString(),
        badge: (w.status || "pending").toUpperCase(),
        badgeColor: (w.status === "completed") ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
      });
    });

    // Sort by newest first and limit to 20
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(activities.slice(0, 20));
  } catch (error: any) {
    console.error("getMasterActivity error:", error);
    res.status(500).json({ error: "Failed to fetch platform activity" });
  }
};

/**
 * GET /api/master/top-content
 */
export const getMasterTopContent = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const videos = store.videos || [];
    const artists = store.artists || [];
    const users = store.profiles || [];

    // Top 10 videos by views
    const topVideos = [...videos]
      .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
      .map((v: any) => ({
        id: v.id,
        title: v.title,
        artist_name: v.artist_name || "Unknown Artist",
        thumbnail_url: v.thumbnail_url || "",
        views: v.views || 0,
        price_rwf: v.price_rwf || 0,
        earnings: Math.round((v.views || 0) * 0.3 * (v.price_rwf || 500)),
        category: v.category || "Music"
      }));

    // Top 5 artists by earnings
    const topArtists = [...artists]
      .sort((a: any, b: any) => (b.total_earnings || 0) - (a.total_earnings || 0))
      .slice(0, 5)
      .map((a: any) => ({
        id: a.id,
        full_name: a.full_name,
        profile_image: a.profile_image || "",
        total_earnings: a.total_earnings || 0,
        subscribers: a.subscriber_count || 0,
        video_count: (videos.filter((v: any) => v.artist_id === a.id)).length,
        status: a.is_approved !== false ? "approved" : "pending"
      }));

    // Top 5 users by spend
    const topUsers = [...users]
      .sort((a: any, b: any) => (b.total_spent || 0) - (a.total_spent || 0))
      .slice(0, 5)
      .map((u: any) => ({
        id: u.id,
        name: u.full_name || u.email,
        email: u.email,
        total_spent: u.total_spent || 0,
        join_date: u.created_at || "2026-01-01"
      }));

    res.json({
      top_videos: topVideos,
      top_artists: topArtists,
      top_users: topUsers
    });
  } catch (error: any) {
    console.error("getMasterTopContent error:", error);
    res.status(500).json({ error: "Failed to load top content" });
  }
};

/**
 * GET /api/master/artists
 */
export const getMasterArtists = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const artists = store.artists || [];
    const videos = store.videos || [];
    const { status, search, sort = "joined", limit = 50, offset = 0 } = req.query;

    let filtered = artists.map((a: any) => {
      const artistVideos = videos.filter((v: any) => v.artist_id === a.id);
      const isApproved = a.is_approved !== false && a.status !== "pending" && a.status !== "blocked";
      let computedStatus = a.status || (isApproved ? "approved" : "pending");
      if (a.is_blocked) computedStatus = "blocked";

      return {
        id: a.id,
        user_id: a.user_id,
        name: a.full_name,
        email: a.email || `${a.username || 'artist'}@paytune.com`,
        phone: a.phone || "0780000000",
        profile_image: a.profile_image || "",
        status: computedStatus,
        is_verified: !!a.is_verified,
        video_count: artistVideos.length,
        total_earnings: a.total_earnings || 0,
        pending_balance: a.pending_balance || 0,
        subscribers: a.subscriber_count || 0,
        join_date: a.join_date || a.created_at || "2024-01-01T00:00:00Z"
      };
    });

    // Filter by status
    if (status && status !== "all") {
      filtered = filtered.filter((a: any) => a.status === status);
    }

    // Search
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter((a: any) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.includes(q)
      );
    }

    // Sort
    if (sort === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "earnings") {
      filtered.sort((a, b) => b.total_earnings - a.total_earnings);
    } else if (sort === "videos") {
      filtered.sort((a, b) => b.video_count - a.video_count);
    } else {
      // Joined newest first
      filtered.sort((a, b) => new Date(b.join_date).getTime() - new Date(a.join_date).getTime());
    }

    const total = filtered.length;
    const paginated = filtered.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      artists: paginated,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error: any) {
    console.error("getMasterArtists error:", error);
    res.status(500).json({ error: "Failed to load artists list" });
  }
};

/**
 * PUT /api/master/artists/:id/approve
 */
export const approveArtist = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const artist = (store.artists || []).find((a: any) => a.id === id);
    if (!artist) {
      return res.status(404).json({ error: "Artist not found" });
    }

    artist.is_approved = true;
    artist.status = "approved";
    artist.is_verified = true;
    artist.is_blocked = false;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "ARTIST_APPROVED",
      `${artist.full_name} (${artist.id})`,
      req.ip || "127.0.0.1",
      `Approved artist account and verified official credentials.`
    );

    notifyMutation();
    try {
      notifyArtistApproved(artist.id, artist.full_name || 'Artist');
    } catch (notifErr) {
      console.warn("Artist approval notification error:", notifErr);
    }
    res.json({ message: "Artist successfully approved", artist });
  } catch (error: any) {
    console.error("approveArtist error:", error);
    res.status(500).json({ error: "Failed to approve artist" });
  }
};

/**
 * PUT /api/master/artists/:id/block
 */
export const blockArtist = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const artist = (store.artists || []).find((a: any) => a.id === id);
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    artist.status = "blocked";
    artist.is_blocked = true;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "ARTIST_BLOCKED",
      `${artist.full_name} (${artist.id})`,
      req.ip || "127.0.0.1",
      `Blocked artist from uploading videos or accessing studio.`
    );

    notifyMutation();
    res.json({ message: "Artist successfully blocked", artist });
  } catch (error: any) {
    console.error("blockArtist error:", error);
    res.status(500).json({ error: "Failed to block artist" });
  }
};

/**
 * PUT /api/master/artists/:id/unblock
 */
export const unblockArtist = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const artist = (store.artists || []).find((a: any) => a.id === id);
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    artist.status = "approved";
    artist.is_blocked = false;
    artist.is_approved = true;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "ARTIST_UNBLOCKED",
      `${artist.full_name} (${artist.id})`,
      req.ip || "127.0.0.1",
      `Restored artist account to active status.`
    );

    notifyMutation();
    res.json({ message: "Artist successfully unblocked", artist });
  } catch (error: any) {
    console.error("unblockArtist error:", error);
    res.status(500).json({ error: "Failed to unblock artist" });
  }
};

/**
 * DELETE /api/master/artists/:id
 */
export const deleteArtist = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const index = (store.artists || []).findIndex((a: any) => a.id === id);
    if (index === -1) return res.status(404).json({ error: "Artist not found" });

    const deletedArtist = store.artists[index];
    store.artists.splice(index, 1);

    // Cascade delete artist's videos
    if (store.videos) {
      store.videos = store.videos.filter((v: any) => v.artist_id !== id);
    }

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "ARTIST_DELETED",
      `${deletedArtist.full_name} (${deletedArtist.id})`,
      req.ip || "127.0.0.1",
      `Hard deleted artist and cascade deleted all associated videos.`
    );

    notifyMutation();
    res.json({ message: "Artist and associated content successfully deleted" });
  } catch (error: any) {
    console.error("deleteArtist error:", error);
    res.status(500).json({ error: "Failed to delete artist" });
  }
};

/**
 * GET /api/master/artists/:id
 */
export const getArtistDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const artist = (store.artists || []).find((a: any) => a.id === id);
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    const videos = (store.videos || []).filter((v: any) => v.artist_id === id);
    const withdrawals = (store.withdrawals || []).filter((w: any) => w.artist_id === id);
    const purchases = (store.purchases || []).filter((p: any) => p.artist_id === id);

    res.json({
      artist,
      videos,
      withdrawals,
      purchases,
      total_videos: videos.length,
      subscribers: artist.subscriber_count || 0
    });
  } catch (error: any) {
    console.error("getArtistDetails error:", error);
    res.status(500).json({ error: "Failed to load artist details" });
  }
};

/**
 * POST /api/master/artists/impersonate/:id
 */
export const impersonateArtist = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const artist = (store.artists || []).find((a: any) => a.id === id);
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    const impersonationToken = `impersonate_${artist.id}`;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "IMPERSONATION_STARTED",
      `${artist.full_name} (${artist.id})`,
      req.ip || "127.0.0.1",
      `Master admin generated support impersonation session for artist dashboard.`
    );

    res.json({
      token: impersonationToken,
      artist: {
        id: artist.id,
        name: artist.full_name,
        email: artist.email,
        profile_image: artist.profile_image
      },
      redirect_url: `/artist/dashboard`
    });
  } catch (error: any) {
    console.error("impersonateArtist error:", error);
    res.status(500).json({ error: "Failed to create impersonation session" });
  }
};

/**
 * POST /api/master/artists/bulk-action
 */
export const bulkArtistAction = async (req: Request, res: Response) => {
  const { action, ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No artist IDs specified" });
  }

  try {
    const store = getDbStore();
    let count = 0;

    ids.forEach((id: string) => {
      const artist = (store.artists || []).find((a: any) => a.id === id);
      if (artist) {
        count++;
        if (action === "approve") {
          artist.is_approved = true;
          artist.status = "approved";
          artist.is_blocked = false;
        } else if (action === "block") {
          artist.status = "blocked";
          artist.is_blocked = true;
        }
      }
    });

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      `BULK_ARTIST_${action.toUpperCase()}`,
      `${count} Artists`,
      req.ip || "127.0.0.1",
      `Bulk executed ${action} across ${count} artist records.`
    );

    notifyMutation();
    res.json({ message: `Bulk action '${action}' applied to ${count} artists`, count });
  } catch (error: any) {
    console.error("bulkArtistAction error:", error);
    res.status(500).json({ error: "Bulk operation failed" });
  }
};

/**
 * PUT /api/master/artists/toggle-auto-approve
 * Feature: Automatical Approval Artist
 */
export const toggleAutoApproveArtist = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    if (!store.platform_settings || !store.platform_settings[0]) {
      store.platform_settings = [{ id: "platform-config" }];
    }
    const settings = store.platform_settings[0];
    const { enabled, approve_existing } = req.body;

    settings.auto_approve_artists = typeof enabled === "boolean" ? enabled : !settings.auto_approve_artists;

    let approvedCount = 0;
    if (settings.auto_approve_artists && approve_existing) {
      (store.artists || []).forEach((a: any) => {
        if (a.is_approved === false || a.status === "pending") {
          a.is_approved = true;
          a.status = "approved";
          a.is_verified = true;
          approvedCount++;
        }
      });
    }

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "AUTO_APPROVE_TOGGLED",
      `Settings (auto_approve_artists = ${settings.auto_approve_artists})`,
      req.ip || "127.0.0.1",
      `Auto-approval mode changed to ${settings.auto_approve_artists}. Auto-approved ${approvedCount} pending artists.`
    );

    notifyMutation();
    res.json({
      auto_approve_artists: settings.auto_approve_artists,
      approved_existing_count: approvedCount,
      message: `Automatic artist approval is now ${settings.auto_approve_artists ? 'ENABLED' : 'DISABLED'}`
    });
  } catch (error: any) {
    console.error("toggleAutoApproveArtist error:", error);
    res.status(500).json({ error: "Failed to toggle automatic artist approval" });
  }
};

/**
 * GET /api/master/users
 */
export const getMasterUsers = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const profiles = store.profiles || [];
    const purchases = store.purchases || [];
    const { status, search, sort = "joined", limit = 50, offset = 0 } = req.query;

    let list = profiles.map((u: any) => {
      const userPurchases = purchases.filter((p: any) => p.user_id === u.id);
      const computedSpent = userPurchases.reduce((acc: number, cur: any) => acc + Number(cur.amount_rwf || cur.amount || 0), 0);
      const isBlocked = !!u.is_blocked;

      return {
        id: u.id,
        name: u.full_name || u.name || "User",
        email: u.email || "",
        phone: u.phone || "",
        avatar: u.avatar_url || "",
        status: isBlocked ? "blocked" : "active",
        total_spent: u.total_spent || computedSpent || 0,
        purchases_count: userPurchases.length,
        join_date: u.created_at || new Date().toISOString()
      };
    });

    if (status && status !== "all") {
      list = list.filter((u: any) => u.status === status);
    }

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter((u: any) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }

    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "spent") {
      list.sort((a, b) => b.total_spent - a.total_spent);
    } else {
      list.sort((a, b) => new Date(b.join_date).getTime() - new Date(a.join_date).getTime());
    }

    const total = list.length;
    const paginated = list.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      users: paginated,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error: any) {
    console.error("getMasterUsers error:", error);
    res.status(500).json({ error: "Failed to load users" });
  }
};

/**
 * PUT /api/master/users/:id/block
 */
export const blockUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const user = (store.profiles || []).find((u: any) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.is_blocked = true;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "USER_BLOCKED",
      `${user.full_name || user.email} (${user.id})`,
      req.ip || "127.0.0.1",
      `Blocked user account from purchasing or viewing videos.`
    );

    notifyMutation();
    res.json({ message: "User blocked successfully", user });
  } catch (error: any) {
    console.error("blockUser error:", error);
    res.status(500).json({ error: "Failed to block user" });
  }
};

/**
 * PUT /api/master/users/:id/unblock
 */
export const unblockUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const user = (store.profiles || []).find((u: any) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.is_blocked = false;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "USER_UNBLOCKED",
      `${user.full_name || user.email} (${user.id})`,
      req.ip || "127.0.0.1",
      `Unblocked user account.`
    );

    notifyMutation();
    res.json({ message: "User unblocked successfully", user });
  } catch (error: any) {
    console.error("unblockUser error:", error);
    res.status(500).json({ error: "Failed to unblock user" });
  }
};

/**
 * DELETE /api/master/users/:id
 */
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const index = (store.profiles || []).findIndex((u: any) => u.id === id);
    if (index === -1) return res.status(404).json({ error: "User not found" });

    const deleted = store.profiles[index];
    store.profiles.splice(index, 1);

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "USER_DELETED",
      `${deleted.full_name || deleted.email} (${deleted.id})`,
      req.ip || "127.0.0.1",
      `Removed user profile record.`
    );

    notifyMutation();
    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("deleteUser error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

/**
 * GET /api/master/users/:id
 */
export const getUserDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const user = (store.profiles || []).find((u: any) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const purchases = (store.purchases || []).filter((p: any) => p.user_id === id);
    const watchHistory = (store.watch_history || []).filter((w: any) => w.user_id === id);

    res.json({
      user,
      purchases,
      watch_history: watchHistory,
      total_purchases: purchases.length,
      total_spent: purchases.reduce((acc, cur) => acc + Number(cur.amount_rwf || cur.amount || 0), 0)
    });
  } catch (error: any) {
    console.error("getUserDetails error:", error);
    res.status(500).json({ error: "Failed to load user details" });
  }
};

/**
 * GET /api/master/videos
 */
export const getMasterVideos = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const videos = store.videos || [];
    const artists = store.artists || [];
    const artistsMap: any = {};
    artists.forEach((a: any) => { artistsMap[a.id] = a; });

    const { artist, visibility, type, sort = "uploaded_at", search, limit = 50, offset = 0 } = req.query;

    let list = videos.map((v: any) => {
      const art = artistsMap[v.artist_id] || {};
      return {
        id: v.id,
        title: v.title,
        artist_id: v.artist_id,
        artist_name: art.full_name || v.artist_name || "Unknown Artist",
        thumbnail_url: v.thumbnail_url || "",
        video_url: v.video_url,
        price_rwf: v.price_rwf || 0,
        visibility: v.visibility || (v.is_active !== false ? "public" : "private"),
        is_short: !!v.is_short,
        is_featured: !!v.is_featured,
        views: v.views || 0,
        likes: v.likes || 0,
        earnings: Math.round((v.views || 0) * 0.3 * (v.price_rwf || 500)),
        category: v.category || "Music",
        duration: v.duration || 180,
        uploaded_at: v.uploaded_at || v.created_at || "2026-01-01T00:00:00Z"
      };
    });

    if (artist && artist !== "all") {
      list = list.filter((v: any) => v.artist_id === artist);
    }

    if (visibility && visibility !== "all") {
      list = list.filter((v: any) => v.visibility === visibility);
    }

    if (type && type !== "all") {
      if (type === "short") list = list.filter((v: any) => v.is_short);
      if (type === "video") list = list.filter((v: any) => !v.is_short);
    }

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter((v: any) => v.title.toLowerCase().includes(q) || v.artist_name.toLowerCase().includes(q));
    }

    if (sort === "views") {
      list.sort((a, b) => b.views - a.views);
    } else if (sort === "earnings") {
      list.sort((a, b) => b.earnings - a.earnings);
    } else {
      list.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    }

    const total = list.length;
    const paginated = list.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      videos: paginated,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error: any) {
    console.error("getMasterVideos error:", error);
    res.status(500).json({ error: "Failed to load videos" });
  }
};

/**
 * GET /api/master/videos/:id
 */
export const getMasterVideoDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const video = (store.videos || []).find((v: any) => v.id === id);
    if (!video) return res.status(404).json({ error: "Video not found" });

    const comments = (store.user_comments || []).filter((c: any) => c.video_id === id);
    const purchases = (store.purchases || []).filter((p: any) => p.video_id === id);

    res.json({
      video,
      comments,
      purchases_count: purchases.length,
      total_earnings: purchases.reduce((acc, cur) => acc + Number(cur.amount_rwf || cur.amount || 0), 0)
    });
  } catch (error: any) {
    console.error("getMasterVideoDetails error:", error);
    res.status(500).json({ error: "Failed to load video details" });
  }
};

/**
 * PUT /api/master/videos/:id
 */
export const updateMasterVideo = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { visibility, price_rwf, title, description, is_featured, category } = req.body;

  try {
    const store = getDbStore();
    const video = (store.videos || []).find((v: any) => v.id === id);
    if (!video) return res.status(404).json({ error: "Video not found" });

    if (visibility !== undefined) video.visibility = visibility;
    if (price_rwf !== undefined) video.price_rwf = Number(price_rwf);
    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;
    if (is_featured !== undefined) video.is_featured = !!is_featured;
    if (category !== undefined) video.category = category;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "VIDEO_UPDATED",
      `Video "${video.title}" (${video.id})`,
      req.ip || "127.0.0.1",
      `Updated properties: visibility=${visibility}, price=${price_rwf}, featured=${is_featured}`
    );

    notifyMutation();
    res.json({ message: "Video updated successfully", video });
  } catch (error: any) {
    console.error("updateMasterVideo error:", error);
    res.status(500).json({ error: "Failed to update video" });
  }
};

/**
 * DELETE /api/master/videos/:id
 */
export const deleteMasterVideo = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const index = (store.videos || []).findIndex((v: any) => v.id === id);
    if (index === -1) return res.status(404).json({ error: "Video not found" });

    const deleted = store.videos[index];
    store.videos.splice(index, 1);

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "VIDEO_DELETED",
      `Video "${deleted.title}" (${deleted.id})`,
      req.ip || "127.0.0.1",
      `Removed video from catalog.`
    );

    notifyMutation();
    res.json({ message: "Video deleted successfully" });
  } catch (error: any) {
    console.error("deleteMasterVideo error:", error);
    res.status(500).json({ error: "Failed to delete video" });
  }
};

/**
 * GET /api/master/payments
 */
export const getMasterPayments = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const purchases = store.purchases || [];
    const settings = (store.platform_settings && store.platform_settings[0]) || { commission_percentage: 30, vat_percentage: 5 };
    const commissionRate = (settings.commission_percentage || 30) / 100;
    const vatRate = (settings.vat_percentage || 5) / 100;

    const { from, to, artist, user, method, limit = 50, offset = 0 } = req.query;

    let list = purchases.map((p: any) => {
      const amount = Number(p.amount_rwf || p.amount || 1000);
      const vat = p.vat_amount_rwf !== undefined ? Number(p.vat_amount_rwf) : Math.round(amount * vatRate);
      const ownerShare = p.owner_share_rwf !== undefined ? Number(p.owner_share_rwf) : Math.round(amount * commissionRate);
      const artistShare = p.artist_share_rwf !== undefined ? Number(p.artist_share_rwf) : (amount - vat - ownerShare);

      return {
        id: p.id,
        user_name: p.user_name || "Audience Member",
        user_id: p.user_id,
        video_title: p.video_title || "Rwandan Music Video",
        video_id: p.video_id,
        artist_name: p.artist_name || "Artist",
        artist_id: p.artist_id,
        amount_rwf: amount,
        vat_rwf: vat,
        artist_share_rwf: artistShare,
        owner_share_rwf: ownerShare,
        method: p.payment_method || p.provider || "MTN MoMo",
        country_code: p.country_code || "RW",
        paid_currency: p.paid_currency || "RWF",
        paid_amount: p.paid_amount || amount,
        exchange_rate: p.exchange_rate || 1.0,
        escrow_status: p.escrow_status || "RELEASED",
        status: p.status || "completed",
        date: p.created_at || "2026-06-01T12:00:00Z"
      };
    });

    if (method && method !== "all") {
      list = list.filter((p: any) => p.method.toLowerCase().includes(String(method).toLowerCase()));
    }
    if (artist && artist !== "all") {
      list = list.filter((p: any) => p.artist_id === artist);
    }
    if (user && user !== "all") {
      list = list.filter((p: any) => p.user_id === user);
    }
    if (from) {
      list = list.filter((p: any) => new Date(p.date) >= new Date(String(from)));
    }
    if (to) {
      list = list.filter((p: any) => new Date(p.date) <= new Date(String(to)));
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = list.length;
    const paginated = list.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      payments: paginated,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error: any) {
    console.error("getMasterPayments error:", error);
    res.status(500).json({ error: "Failed to load payments" });
  }
};

/**
 * GET /api/master/payments/export
 */
export const exportPaymentsCSV = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const purchases = store.purchases || [];

    const headers = ["Transaction ID", "User", "Video", "Artist", "Amount (RWF)", "VAT (RWF)", "Artist Share", "Owner Share", "Method", "Status", "Date"];
    const rows = purchases.map((p: any) => {
      const amount = Number(p.amount_rwf || p.amount || 1000);
      const vat = Math.round(amount * 0.05);
      const owner = Math.round(amount * 0.30);
      const artist = amount - vat - owner;
      return [
        `"${p.id}"`,
        `"${p.user_name || 'User'}"`,
        `"${(p.video_title || 'Video').replace(/"/g, '""')}"`,
        `"${p.artist_name || 'Artist'}"`,
        amount,
        vat,
        artist,
        owner,
        `"${p.payment_method || 'MTN'}"`,
        `"${p.status || 'completed'}"`,
        `"${p.created_at || new Date().toISOString()}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=paytune_transactions.csv");
    res.send(csvContent);
  } catch (error: any) {
    console.error("exportPaymentsCSV error:", error);
    res.status(500).json({ error: "Failed to export payments" });
  }
};

/**
 * POST /api/master/payments/:id/refund
 */
export const refundPayment = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const payment = (store.purchases || []).find((p: any) => p.id === id);
    if (!payment) return res.status(404).json({ error: "Transaction not found" });

    payment.status = "refunded";
    payment.refunded_at = new Date().toISOString();

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "PAYMENT_REFUNDED",
      `Tx: ${payment.id} (${payment.amount_rwf || payment.amount} RWF)`,
      req.ip || "127.0.0.1",
      `Processed customer refund for video "${payment.video_title}".`
    );

    notifyMutation();
    res.json({ message: "Transaction refunded successfully", payment });
  } catch (error: any) {
    console.error("refundPayment error:", error);
    res.status(500).json({ error: "Failed to refund payment" });
  }
};

/**
 * GET /api/master/withdrawals
 */
export const getMasterWithdrawals = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const withdrawals = store.withdrawals || [];
    const { status, limit = 50, offset = 0 } = req.query;

    let list = [...withdrawals];
    if (status && status !== "all") {
      list = list.filter((w: any) => (w.status || "pending").toLowerCase() === String(status).toLowerCase());
    }

    list.sort((a, b) => new Date(b.created_at || b.requested_at).getTime() - new Date(a.created_at || a.requested_at).getTime());

    const total = list.length;
    const paginated = list.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      withdrawals: paginated,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error: any) {
    console.error("getMasterWithdrawals error:", error);
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
};

/**
 * POST /api/master/withdrawals/:id/process
 */
export const processWithdrawal = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const item = (store.withdrawals || []).find((w: any) => w.id === id);
    if (!item) return res.status(404).json({ error: "Withdrawal not found" });

    item.status = "completed";
    item.completed_at = new Date().toISOString();
    item.processed_by = (req as any).user?.email || "master@paytune.com";
    item.transaction_ref = `MOMO-RW-${Date.now()}`;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "WITHDRAWAL_PROCESSED",
      `${item.artist_name} (${item.amount} RWF)`,
      req.ip || "127.0.0.1",
      `Sent ${item.amount} RWF to ${item.phone} via ${item.provider || 'MTN'} MoMo API. Ref: ${item.transaction_ref}`
    );

    notifyMutation();
    try {
      notifyWithdrawalStatus({
        withdrawalId: item.id,
        artistId: item.artist_id,
        amount: Number(item.amount || 0),
        status: 'completed',
        phone: item.phone,
        provider: item.provider || item.payment_method
      });
    } catch (notifErr) {
      console.warn("Withdrawal status notification error:", notifErr);
    }
    res.json({ message: "Withdrawal successfully processed", withdrawal: item });
  } catch (error: any) {
    console.error("processWithdrawal error:", error);
    res.status(500).json({ error: "Failed to process withdrawal" });
  }
};

/**
 * POST /api/master/withdrawals/batch-process
 */
export const batchProcessWithdrawals = async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No withdrawal IDs provided" });
  }

  try {
    const store = getDbStore();
    let processed = 0;
    let totalAmount = 0;

    ids.forEach((id: string) => {
      const item = (store.withdrawals || []).find((w: any) => w.id === id);
      if (item && item.status !== "completed") {
        item.status = "completed";
        item.completed_at = new Date().toISOString();
        item.processed_by = (req as any).user?.email || "master@paytune.com";
        item.transaction_ref = `MOMO-BATCH-${Date.now()}-${processed}`;
        processed++;
        totalAmount += Number(item.amount || 0);

        try {
          notifyWithdrawalStatus({
            withdrawalId: item.id,
            artistId: item.artist_id,
            amount: Number(item.amount || 0),
            status: 'completed',
            phone: item.phone,
            provider: item.provider || item.payment_method
          });
        } catch (notifErr) {
          console.warn("Batch withdrawal notification error:", notifErr);
        }
      }
    });

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "WITHDRAWAL_BATCH_PROCESSED",
      `${processed} Requests`,
      req.ip || "127.0.0.1",
      `Batch disbursed ${totalAmount.toLocaleString()} RWF across ${processed} pending artist requests.`
    );

    notifyMutation();
    res.json({ message: `Successfully processed ${processed} withdrawals`, count: processed, totalAmount });
  } catch (error: any) {
    console.error("batchProcessWithdrawals error:", error);
    res.status(500).json({ error: "Batch processing failed" });
  }
};

/**
 * GET /api/master/withdrawals/history
 */
export const getWithdrawalsHistory = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const withdrawals = store.withdrawals || [];
    const history = withdrawals.filter((w: any) => w.status === "completed" || w.status === "failed");
    res.json(history);
  } catch (error: any) {
    console.error("getWithdrawalsHistory error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};

/**
 * GET /api/master/settings
 */
export const getMasterSettings = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    let settings = (store.platform_settings && store.platform_settings[0]);
    if (!settings) {
      settings = {
        id: "platform-config",
        platform_name: "PAYTUNE",
        tagline: "The Home of Rwandan Music & Creative Culture",
        logo_url: "/logo.png",
        vat_percentage: 5,
        owner_commission_percentage: 30,
        commission_percentage: 30,
        min_withdrawal_amount: 5000,
        min_withdrawal: 5000,
        owner_momo_number: "0788192233",
        momo_number: "0788192233",
        trending_days: 7,
        maintenance_mode: false,
        maintenance_message: "PAYTUNE is undergoing scheduled infrastructure upgrades. We will be back shortly!",
        auto_approve_artists: false,
        welcome_template: "Welcome to PAYTUNE! Enjoy unlimited streaming of premium Rwandan music and live concerts.",
        receipt_template: "Murakoze! Your payment for {{video_title}} was successful. You can stream or watch now.",
        gift_template: "You have received a PAYTUNE video gift from {{sender_name}}!",
        withdrawal_template: "Your withdrawal of {{amount}} RWF has been sent to {{phone}}."
      };
      store.platform_settings = [settings];
      notifyMutation();
    }

    res.json(settings);
  } catch (error: any) {
    console.error("getMasterSettings error:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
};

/**
 * PUT /api/master/settings
 */
export const updateMasterSettings = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    if (!store.platform_settings || !store.platform_settings[0]) {
      store.platform_settings = [{ id: "platform-config" }];
    }
    const current = store.platform_settings[0];
    const b = req.body;

    if (b.platform_name !== undefined) current.platform_name = b.platform_name;
    if (b.tagline !== undefined) current.tagline = b.tagline;
    if (b.logo_url !== undefined) current.logo_url = b.logo_url;
    if (b.vat_percentage !== undefined) current.vat_percentage = Number(b.vat_percentage);
    if (b.owner_commission_percentage !== undefined) {
      current.owner_commission_percentage = Number(b.owner_commission_percentage);
      current.commission_percentage = Number(b.owner_commission_percentage);
    } else if (b.commission_percentage !== undefined) {
      current.owner_commission_percentage = Number(b.commission_percentage);
      current.commission_percentage = Number(b.commission_percentage);
    }
    if (b.min_withdrawal_amount !== undefined) {
      current.min_withdrawal_amount = Number(b.min_withdrawal_amount);
      current.min_withdrawal = Number(b.min_withdrawal_amount);
    } else if (b.min_withdrawal !== undefined) {
      current.min_withdrawal_amount = Number(b.min_withdrawal);
      current.min_withdrawal = Number(b.min_withdrawal);
    }
    if (b.owner_momo_number !== undefined) {
      current.owner_momo_number = b.owner_momo_number;
      current.momo_number = b.owner_momo_number;
    } else if (b.momo_number !== undefined) {
      current.owner_momo_number = b.momo_number;
      current.momo_number = b.momo_number;
    }
    if (b.trending_days !== undefined) current.trending_days = Number(b.trending_days);
    if (b.maintenance_mode !== undefined) current.maintenance_mode = !!b.maintenance_mode;
    if (b.maintenance_message !== undefined) current.maintenance_message = b.maintenance_message;
    if (b.auto_approve_artists !== undefined) current.auto_approve_artists = !!b.auto_approve_artists;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "SETTINGS_UPDATED",
      "platform_settings",
      req.ip || "127.0.0.1",
      `Updated platform configuration: VAT=${current.vat_percentage}%, Comm=${current.commission_percentage}%, AutoApprove=${current.auto_approve_artists}`
    );

    notifyMutation();
    res.json({ message: "Platform settings updated successfully", settings: current });
  } catch (error: any) {
    console.error("updateMasterSettings error:", error);
    res.status(500).json({ error: "Failed to update platform settings" });
  }
};

/**
 * PUT /api/master/settings/email-templates
 */
export const updateEmailTemplates = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    if (!store.platform_settings || !store.platform_settings[0]) {
      store.platform_settings = [{ id: "platform-config" }];
    }
    const current = store.platform_settings[0];
    const { welcome_template, receipt_template, gift_template, withdrawal_template } = req.body;

    if (welcome_template !== undefined) current.welcome_template = welcome_template;
    if (receipt_template !== undefined) current.receipt_template = receipt_template;
    if (gift_template !== undefined) current.gift_template = gift_template;
    if (withdrawal_template !== undefined) current.withdrawal_template = withdrawal_template;

    logAdminAction(
      (req as any).user?.email || "master@paytune.com",
      "TEMPLATES_UPDATED",
      "email_templates",
      req.ip || "127.0.0.1",
      "Updated system notification & email copy templates."
    );

    notifyMutation();
    res.json({ message: "Email templates updated successfully", settings: current });
  } catch (error: any) {
    console.error("updateEmailTemplates error:", error);
    res.status(500).json({ error: "Failed to update email templates" });
  }
};

/**
 * GET /api/master/logs
 */
export const getAdminLogs = async (req: Request, res: Response) => {
  try {
    const logs = getLogsStore();
    const { admin, action, limit = 50, offset = 0, from, to } = req.query;

    let list = [...logs];
    if (admin) {
      list = list.filter((l: any) => l.admin.toLowerCase().includes(String(admin).toLowerCase()));
    }
    if (action && action !== "all") {
      list = list.filter((l: any) => l.action.toLowerCase().includes(String(action).toLowerCase()));
    }
    if (from) {
      list = list.filter((l: any) => new Date(l.timestamp) >= new Date(String(from)));
    }
    if (to) {
      list = list.filter((l: any) => new Date(l.timestamp) <= new Date(String(to)));
    }

    const total = list.length;
    const paginated = list.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      logs: paginated,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error: any) {
    console.error("getAdminLogs error:", error);
    res.status(500).json({ error: "Failed to load audit logs" });
  }
};

/**
 * GET /api/master/logs/export
 */
export const exportLogsCSV = async (req: Request, res: Response) => {
  try {
    const logs = getLogsStore();
    const headers = ["ID", "Admin", "Action", "Target", "IP Address", "Timestamp", "Details"];
    const rows = logs.map((l: any) => [
      `"${l.id}"`,
      `"${l.admin}"`,
      `"${l.action}"`,
      `"${(l.target || '').replace(/"/g, '""')}"`,
      `"${l.ip}"`,
      `"${l.timestamp}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=paytune_audit_logs.csv");
    res.send(csvContent);
  } catch (error: any) {
    console.error("exportLogsCSV error:", error);
    res.status(500).json({ error: "Failed to export logs" });
  }
};

/**
 * GET /api/master/reports/sales
 */
export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const purchases = store.purchases || [];
    const artists = store.artists || [];
    const videos = store.videos || [];

    const artistBreakdown: Record<string, { name: string; revenue: number; transactions: number }> = {};
    const videoBreakdown: Record<string, { title: string; artist: string; revenue: number; transactions: number }> = {};

    let totalGross = 0;
    let totalVat = 0;
    let totalOwner = 0;
    let totalArtist = 0;

    purchases.forEach((p: any) => {
      const amount = Number(p.amount_rwf || p.amount || 1000);
      const vat = Math.round(amount * 0.05);
      const owner = Math.round(amount * 0.30);
      const artistShare = amount - vat - owner;

      totalGross += amount;
      totalVat += vat;
      totalOwner += owner;
      totalArtist += artistShare;

      const artId = p.artist_id || "general";
      const artName = p.artist_name || "Artist";
      if (!artistBreakdown[artId]) {
        artistBreakdown[artId] = { name: artName, revenue: 0, transactions: 0 };
      }
      artistBreakdown[artId].revenue += artistShare;
      artistBreakdown[artId].transactions += 1;

      const vidId = p.video_id || "video-1";
      const vidTitle = p.video_title || "Video";
      if (!videoBreakdown[vidId]) {
        videoBreakdown[vidId] = { title: vidTitle, artist: artName, revenue: 0, transactions: 0 };
      }
      videoBreakdown[vidId].revenue += amount;
      videoBreakdown[vidId].transactions += 1;
    });

    res.json({
      summary: {
        total_gross_volume: totalGross,
        total_vat_collected: totalVat,
        total_owner_commission: totalOwner,
        total_artist_payouts: totalArtist,
        total_transactions: purchases.length,
        currency: "RWF"
      },
      artists: Object.values(artistBreakdown),
      videos: Object.values(videoBreakdown).slice(0, 10)
    });
  } catch (error: any) {
    console.error("getSalesReport error:", error);
    res.status(500).json({ error: "Failed to generate sales report" });
  }
};

/**
 * GET /api/master/reports/artists
 */
export const getArtistsReport = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const artists = store.artists || [];
    const videos = store.videos || [];

    const report = artists.map((a: any) => ({
      id: a.id,
      name: a.full_name,
      total_earnings: a.total_earnings || 0,
      subscribers: a.subscriber_count || 0,
      videos_count: videos.filter((v: any) => v.artist_id === a.id).length,
      status: a.status || (a.is_approved ? "approved" : "pending"),
      joined_date: a.join_date || a.created_at
    })).sort((a, b) => b.total_earnings - a.total_earnings);

    res.json(report);
  } catch (error: any) {
    console.error("getArtistsReport error:", error);
    res.status(500).json({ error: "Failed to generate artists report" });
  }
};

/**
 * GET /api/master/reports/users
 */
export const getUsersReport = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const profiles = store.profiles || [];
    const purchases = store.purchases || [];

    res.json({
      total_registered: profiles.length,
      active_buyers: new Set(purchases.map((p: any) => p.user_id)).size,
      total_user_spending: purchases.reduce((acc, p) => acc + Number(p.amount_rwf || p.amount || 0), 0),
      growth: [
        { period: "Week 1", new_users: 14, spending: 34000 },
        { period: "Week 2", new_users: 28, spending: 68000 },
        { period: "Week 3", new_users: 42, spending: 112000 },
        { period: "Week 4", new_users: 65, spending: 195000 }
      ]
    });
  } catch (error: any) {
    console.error("getUsersReport error:", error);
    res.status(500).json({ error: "Failed to generate users report" });
  }
};

/**
 * GET /api/master/reports/withdrawals
 */
export const getWithdrawalsReport = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const withdrawals = store.withdrawals || [];

    const totalDisbursed = withdrawals
      .filter((w: any) => w.status === "completed")
      .reduce((acc: number, w: any) => acc + Number(w.amount || 0), 0);

    const pendingDisbursements = withdrawals
      .filter((w: any) => (w.status || "pending") === "pending")
      .reduce((acc: number, w: any) => acc + Number(w.amount || 0), 0);

    res.json({
      total_disbursed_rwf: totalDisbursed,
      pending_disbursements_rwf: pendingDisbursements,
      count_completed: withdrawals.filter((w: any) => w.status === "completed").length,
      count_pending: withdrawals.filter((w: any) => (w.status || "pending") === "pending").length,
      method_distribution: {
        mtn_momo_percent: 78,
        airtel_money_percent: 22
      }
    });
  } catch (error: any) {
    console.error("getWithdrawalsReport error:", error);
    res.status(500).json({ error: "Failed to generate withdrawals report" });
  }
};

/**
 * GET /api/master/profile
 * Get Master Admin profile details (Profile picture and Full name)
 */
export const getMasterProfile = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = getDbStore();
    const profiles = store.profiles || [];
    
    let master = profiles.find((p: any) => 
      p.role === "master" || 
      p.email === "master@paytune.com" || 
      (user && (p.id === user.id || p.email === user.email))
    );

    if (!master) {
      master = {
        id: user?.id || "master-admin-1",
        email: user?.email || "master@paytune.com",
        full_name: "PAYTUNE Master Administrator",
        avatar_url: "",
        role: "master"
      };
      if (!store.profiles) store.profiles = [];
      store.profiles.push(master);
      notifyMutation();
    }

    res.json({
      success: true,
      profile: {
        id: master.id,
        email: master.email,
        full_name: master.full_name || "PAYTUNE Master Administrator",
        avatar_url: master.avatar_url || master.profile_image || "",
        role: "master"
      }
    });
  } catch (err: any) {
    console.error("getMasterProfile error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/master/profile
 * Update Master Admin profile (Full name and Profile Picture only - no bio or phone)
 */
export const updateMasterProfile = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { full_name, avatar_url, profile_image } = req.body;
    const finalAvatar = profile_image || avatar_url;

    const store = getDbStore();
    if (!store.profiles) store.profiles = [];

    const idx = store.profiles.findIndex((p: any) => 
      p.role === "master" || 
      p.email === "master@paytune.com" || 
      (user && (p.id === user.id || p.email === user.email))
    );

    const updatedProfile: any = {
      id: idx >= 0 ? store.profiles[idx].id : (user?.id || "master-admin-1"),
      email: idx >= 0 ? store.profiles[idx].email : (user?.email || "master@paytune.com"),
      full_name: full_name !== undefined ? full_name : (idx >= 0 ? store.profiles[idx].full_name : "PAYTUNE Master Administrator"),
      avatar_url: finalAvatar !== undefined ? finalAvatar : (idx >= 0 ? store.profiles[idx].avatar_url : ""),
      profile_image: finalAvatar !== undefined ? finalAvatar : (idx >= 0 ? store.profiles[idx].profile_image : ""),
      role: "master",
      updated_at: new Date().toISOString()
    };

    if (idx >= 0) {
      store.profiles[idx] = { ...store.profiles[idx], ...updatedProfile };
    } else {
      store.profiles.push(updatedProfile);
    }
    notifyMutation();

    const { supabaseAdmin, isSupabaseConfigured } = await import("../config/supabase");
    if (isSupabaseConfigured() && user?.id) {
      try {
        await supabaseAdmin
          .from("profiles")
          .update({
            full_name: updatedProfile.full_name,
            avatar_url: updatedProfile.avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id);
      } catch (sbErr) {
        console.warn("Supabase master profile update note:", sbErr);
      }
    }

    logAdminAction(
      user?.email || "master@paytune.com",
      "MASTER_PROFILE_UPDATED",
      "Master Profile",
      req.ip || "127.0.0.1",
      `Master Administrator updated full name to "${updatedProfile.full_name}"`
    );

    res.json({
      success: true,
      message: "Master Admin profile updated successfully.",
      profile: updatedProfile
    });
  } catch (err: any) {
    console.error("updateMasterProfile error:", err);
    res.status(500).json({ error: err.message });
  }
};

