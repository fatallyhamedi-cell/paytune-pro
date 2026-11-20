import { Router } from "express";
import { authenticate, checkRole } from "../middleware/auth";
import * as adminController from "../controllers/adminController";

const router = Router();

router.post("/login", adminController.adminLogin);
router.get("/me", authenticate, checkRole("master"), adminController.getAdminMe);

export default router;
