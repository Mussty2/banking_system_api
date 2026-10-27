
import mongoose from "mongoose";
import Loan from "../models/Loan.js";
import Account from "../models/account.js";
import { randomUUID } from "crypto";
import Transaction from "../models/Transaction.js";
import { createAuditLog } from "./auditlog.controller.js";
import IdempotencyKey from "../models/idempotencyKey.js";
import { hashRequest } from "../utils/idempotency.js";


const getIdempotencyResult = async (userId, key, requestHash) => {
  const existing = await IdempotencyKey.findOne({
    user: userId,
    key,
  });

  if (!existing) {
    return null;
  }

  if (existing.requestHash !== requestHash) {
    return {
      status: 409,
      body: {
        success: false,
        message:
          "This Idempotency-Key was used with different request details.",
      },
    };
  }

  if (existing.status !== "completed") {
    return {
      status: 409,
      body: {
        success: false,
        message:
          "This request is still processing. Please try again shortly.",
      },
    };
  }

  return {
    status: existing.responseStatus || 200,
    body: existing.responseBody,
  };
};

// Customer applies for a loan
export const applyForLoan = async (req, res) => {
  try {
    const {
      accountId,
      amountMinor,
      durationMonths,
      purpose,
    } = req.body;

    if (
      !accountId ||
      !mongoose.isValidObjectId(accountId) ||
      !Number.isSafeInteger(amountMinor) ||
      amountMinor <= 0 ||
      !Number.isInteger(durationMonths) ||
      durationMonths < 1 ||
      durationMonths > 360 ||
      typeof purpose !== "string" ||
      !purpose.trim() ||
      purpose.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid loan application details",
      });
    }

    if (req.user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can apply for loans",
      });
    }

    const account = await Account.findOne({
      _id: accountId,
      owner: req.user._id,
      status: "active",
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Active account not found",
      });
    }

    // Temporary example rate. Configure your bank's policy
    // through LOAN_INTEREST_RATE in the environment.
    const interestRate = Number(
      process.env.LOAN_INTEREST_RATE ?? 10
    );

    if (
      !Number.isFinite(interestRate) ||
      interestRate < 0 ||
      interestRate > 100
    ) {
      return res.status(500).json({
        success: false,
        message: "Loan interest rate is not configured correctly",
      });
    }

    const loan = await Loan.create({
      customer: req.user._id,
      account: account._id,
      amountMinor,
      currency: account.currency,
      interestRate,
      durationMonths,
      purpose: purpose.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Loan application submitted successfully",
      data: loan,
    });
  } catch (error) {
    console.error("Apply for loan error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to submit loan application",
    });
  }
};

// Customer views their own loans
export const getMyLoans = async (req, res) => {
  try {
    const loans = await Loan.find({
      customer: req.user._id,
    })
      .populate("account", "accountNumber accountType")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: loans.length,
      data: loans,
    });
  } catch (error) {
    console.error("Get my loans error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your loans",
    });
  }
};

// Manager or admin views all loan applications
export const getAllLoans = async (req, res) => {
  try {
    if (!["manager", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only managers and admins can view all loans",
      });
    }

    const loans = await Loan.find()
      .populate("customer", "firstname lastname email phone")
      .populate("account", "accountNumber accountType")
      .populate("approvedBy", "firstname lastname email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: loans.length,
      data: loans,
    });
  } catch (error) {
    console.error("Get all loans error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve loan applications",
    });
  }
};

// Manager or admin approves a loan
export const approveLoan = async (req, res) => {
  try {
    if (!["manager", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only managers and admins can approve loans",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid loan ID",
      });
    }

    const loan = await Loan.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ["pending", "under_review"] },
      },
      {
        $set: {
          status: "approved",
          approvedBy: req.user._id,
          approvedAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    );

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Pending loan not found or already reviewed",
      });
    }
    await createAuditLog({
  req,
  action: "LOAN_APPROVED",
  resourceType: "loan",
  resourceId: loan._id,
  details: {
    customerId: loan.customer,
    amountMinor: loan.amountMinor,
    interestRate: loan.interestRate,
    durationMonths: loan.durationMonths,
    newStatus: loan.status,
  },
});

    return res.status(200).json({
      success: true,
      message: "Loan approved successfully",
      data: loan,
    });
  } catch (error) {
    console.error("Approve loan error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to approve loan",
    });
  }
};

// Manager or admin rejects a loan
export const rejectLoan = async (req, res) => {
  try {
    if (!["manager", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only managers and admins can reject loans",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid loan ID",
      });
    }

    const loan = await Loan.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ["pending", "under_review"] },
      },
      {
        $set: {
          status: "rejected",
          approvedBy: req.user._id,
        },
      },
      { new: true, runValidators: true }
    );

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Pending loan not found or already reviewed",
      });
    }
    await createAuditLog({
  req,
  action: "LOAN_REJECTED",
  resourceType: "loan",
  resourceId: loan._id,
  details: {
    customerId: loan.customer,
    amountMinor: loan.amountMinor,
    durationMonths: loan.durationMonths,
    newStatus: loan.status,
  },
});

    return res.status(200).json({
      success: true,
      message: "Loan rejected",
      data: loan,
    });
  } catch (error) {
    console.error("Reject loan error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to reject loan",
    });
  }
};

//disbursement of loan 
export const disburseLoan = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!["manager", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only managers or admins can disburse loans.",
      });
    }

    const { id } = req.params;
    const key = req.get("Idempotency-Key")?.trim();

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid loan ID.",
      });
    }

    if (!key || key.length > 200) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required.",
      });
    }

    const requestHash = hashRequest({
      operation: "loan_disbursement",
      loanId: id,
    });

    const previous = await getIdempotencyResult(
      req.user._id,
      key,
      requestHash
    );

    if (previous) {
      return res.status(previous.status).json(previous.body);
    }

    session.startTransaction();

    const loan = await Loan.findById(id).session(session);

    if (!loan) {
      throw new Error("Loan not found.");
    }

    if (loan.status !== "approved") {
      throw new Error("Only approved loans can be disbursed.");
    }

    const account = await Account.findOne({
      _id: loan.account,
      owner: loan.customer,
      status: "active",
      currency: loan.currency,
    }).session(session);

    if (!account) {
      throw new Error("Customer's active account was not found.");
    }

    const balanceBeforeMinor = account.balanceMinor;
    const balanceAfterMinor =
      balanceBeforeMinor + loan.amountMinor;

    if (!Number.isSafeInteger(balanceAfterMinor)) {
      throw new Error("Account balance exceeds the supported limit.");
    }

    account.balanceMinor = balanceAfterMinor;
    await account.save({ session });

    const interestMinor = Math.round(
      loan.amountMinor *
      (loan.interestRate / 100) *
      (loan.durationMonths / 12)
    );

    const totalRepaymentMinor =
      loan.amountMinor + interestMinor;

    if (!Number.isSafeInteger(totalRepaymentMinor)) {
      throw new Error(
        "Loan repayment amount exceeds the supported limit."
      );
    }

    loan.outstandingBalanceMinor = totalRepaymentMinor;
    loan.monthlyRepaymentMinor = Math.ceil(
      totalRepaymentMinor / loan.durationMonths
    );
    loan.status = "disbursed";
    loan.disbursedAt = new Date();

    await loan.save({ session });

    const [transaction] = await Transaction.create(
      [
        {
          reference: `LND-${randomUUID()}`,
          account: account._id,
          initiatedBy: req.user._id,
          type: "loan_disbursement",
          amountMinor: loan.amountMinor,
          currency: loan.currency,
          balanceBeforeMinor,
          balanceAfterMinor,
          status: "completed",
          description: `Disbursement of loan ${loan._id}`,
        },
      ],
      { session }
    );

    const responseBody = {
      success: true,
      message: "Loan disbursed successfully.",
      data: {
        loanId: loan._id,
        amountDisbursedMinor: loan.amountMinor,
        outstandingBalanceMinor: loan.outstandingBalanceMinor,
        monthlyRepaymentMinor: loan.monthlyRepaymentMinor,
        accountBalanceMinor: balanceAfterMinor,
        transactionReference: transaction.reference,
      },
    };

    await IdempotencyKey.create(
      [
        {
          user: req.user._id,
          key,
          requestHash,
          status: "completed",
          responseStatus: 200,
          responseBody,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    await createAuditLog({
      req,
      action: "LOAN_DISBURSED",
      resourceType: "loan",
      resourceId: loan._id,
      details: {
        customerId: loan.customer,
        accountNumber: account.accountNumber,
        amountMinor: loan.amountMinor,
        transactionReference: transaction.reference,
        outstandingBalanceMinor: loan.outstandingBalanceMinor,
      },
    });

    return res.status(200).json(responseBody);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    // If an earlier request completed, replay its saved response.
    try {
      const key = req.get("Idempotency-Key")?.trim();

      if (key) {
        const requestHash = hashRequest({
          operation: "loan_disbursement",
          loanId: req.params.id,
        });

        const previous = await getIdempotencyResult(
          req.user._id,
          key,
          requestHash
        );

        if (previous) {
          return res.status(previous.status).json(previous.body);
        }
      }
    } catch (lookupError) {
      console.error(
        "Disbursement idempotency lookup error:",
        lookupError.message
      );
    }

    console.error("Disburse loan error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to disburse loan.",
    });
  } finally {
    await session.endSession();
  }
};

//loan repayment

export const repayLoan = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { amountMinor } = req.body;
    const { id } = req.params;
    const key = req.get("Idempotency-Key")?.trim();

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid loan ID.",
      });
    }

    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid repayment amount in kobo.",
      });
    }

    if (!key || key.length > 200) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required.",
      });
    }

    const requestHash = hashRequest({
      operation: "loan_repayment",
      loanId: id,
      amountMinor,
    });

    const previous = await getIdempotencyResult(
      req.user._id,
      key,
      requestHash
    );

    if (previous) {
      return res.status(previous.status).json(previous.body);
    }

    session.startTransaction();

    const loan = await Loan.findById(id).session(session);

    if (!loan) {
      throw new Error("Loan not found.");
    }

    if (loan.customer.toString() !== req.user._id.toString()) {
      throw new Error("You are not allowed to repay this loan.");
    }

    if (
      loan.status !== "disbursed" ||
      loan.outstandingBalanceMinor <= 0
    ) {
      throw new Error("This loan is not available for repayment.");
    }

    if (amountMinor > loan.outstandingBalanceMinor) {
      throw new Error(
        "Repayment cannot exceed the outstanding balance."
      );
    }

    const account = await Account.findOne({
      _id: loan.account,
      owner: req.user._id,
      status: "active",
      currency: loan.currency,
    }).session(session);

    if (!account) {
      throw new Error("Your active loan account was not found.");
    }

    const balanceBeforeMinor = account.balanceMinor;

    const updatedAccount = await Account.findOneAndUpdate(
      {
        _id: account._id,
        owner: req.user._id,
        status: "active",
        balanceMinor: { $gte: amountMinor },
      },
      {
        $inc: { balanceMinor: -amountMinor },
      },
      {
        new: true,
        session,
        runValidators: true,
      }
    );

    if (!updatedAccount) {
      throw new Error("Insufficient funds in your account.");
    }

    const balanceAfterMinor = updatedAccount.balanceMinor;

    loan.outstandingBalanceMinor -= amountMinor;

    if (loan.outstandingBalanceMinor === 0) {
      loan.status = "repaid";
      loan.repaidAt = new Date();
    }

    await loan.save({ session });

    const [transaction] = await Transaction.create(
      [
        {
          reference: `LRP-${randomUUID()}`,
          account: account._id,
          initiatedBy: req.user._id,
          type: "loan_repayment",
          amountMinor,
          currency: loan.currency,
          balanceBeforeMinor,
          balanceAfterMinor,
          status: "completed",
          description: `Repayment for loan ${loan._id}`,
        },
      ],
      { session }
    );

    const responseBody = {
      success: true,
      message: "Loan repayment successful.",
      data: {
        loanId: loan._id,
        amountPaidMinor: amountMinor,
        outstandingBalanceMinor: loan.outstandingBalanceMinor,
        accountBalanceMinor: balanceAfterMinor,
        loanStatus: loan.status,
        transactionReference: transaction.reference,
      },
    };

    await IdempotencyKey.create(
      [
        {
          user: req.user._id,
          key,
          requestHash,
          status: "completed",
          responseStatus: 200,
          responseBody,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    await createAuditLog({
      req,
      action: "LOAN_REPAYMENT",
      resourceType: "loan",
      resourceId: loan._id,
      details: {
        customerId: loan.customer,
        accountNumber: account.accountNumber,
        amountPaidMinor: amountMinor,
        outstandingBalanceMinor: loan.outstandingBalanceMinor,
        loanStatus: loan.status,
        transactionReference: transaction.reference,
      },
    });

    return res.status(200).json(responseBody);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    // Replay a previously completed repayment when possible.
    try {
      const key = req.get("Idempotency-Key")?.trim();

      if (key) {
        const requestHash = hashRequest({
          operation: "loan_repayment",
          loanId: req.params.id,
          amountMinor: req.body.amountMinor,
        });

        const previous = await getIdempotencyResult(
          req.user._id,
          key,
          requestHash
        );

        if (previous) {
          return res.status(previous.status).json(previous.body);
        }
      }
    } catch (lookupError) {
      console.error(
        "Repayment idempotency lookup error:",
        lookupError.message
      );
    }

    console.error("Repay loan error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to repay loan.",
    });
  } finally {
    await session.endSession();
  }
};
