import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import {
  createStream,
  rotateStreamKey,
  revokeStreamKey,
  startStream,
  endStream,
  getArtistStreams,
  getArtistStreamById,
  getStreamAnalytics,
  deleteStream,
  getLiveNow,
  getLiveUpcoming,
  getStreamViewer,
  recordViewerHeartbeat,
  purchaseTicket,
  donateSuperThanks,
  getDonations,
  blockUser,
  unblockUser,
  deleteChatMessage,
  getChatMessages,
  postChatMessage,
  toggleStreamReminder,
  getStreamReminderStatus,
  getMyStreamReminders,
} from "../controllers/liveController";

// Artist / Creator Live Router
export const artistLiveRouter = Router();

artistLiveRouter.post("/create", authenticate, createStream);
artistLiveRouter.post("/:id/key/rotate", authenticate, rotateStreamKey);
artistLiveRouter.post("/:id/key/revoke", authenticate, revokeStreamKey);
artistLiveRouter.put("/:id/start", authenticate, startStream);
artistLiveRouter.put("/:id/end", authenticate, endStream);
artistLiveRouter.get("/", authenticate, getArtistStreams);
artistLiveRouter.get("/streams", authenticate, getArtistStreams);
artistLiveRouter.get("/:id", authenticate, getArtistStreamById);
artistLiveRouter.get("/:id/analytics", authenticate, getStreamAnalytics);
artistLiveRouter.delete("/:id", authenticate, deleteStream);

// Public / Viewer Live Router
export const liveRouter = Router();

liveRouter.get("/now", getLiveNow);
liveRouter.get("/upcoming", getLiveUpcoming);
liveRouter.get("/reminders/my", authenticate, getMyStreamReminders);
liveRouter.get("/streams/:streamId/chat", getChatMessages);
liveRouter.post("/streams/:streamId/chat", authenticate, postChatMessage);
liveRouter.post("/:id/remind", authenticate, toggleStreamReminder);
liveRouter.get("/:id/remind-status", optionalAuthenticate, getStreamReminderStatus);
liveRouter.get("/:id", optionalAuthenticate, getStreamViewer);
liveRouter.post("/:id/heartbeat", optionalAuthenticate, recordViewerHeartbeat);
liveRouter.post("/:id/purchase", authenticate, purchaseTicket);
liveRouter.post("/:streamId/buy-ticket", authenticate, purchaseTicket);
liveRouter.post("/:id/donate", authenticate, donateSuperThanks);
liveRouter.get("/:id/donations", getDonations);

// Moderation
liveRouter.post("/:id/block/:userId", authenticate, blockUser);
liveRouter.post("/:id/unblock/:userId", authenticate, unblockUser);
liveRouter.delete("/:id/chat/:messageId", authenticate, deleteChatMessage);
liveRouter.delete("/streams/:streamId/chat/:messageId", authenticate, deleteChatMessage);

// Admin/Emergency alias for MasterLiveControl
liveRouter.put("/:id/end", authenticate, endStream);

// Chat
liveRouter.get("/:streamId/chat", getChatMessages);
liveRouter.post("/:streamId/chat", authenticate, postChatMessage);

export default liveRouter;
