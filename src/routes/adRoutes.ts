import { Router } from "express";
import { authenticate, optionalAuthenticate, checkRole } from "../middleware/auth";
import {
  getAdForVideo,
  recordAdImpression,
  recordAdProgress,
  recordAdClick,
  getMasterAds,
  createMasterAd,
  updateMasterAd,
  deleteMasterAd,
  pauseMasterAd,
  resumeMasterAd,
  endMasterAd,
  getMasterAssignments,
  createMasterAssignment,
  updateMasterAssignment,
  deleteMasterAssignment,
  getMasterAdAnalytics
} from "../controllers/adController";

const router = Router();
const masterAuth = [authenticate, checkRole('master')];

// ==========================================
// 1. Public Video Ad Playback & Analytics
// ==========================================
// Check if a video has an ad (enforces: paid videos NEVER show ads, shorts never show ads)
router.get("/video/:videoId", getAdForVideo);
router.post("/impression", optionalAuthenticate, recordAdImpression);
router.post("/progress", optionalAuthenticate, recordAdProgress);
router.post("/click", optionalAuthenticate, recordAdClick);

// ==========================================
// 2. Master Admin Ads Management & Campaigns
// ==========================================
// Ad Creatives & Campaigns
router.get("/master/list", masterAuth, getMasterAds);
router.post("/master/create", masterAuth, createMasterAd);
router.put("/master/:id", masterAuth, updateMasterAd);
router.delete("/master/:id", masterAuth, deleteMasterAd);
router.post("/master/:id/pause", masterAuth, pauseMasterAd);
router.post("/master/:id/resume", masterAuth, resumeMasterAd);
router.post("/master/:id/end", masterAuth, endMasterAd);

// Direct Campaign Management aliases (/api/ads/campaigns)
router.get("/campaigns", masterAuth, getMasterAds);
router.post("/campaigns", masterAuth, createMasterAd);
router.post("/campaigns/:id/pause", masterAuth, pauseMasterAd);
router.post("/campaigns/:id/resume", masterAuth, resumeMasterAd);
router.post("/campaigns/:id/end", masterAuth, endMasterAd);
router.post("/campaigns/:id/delete", masterAuth, deleteMasterAd);
router.delete("/campaigns/:id", masterAuth, deleteMasterAd);

// Placements & Assignments (Global, Category & Single Video)
router.get("/master/assignments", masterAuth, getMasterAssignments);
router.post("/master/assignments", masterAuth, createMasterAssignment);
router.put("/master/assignments/:id", masterAuth, updateMasterAssignment);
router.delete("/master/assignments/:id", masterAuth, deleteMasterAssignment);

// Analytics & Live Metrics
router.get("/master/analytics", masterAuth, getMasterAdAnalytics);

export default router;
