import Account from "../models/account.js";
import Transaction from "../models/Transaction.js";
import { createAuditLog } from "./auditlog.controller.js";

// Freeze an account
export const freezeAccount = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    const account = await Account.findOne({ accountNumber });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (account.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Cannot freeze a closed account",
      });
    }

    if (account.status === "frozen") {
      return res.status(400).json({
        success: false,
        message: "Account is already frozen",
      });
    }

    account.status = "frozen";
    await account.save();

    // Record the action in the audit logs
    await createAuditLog({
      req,
      action: "ACCOUNT_FROZEN",
      resourceType: "account",
      resourceId: account._id,
      details: {
        accountNumber: account.accountNumber,
        previousStatus: "active",
        newStatus: "frozen",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Account frozen successfully",
      data: {
        accountNumber: account.accountNumber,
        status: account.status,
      },
    });
  } catch (error) {
    console.error("Freeze account error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to freeze account",
    });
  }
};


// Unfreeze an account
export const unfreezeAccount = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    const account = await Account.findOne({ accountNumber });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (account.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Cannot unfreeze a closed account",
      });
    }

    if (account.status === "active") {
      return res.status(400).json({
        success: false,
        message: "Account is already active",
      });
    }

    const previousStatus = account.status;

    account.status = "active";
    await account.save();

    // Record the action in the audit logs
    await createAuditLog({
      req,
      action: "ACCOUNT_UNFROZEN",
      resourceType: "account",
      resourceId: account._id,
      details: {
        accountNumber: account.accountNumber,
        previousStatus,
        newStatus: "active",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Account unfrozen successfully",
      data: {
        accountNumber: account.accountNumber,
        status: account.status,
      },
    });
  } catch (error) {
    console.error("Unfreeze account error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to unfreeze account",
    });
  }
};



// Get all bank accounts
export const getAllAccounts = async (req, res) => {
  try {
    const accounts = await Account.find()
      .populate("owner", "firstname lastname email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "All accounts retrieved successfully",
      count: accounts.length,
      data: accounts,
    });
  } catch (error) {
    console.error("Get all accounts error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve accounts",
    });
  }
};


//get all transaction
export const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status } = req.query;

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 50",
      });
    }

    const filter = {};

    const allowedTypes = [
      "deposit",
      "withdrawal",
      "transfer_debit",
      "transfer_credit",
      "loan_disbursement",
      "loan_repayment",
      "reversal",
    ];

    if (type) {
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction type",
        });
      }

      filter.type = type;
    }

    if (status) {
      if (!["completed", "reversed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction status",
        });
      }

      filter.status = status;
    }

    const skip = (pageNumber - 1) * pageSize;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("account", "accountNumber owner")
        .populate("initiatedBy", "firstname lastname email")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),

      Transaction.countDocuments(filter),
    ]);

    const data = transactions.map((transaction) => ({
      reference: transaction.reference,
      type: transaction.type,
      amount: (transaction.amountMinor / 100).toFixed(2),
      currency: transaction.currency,
      status: transaction.status,
      description: transaction.description,
      account: transaction.account,
      initiatedBy: transaction.initiatedBy,
      date: transaction.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: "All transactions retrieved successfully",
      pagination: {
        page: pageNumber,
        limit: pageSize,
        totalTransactions: total,
        totalPages: Math.ceil(total / pageSize),
      },
      data,
    });
  } catch (error) {
    console.error("Get all transactions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions",
    });
  }
};
