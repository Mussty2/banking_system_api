import express from "express";

import {
  register,
  login,
  getMe,
  getAllUsers,
  createAdmin,
  createTeller,
  createManager,
} from "../controllers/auth.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";

const router = express.Router();

// Register a new customer
router.post("/register", register);

// Login customer
router.post("/login", login);

// Get logged-in user's details
router.get("/me", protect, getMe);

//create new admin 
router.post("/create-admin",protect,adminOnly,createAdmin);

router.get("/users", protect, adminOnly, getAllUsers);

router.post("/create-teller",protect,adminOnly,createTeller);

router.post("/create-manager", protect, adminOnly, createManager);

export default router;