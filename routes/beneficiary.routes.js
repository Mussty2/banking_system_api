import express from "express";

import {
  addBeneficiary,
  getMyBeneficiaries,
  deleteBeneficiary,
} from "../controllers/beneficiary.controller.js";

import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", protect, addBeneficiary);
router.get("/", protect, getMyBeneficiaries);
router.delete("/:id", protect, deleteBeneficiary);

export default router;
