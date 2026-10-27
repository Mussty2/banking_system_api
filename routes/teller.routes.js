
import express from "express";

import {
  tellerDeposit,
  tellerWithdraw
} from "../controllers/teller.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { allowRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

router.post("/accounts/:accountNumber/deposit",protect,allowRoles("teller"),tellerDeposit);

router.post("/accounts/:accountNumber/withdraw",protect,allowRoles("teller"),tellerWithdraw);

export default router;
