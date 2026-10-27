import express from "express";

import {
  freezeAccount,
  getAllAccounts,
  getAllTransactions,
  unfreezeAccount,
} from "../controllers/admin.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { allowRoles } from "../middlewares/role.middleware.js";
import { getFinancialReport } from "../controllers/report.controller.js";

const router = express.Router();

// Freeze an account
router.put("/accounts/:accountNumber/freeze",protect,allowRoles("admin", "manager"),freezeAccount);

// Unfreeze an account
router.put("/accounts/:accountNumber/unfreeze",protect,allowRoles("admin", "manager"),unfreezeAccount);

//get all bank account
router.get("/accounts", protect, adminOnly, getAllAccounts);

//get all transaction 
router.get("/transactions",protect,allowRoles("admin", "manager"),getAllTransactions);

router.get("/reports/transactions",protect,allowRoles("admin", "manager"),getFinancialReport);

export default router;