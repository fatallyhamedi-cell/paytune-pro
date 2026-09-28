import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import {
  createStream,
  startStream,
  endStream,
  getArtistStreams,
  getArtistStreamById,
  getStreamAnalytics,
  deleteStream,
  getLiveNow,
  getLiveUpcoming,
  getStreamViewer,
  purchaseTicket,
  donateSuperThanks,
  getDonations,
  blockUser,
  unblockUser,
  deleteChatMessage,
  getChatMessages,
  postChatMessage
} from "../controllers/liveController";

// Artist Live Router
export const artistLiveRouter = Router();

artistLiveRouter.post("/create", authenticate, createStream);
artistLiveRouter.put("/:id/start", authenticate, startStream);
artistLiveRouter.put("/:id/end", authenticate, endStream);
artistLiveRouter.get("/", authenticate, getArtistStreams);
artistLiveRouter.get("/streams", authenticate, getArtistStreams);
artistLiveRouter.get("/:id", authenticate, getArtistStreamById);
artistLiveRouter.get("/:id/analytics", authenticate, getStreamAnalytics);
artistLiveRouter.delete("/:id", authenticate, deleteStream);

// Public / User Live Router
export const liveRouter = Router();

liveRouter.get("/now", getLiveNow);
liveRouter.get("/upcoming", getLiveUpcoming);
liveRouter.get("/:id", optionalAuthenticate, getStreamViewer);
liveRouter.post("/:id/purchase", authenticate, purchaseTicket);
liveRouter.post("/:streamId/buy-ticket", authenticate, purchaseTicket);
liveRouter.post("/:id/donate", authenticate, donateSuperThanks);
liveRouter.get("/:id/donations", getDonations);

// Moderation
liveRouter.post("/:id/block/:userId", authenticate, blockUser);
liveRouter.post("/:id/unblock/:userId", authenticate, unblockUser);
liveRouter.delete("/:id/chat/:messageId", authenticate, deleteChatMessage);

// Chat
liveRouter.get("/:streamId/chat", getChatMessages);
liveRouter.post("/:streamId/chat", optionalAuthenticate, postChatMessage);

export default liveRouter;
