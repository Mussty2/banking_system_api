
import express from "express";
import {
  getAuditLogs,
} from "../controllers/auditlog.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { allowRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/",protect,allowRoles("admin", "manager"),getAuditLogs);

export default router;
