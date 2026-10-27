
import express from "express";

import {
  createCard,
  getMyCards,
  getCardById,
  blockCard,
  unblockCard
} from "../controllers/card.controller.js";

import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", protect, createCard);
router.get("/", protect, getMyCards);
router.get("/:id", protect, getCardById);
router.patch("/:id/block", protect, blockCard);
router.patch("/:id/unblock", protect, unblockCard);

export default router;
