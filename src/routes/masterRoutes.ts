import { Router } from "express";
import { authenticate, checkRole } from "../middleware/auth";
import * as masterController from "../controllers/masterController";

const router = Router();

// Master access middleware: validates token and clearance
// In dev preview mode, we provide high resilience
const masterAuth = [authenticate, checkRole('master')];

// 1. Overview & Stats
router.get("/stats", masterAuth, masterController.getMasterStats);
router.get("/revenue", masterAuth, masterController.getMasterRevenue);
router.get("/activity", masterAuth, masterController.getMasterActivity);
router.get("/top-content", masterAuth, masterController.getMasterTopContent);

// 2. Artist Management
router.get("/artists", masterAuth, masterController.getMasterArtists);
router.get("/artists/:id", masterAuth, masterController.getArtistDetails);
router.put("/artists/:id/approve", masterAuth, masterController.approveArtist);
router.put("/artists/:id/block", masterAuth, masterController.blockArtist);
router.put("/artists/:id/unblock", masterAuth, masterController.unblockArtist);
router.delete("/artists/:id", masterAuth, masterController.deleteArtist);
router.post("/artists/impersonate/:id", masterAuth, masterController.impersonateArtist);
router.post("/artists/bulk-action", masterAuth, masterController.bulkArtistAction);
router.put("/artists/toggle-auto-approve", masterAuth, masterController.toggleAutoApproveArtist);
router.all("/artists/auto-approve", masterAuth, masterController.toggleAutoApproveArtist);

// 3. User Management
router.get("/users", masterAuth, masterController.getMasterUsers);
router.get("/users/:id", masterAuth, masterController.getUserDetails);
router.put("/users/:id/block", masterAuth, masterController.blockUser);
router.put("/users/:id/unblock", masterAuth, masterController.unblockUser);
router.delete("/users/:id", masterAuth, masterController.deleteUser);

// 4. Video Management
router.get("/videos", masterAuth, masterController.getMasterVideos);
router.get("/videos/:id", masterAuth, masterController.getMasterVideoDetails);
router.put("/videos/:id", masterAuth, masterController.updateMasterVideo);
router.delete("/videos/:id", masterAuth, masterController.deleteMasterVideo);

// 5. Payments & Transactions
router.get("/payments", masterAuth, masterController.getMasterPayments);
router.get("/payments/export", masterAuth, masterController.exportPaymentsCSV);
router.post("/payments/:id/refund", masterAuth, masterController.refundPayment);

// 6. Withdrawals
router.get("/withdrawals", masterAuth, masterController.getMasterWithdrawals);
router.get("/withdrawals/history", masterAuth, masterController.getWithdrawalsHistory);
router.post("/withdrawals/:id/process", masterAuth, masterController.processWithdrawal);
router.post("/withdrawals/batch-process", masterAuth, masterController.batchProcessWithdrawals);

// 7. Platform Settings
router.get("/settings", masterAuth, masterController.getMasterSettings);
router.put("/settings", masterAuth, masterController.updateMasterSettings);
router.put("/settings/email-templates", masterAuth, masterController.updateEmailTemplates);

// 7b. Master Profile
router.get("/profile", masterAuth, masterController.getMasterProfile);
router.put("/profile", masterAuth, masterController.updateMasterProfile);

// 8. Admin Audit Logs
router.get("/logs", masterAuth, masterController.getAdminLogs);
router.get("/logs/export", masterAuth, masterController.exportLogsCSV);

// 9. Analytical Reports
router.get("/reports/sales", masterAuth, masterController.getSalesReport);
router.get("/reports/artists", masterAuth, masterController.getArtistsReport);
router.get("/reports/users", masterAuth, masterController.getUsersReport);
router.get("/reports/withdrawals", masterAuth, masterController.getWithdrawalsReport);

export default router;
