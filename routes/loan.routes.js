import express from "express";

import {
  applyForLoan,
  getMyLoans,
  getAllLoans,
  approveLoan,
  rejectLoan,
  disburseLoan,
  repayLoan,
} from "../controllers/loan.controller.js";

import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/apply", protect, applyForLoan);
router.get("/my-loans", protect, getMyLoans);

router.get("/", protect, getAllLoans);
router.put("/:id/approve", protect, approveLoan);
router.put("/:id/reject", protect, rejectLoan);
router.put("/:id/disburse", protect, disburseLoan);
router.post("/:id/repay", protect, repayLoan);

export default router;
