import { Router } from "express";
import { authenticate, optionalAuthenticate, checkRole } from "../middleware/auth";
import {
  getAdForVideo,
  getFeedAds,
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
  approveMasterAd,
  rejectMasterAd,
  getMasterAssignments,
  createMasterAssignment,
  updateMasterAssignment,
  deleteMasterAssignment,
  getMasterAdAnalytics,
  getCreatorAds,
  createCreatorAd,
  updateCreatorAd,
  deleteCreatorAd,
} from "../controllers/adController";

const router = Router();
const masterAuth = [authenticate, checkRole('master')];

// ==========================================
// 1. Public Video & Feed Ad Playback & Analytics
// ==========================================
router.get("/feed", getFeedAds);
router.get("/video/:videoId", getAdForVideo);
router.post("/impression", optionalAuthenticate, recordAdImpression);
router.post("/progress", optionalAuthenticate, recordAdProgress);
router.post("/click", optionalAuthenticate, recordAdClick);

// ==========================================
// 2. Creator / Advertiser Campaign Submissions
// ==========================================
router.get("/creator/campaigns", authenticate, getCreatorAds);
router.post("/creator/campaigns", authenticate, createCreatorAd);
router.put("/creator/campaigns/:id", authenticate, updateCreatorAd);
router.delete("/creator/campaigns/:id", authenticate, deleteCreatorAd);

// ==========================================
// 3. Master Admin Ads Management & Campaigns
// ==========================================
router.get("/master/list", masterAuth, getMasterAds);
router.post("/master/create", masterAuth, createMasterAd);
router.put("/master/:id", masterAuth, updateMasterAd);
router.delete("/master/:id", masterAuth, deleteMasterAd);
router.post("/master/:id/approve", masterAuth, approveMasterAd);
router.post("/master/:id/reject", masterAuth, rejectMasterAd);
router.post("/master/:id/pause", masterAuth, pauseMasterAd);
router.post("/master/:id/resume", masterAuth, resumeMasterAd);
router.post("/master/:id/end", masterAuth, endMasterAd);

// Direct Campaign Management aliases (/api/ads/campaigns)
router.get("/campaigns", masterAuth, getMasterAds);
router.post("/campaigns", masterAuth, createMasterAd);
router.post("/campaigns/:id/approve", masterAuth, approveMasterAd);
router.post("/campaigns/:id/reject", masterAuth, rejectMasterAd);
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
