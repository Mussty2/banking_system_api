
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Account from "../models/account.js";
import Transaction from "../models/Transaction.js";
import { createAuditLog } from "./auditlog.controller.js";

// Convert an amount in naira to kobo
const convertToKobo = (amount) => {
  const amountText = String(amount ?? "");

  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    return null;
  }

  const [naira, kobo = ""] = amountText.split(".");
  const amountMinor =
  Number(naira) * 100 + Number(kobo.padEnd(2, "0"));

  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return null;
  }

  return amountMinor;
};

// TELLER DEPOSIT
export const tellerDeposit = async (req, res) => {
  const { accountNumber } = req.params;
  const amountMinor = convertToKobo(req.body.amount);

  if (amountMinor === null) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid amount, e.g. 1000 or 1000.50."
    });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Find the customer's active account.
    // The teller does not have to own this account.
    const account = await Account.findOneAndUpdate(
      {
        accountNumber,
        status: "active"
      },
      {
        $inc: { balanceMinor: amountMinor }
      },
      {
        new: false,
        session
      }
    );

    if (!account) {
      const error = new Error("Active account not found.");
      error.statusCode = 404;
      throw error;
    }

    const balanceBeforeMinor = account.balanceMinor;
    const balanceAfterMinor = balanceBeforeMinor + amountMinor;

    if (!Number.isSafeInteger(balanceAfterMinor)) {
      throw new Error("Account balance exceeds the supported limit.");
    }

    // Record the teller as the person who performed the deposit.
    const [transaction] = await Transaction.create(
      [
        {
          reference: `TDEP-${randomUUID()}`,
          account: account._id,
          initiatedBy: req.user._id,
          type: "deposit",
          amountMinor,
          currency: account.currency,
          balanceBeforeMinor,
          balanceAfterMinor,
          status: "completed",
          description: "Deposit performed by teller"
        }
      ],
      { session }
    );

    await session.commitTransaction();
    await createAuditLog({
        req,
        action: "TELLER_DEPOSIT",
        resourceType: "transaction",
        resourceId: transaction._id,
         details: {
         accountNumber: account.accountNumber,
         amount: (amountMinor / 100).toFixed(2),
         transactionReference: transaction.reference,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Teller deposit successful.",
      data: {
        accountNumber: account.accountNumber,
        depositedAmount: (amountMinor / 100).toFixed(2),
        balanceBefore: (balanceBeforeMinor / 100).toFixed(2),
        balanceAfter: (balanceAfterMinor / 100).toFixed(2),
        tellerId: req.user._id,
        transactionReference: transaction.reference
      }
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Teller deposit failed."
    });
  } finally {
    await session.endSession();
  }
};

// TELLER WITHDRAWAL
export const tellerWithdraw = async (req, res) => {
  const { accountNumber } = req.params;
  const amountMinor = convertToKobo(req.body.amount);

  if (amountMinor === null) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid amount, e.g. 500 or 500.00."
    });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Withdraw only from an active account with enough money.
    const account = await Account.findOneAndUpdate(
      {
        accountNumber,
        status: "active",
        balanceMinor: { $gte: amountMinor }
      },
      {
        $inc: { balanceMinor: -amountMinor }
      },
      {
        new: false,
        session
      }
    );

    if (!account) {
      const existingAccount = await Account.findOne({
        accountNumber
      }).session(session);

      if (!existingAccount || existingAccount.status !== "active") {
        const error = new Error("Active account not found.");
        error.statusCode = 404;
        throw error;
      }

      throw new Error("Insufficient funds.");
    }

    const balanceBeforeMinor = account.balanceMinor;
    const balanceAfterMinor = balanceBeforeMinor - amountMinor;

    const [transaction] = await Transaction.create(
      [
        {
          reference: `TWTH-${randomUUID()}`,
          account: account._id,
          initiatedBy: req.user._id,
          type: "withdrawal",
          amountMinor,
          currency: account.currency,
          balanceBeforeMinor,
          balanceAfterMinor,
          status: "completed",
          description: "Withdrawal performed by teller"
        }
      ],
      { session }
    );

    await session.commitTransaction();
    await createAuditLog({
    req,
   action: "TELLER_WITHDRAWAL",
   resourceType: "transaction",
   resourceId: transaction._id,
    details: {
    accountNumber: account.accountNumber,
    amount: (amountMinor / 100).toFixed(2),
    transactionReference: transaction.reference,
   },
  });

    return res.status(200).json({
      success: true,
      message: "Teller withdrawal successful.",
      data: {
        accountNumber: account.accountNumber,
        withdrawnAmount: (amountMinor / 100).toFixed(2),
        balanceBefore: (balanceBeforeMinor / 100).toFixed(2),
        balanceAfter: (balanceAfterMinor / 100).toFixed(2),
        tellerId: req.user._id,
        transactionReference: transaction.reference
      }
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Teller withdrawal failed."
    });
  } finally {
    await session.endSession();
  }
};
