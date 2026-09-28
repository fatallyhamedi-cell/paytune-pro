import { Router } from "express";
import * as adminController from "../controllers/adminController";

const router = Router();

router.post("/login", adminController.adminLogin);
router.get("/me", adminController.getAdminMe);

export default router;
