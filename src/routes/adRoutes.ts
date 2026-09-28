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
// 2. Master Admin Ads Management
// ==========================================
// Ad Creatives
router.get("/master/list", masterAuth, getMasterAds);
router.post("/master/create", masterAuth, createMasterAd);
router.put("/master/:id", masterAuth, updateMasterAd);
router.delete("/master/:id", masterAuth, deleteMasterAd);

// Placements & Assignments (Global & Single)
router.get("/master/assignments", masterAuth, getMasterAssignments);
router.post("/master/assignments", masterAuth, createMasterAssignment);
router.put("/master/assignments/:id", masterAuth, updateMasterAssignment);
router.delete("/master/assignments/:id", masterAuth, deleteMasterAssignment);

// Analytics & Live Metrics
router.get("/master/analytics", masterAuth, getMasterAdAnalytics);

export default router;
