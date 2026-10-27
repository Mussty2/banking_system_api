import express from "express";

import { createAccount, depositMoney, getAccountBalance, getAccountStatement, getMyAccounts, getTransactionHistory, transferMoney, withdrawMoney } from "../controllers/account.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Create a bank account (login required)
router.post("/create", protect, createAccount);

// View all my accounts
router.get("/my-accounts", protect, getMyAccounts);

// Check balance for one of my accounts
router.get("/:accountNumber/balance", protect, getAccountBalance);

//deposit money
router.post("/:accountNumber/deposit", protect, depositMoney);

//withdraw money 
router.post("/:accountNumber/withdraw", protect, withdrawMoney);

//transaction history
router.get("/:accountNumber/transactions", protect, getTransactionHistory);

//transfer btw account 
router.post("/transfer", protect, transferMoney);

router.get("/:accountNumber/statement", protect,getAccountStatement);

export default router;
