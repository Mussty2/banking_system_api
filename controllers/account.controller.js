import Account from "../models/account.js";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Transaction from "../models/Transaction.js";
import Transfer from "../models/Transfer.js";
import IdempotencyKey from "../models/idempotencyKey.js";
import { hashRequest } from "../utils/idempotency.js";


const getIdempotencyResult = async (userId, key, requestHash) => {
  const existing = await IdempotencyKey.findOne({
    user: userId,
    key,
  });

  if (!existing) return null;

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
        message: "This request is still processing. Please try again shortly.",
      },
    };
  }

  return {
    status: existing.responseStatus || 200,
    body: existing.responseBody,
  };
};


// CREATE BANK ACCOUNT
export const createAccount = async (req, res) => {
  try {
    const { accountType } = req.body;

    // Check account type
    if (!["savings", "current"].includes(accountType)) {
      return res.status(400).json({
        success: false,
        message: "Account type must be savings or current",
      });
    }

    // Generate a 10-digit account number
    let accountNumber;
    let accountExists = true;

    while (accountExists) {
      accountNumber = Array.from(
        { length: 10 },
        () => Math.floor(Math.random() * 10)
      ).join("");

      accountExists = await Account.exists({ accountNumber });
    }

    // Create account for the logged-in customer
    const account = await Account.create({
      accountNumber,
      owner: req.user._id,
      accountType,
      balanceMinor: 0,
      currency: "NGN",
    });

    return res.status(201).json({
      success: true,
      message: "Bank account created successfully",
      data: account,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create bank account",
      error: error.message,
    });
  }
};


// VIEW MY ACCOUNTS
export const getMyAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({
      owner: req.user._id,
      status: { $ne: "closed" },
    }).select("accountNumber accountType balanceMinor currency status createdAt");

    return res.status(200).json({
      success: true,
      count: accounts.length,
      data: accounts.map((account) => ({
        ...account.toObject(),
        balanceNaira: (account.balanceMinor / 100).toFixed(2),
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve accounts",
    });
  }
};


// CHECK ACCOUNT BALANCE
export const getAccountBalance = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    // Only find an account owned by the logged-in customer
    const account = await Account.findOne({
      accountNumber,
      owner: req.user._id,
    }).select("accountNumber accountType balanceMinor currency status");

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Balance retrieved successfully",
      data: {
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        balanceMinor: account.balanceMinor,
        balanceNaira: (account.balanceMinor / 100).toFixed(2),
        currency: account.currency,
        status: account.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve account balance",
    });
  }
};


//DEPOSIT MONEY
export const depositMoney = async (req, res) => {
  const { accountNumber } = req.params;
  const amountText = String(req.body.amount ?? "");

  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid amount, e.g. 1000 or 1000.50",
    });
  }

  const [naira, kobo = ""] = amountText.split(".");
  const amountMinor =
    Number(naira) * 100 + Number(kobo.padEnd(2, "0"));

  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return res.status(400).json({
      success: false,
      message: "Deposit amount must be greater than zero",
    });
  }

  const key = req.get("Idempotency-Key")?.trim();

  if (!key || key.length > 200) {
    return res.status(400).json({
      success: false,
      message: "A valid Idempotency-Key header is required",
    });
  }

  const requestHash = hashRequest({
    operation: "deposit",
    accountNumber,
    amountMinor,
  });

  let session;

  try {
    // Return the saved response if this request was already completed.
    const previous = await getIdempotencyResult(
      req.user._id,
      key,
      requestHash
    );

    if (previous) {
      return res.status(previous.status).json(previous.body);
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const account = await Account.findOneAndUpdate(
      {
        accountNumber,
        owner: req.user._id,
        status: "active",
      },
      {
        $inc: { balanceMinor: amountMinor },
      },
      {
        new: false,
        session,
      }
    );

    if (!account) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Active account not found",
      });
    }

    const balanceBefore = account.balanceMinor;
    const balanceAfter = balanceBefore + amountMinor;

    const [transaction] = await Transaction.create(
      [
        {
          reference: `DEP-${randomUUID()}`,
          account: account._id,
          initiatedBy: req.user._id,
          type: "deposit",
          amountMinor,
          currency: account.currency,
          balanceBeforeMinor: balanceBefore,
          balanceAfterMinor: balanceAfter,
          status: "completed",
          description: "Account deposit",
        },
      ],
      { session }
    );

    const responseBody = {
      success: true,
      message: "Deposit recorded successfully",
      data: {
        accountNumber: account.accountNumber,
        depositedAmount: (amountMinor / 100).toFixed(2),
        balanceBefore: (balanceBefore / 100).toFixed(2),
        balanceAfter: (balanceAfter / 100).toFixed(2),
        currency: account.currency,
        transactionReference: transaction.reference,
      },
    };

    // Save the response in the same transaction as the deposit.
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

    return res.status(200).json(responseBody);
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Deposit error:", error.message);

    // A concurrent request may have completed with this key.
    try {
      const previous = await getIdempotencyResult(
        req.user._id,
        key,
        requestHash
      );

      if (previous) {
        return res.status(previous.status).json(previous.body);
      }
    } catch (lookupError) {
      console.error("Idempotency lookup error:", lookupError.message);
    }

    return res.status(500).json({
      success: false,
      message:
        "Deposit could not be confirmed. Check the balance and transaction history before retrying.",
    });
  } finally {
    if (session) await session.endSession();
  }
};



//WITHDRAW MONEY 
export const withdrawMoney = async (req, res) => {
  const { accountNumber } = req.params;
  const amountText = String(req.body.amount ?? "");

  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid amount, e.g. 500.00",
    });
  }

  const [naira, kobo = ""] = amountText.split(".");
  const amountMinor =
    Number(naira) * 100 + Number(kobo.padEnd(2, "0"));

  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return res.status(400).json({
      success: false,
      message: "Amount must be greater than zero",
    });
  }

  const key = req.get("Idempotency-Key")?.trim();

  if (!key || key.length > 200) {
    return res.status(400).json({
      success: false,
      message: "A valid Idempotency-Key header is required",
    });
  }

  const requestHash = hashRequest({
    operation: "withdrawal",
    accountNumber,
    amountMinor,
  });

  let session;

  try {
    // Check for a previous withdrawal using this key.
    const previous = await getIdempotencyResult(
      req.user._id,
      key,
      requestHash
    );

    if (previous) {
      return res.status(previous.status).json(previous.body);
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const account = await Account.findOneAndUpdate(
      {
        accountNumber,
        owner: req.user._id,
        status: "active",
        balanceMinor: { $gte: amountMinor },
      },
      {
        $inc: { balanceMinor: -amountMinor },
      },
      {
        new: false,
        session,
      }
    );

    if (!account) {
      await session.abortTransaction();

      const existingAccount = await Account.findOne({
        accountNumber,
        owner: req.user._id,
      });

      if (!existingAccount || existingAccount.status !== "active") {
        return res.status(404).json({
          success: false,
          message: "Active account not found",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Insufficient funds",
      });
    }

    const balanceBefore = account.balanceMinor;
    const balanceAfter = balanceBefore - amountMinor;

    const [transaction] = await Transaction.create(
      [
        {
          reference: `WTH-${randomUUID()}`,
          account: account._id,
          initiatedBy: req.user._id,
          type: "withdrawal",
          amountMinor,
          currency: account.currency,
          balanceBeforeMinor: balanceBefore,
          balanceAfterMinor: balanceAfter,
          status: "completed",
          description: "Account withdrawal",
        },
      ],
      { session }
    );

    const responseBody = {
      success: true,
      message: "Withdrawal successful",
      data: {
        accountNumber,
        withdrawnAmount: (amountMinor / 100).toFixed(2),
        balanceBefore: (balanceBefore / 100).toFixed(2),
        balanceAfter: (balanceAfter / 100).toFixed(2),
        currency: account.currency,
        transactionReference: transaction.reference,
      },
    };

    // Save the response together with the withdrawal.
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

    return res.status(200).json(responseBody);
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Withdrawal error:", error.message);

    // Check whether another request completed with this key.
    try {
      const previous = await getIdempotencyResult(
        req.user._id,
        key,
        requestHash
      );

      if (previous) {
        return res.status(previous.status).json(previous.body);
      }
    } catch (lookupError) {
      console.error("Idempotency lookup error:", lookupError.message);
    }

    return res.status(500).json({
      success: false,
      message:
        "Withdrawal could not be confirmed. Check the balance and transaction history before retrying.",
    });
  } finally {
    if (session) await session.endSession();
  }
};


//TRANSACTION HISTORY 
export const getTransactionHistory = async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const { page = 1, limit = 10, type, direction } = req.query;

    // 1. Validate pagination
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

    // 2. Find the account belonging to the logged-in user
    const account = await Account.findOne({
      accountNumber,
      owner: req.user._id,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // 3. Build the transaction search
    const filter = {
      account: account._id,
    };

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

    if (direction) {
      if (!["incoming", "outgoing"].includes(direction)) {
        return res.status(400).json({
          success: false,
          message: "Direction must be incoming or outgoing",
        });
      }

      if (type) {
        return res.status(400).json({
          success: false,
          message: "Use either type or direction, not both",
        });
      }

      filter.type =
        direction === "incoming"
          ? "transfer_credit"
          : "transfer_debit";
    }

    // 4. Calculate pagination
    const skip = (pageNumber - 1) * pageSize;

    // 5. Get transactions and total count
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate(
          "transfer",
          "reference sender recipient amountMinor currency status"
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),

      Transaction.countDocuments(filter),
    ]);

    // 6. Format the response
    const data = transactions.map((transaction) => ({
      reference: transaction.reference,
      type: transaction.type,
      amount: (transaction.amountMinor / 100).toFixed(2),
      currency: transaction.currency,
      balanceBefore: (
        transaction.balanceBeforeMinor / 100
      ).toFixed(2),
      balanceAfter: (
        transaction.balanceAfterMinor / 100
      ).toFixed(2),
      status: transaction.status,
      description: transaction.description,
      date: transaction.createdAt,

      transfer: transaction.transfer
        ? {
            reference: transaction.transfer.reference,
            amount: (
              transaction.transfer.amountMinor / 100
            ).toFixed(2),
            currency: transaction.transfer.currency,
            status: transaction.transfer.status,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      message: "Transaction history retrieved successfully",
      pagination: {
        page: pageNumber,
        limit: pageSize,
        totalTransactions: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: skip + transactions.length < total,
        hasPreviousPage: pageNumber > 1,
      },
      data,
    });
  } catch (error) {
    console.error("Transaction history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transaction history",
    });
  }
};


//TRANSFER MONEY
export const transferMoney = async (req, res) => {
  const {
    fromAccountId,
    toAccountNumber,
    amountMinor,
    description = "",
  } = req.body;

  // 1. Validate the request
  if (
    !fromAccountId ||
    !mongoose.Types.ObjectId.isValid(fromAccountId) ||
    !toAccountNumber ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Provide a valid source account, destination account number, and amountMinor",
    });
  }

  if (
    typeof description !== "string" ||
    description.length > 300
  ) {
    return res.status(400).json({
      success: false,
      message: "Description must be 300 characters or fewer",
    });
  }

  // 2. Require the idempotency key
  const idempotencyKey = req.get("Idempotency-Key");

  if (
    !idempotencyKey ||
    idempotencyKey.trim().length === 0 ||
    idempotencyKey.length > 200
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Provide an Idempotency-Key header of 1 to 200 characters",
    });
  }

  const cleanKey = idempotencyKey.trim();
  const cleanDescription = description.trim();

  const requestHash = hashRequest({
    fromAccountId: String(fromAccountId),
    toAccountNumber: String(toAccountNumber),
    amountMinor,
    description: cleanDescription,
  });

  let session;

  try {
    // 3. Check whether this request was already completed
    const previous = await IdempotencyKey.findOne({
      user: req.user._id,
      key: cleanKey,
    });

    if (previous) {
      if (previous.requestHash !== requestHash) {
        return res.status(409).json({
          success: false,
          message:
            "This Idempotency-Key was used with different request details.",
        });
      }

      if (previous.status === "completed") {
        return res
          .status(previous.responseStatus || 200)
          .json(previous.responseBody);
      }

      return res.status(409).json({
        success: false,
        message:
          "This request is still processing. Please try again shortly.",
      });
    }

    // 4. Start the MongoDB transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Find the sender's active account belonging to this user
    const sender = await Account.findOne({
      _id: fromAccountId,
      owner: req.user._id,
      status: "active",
    }).session(session);

    if (!sender) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Your active source account was not found",
      });
    }

    // Find the recipient's active account
    const recipient = await Account.findOne({
      accountNumber: String(toAccountNumber),
      status: "active",
    }).session(session);

    if (!recipient) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Receiving account not found",
      });
    }

    if (sender._id.equals(recipient._id)) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "You cannot transfer to the same account",
      });
    }

    if (sender.currency !== recipient.currency) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Both accounts must use the same currency",
      });
    }

    // 5. Deduct money only if sufficient funds remain
    const senderBefore = await Account.findOneAndUpdate(
      {
        _id: sender._id,
        owner: req.user._id,
        status: "active",
        balanceMinor: { $gte: amountMinor },
      },
      {
        $inc: { balanceMinor: -amountMinor },
      },
      {
        new: false,
        session,
      }
    );

    if (!senderBefore) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Insufficient funds or source account unavailable",
      });
    }

    // 6. Credit the recipient
    const recipientBefore = await Account.findOneAndUpdate(
      {
        _id: recipient._id,
        status: "active",
        currency: sender.currency,
      },
      {
        $inc: { balanceMinor: amountMinor },
      },
      {
        new: false,
        session,
      }
    );

    if (!recipientBefore) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Receiving account is unavailable",
      });
    }

    const senderBalanceAfter =
      senderBefore.balanceMinor - amountMinor;

    const recipientBalanceAfter =
      recipientBefore.balanceMinor + amountMinor;

    // 7. Create the transfer
    const [transfer] = await Transfer.create(
      [
        {
          reference: `TRF-${randomUUID()}`,
          sender: sender._id,
          recipient: recipient._id,
          initiatedBy: req.user._id,
          amountMinor,
          currency: sender.currency,
          status: "pending",
          description: cleanDescription,
        },
      ],
      { session }
    );

    // 8. Record both sides of the transfer
    const transactions = await Transaction.create(
      [
        {
          reference: `TRD-${randomUUID()}`,
          account: sender._id,
          initiatedBy: req.user._id,
          type: "transfer_debit",
          amountMinor,
          currency: sender.currency,
          balanceBeforeMinor: senderBefore.balanceMinor,
          balanceAfterMinor: senderBalanceAfter,
          status: "completed",
          description:
            cleanDescription || "Money transferred out",
          transfer: transfer._id,
        },
        {
          reference: `TRC-${randomUUID()}`,
          account: recipient._id,
          initiatedBy: req.user._id,
          type: "transfer_credit",
          amountMinor,
          currency: recipient.currency,
          balanceBeforeMinor: recipientBefore.balanceMinor,
          balanceAfterMinor: recipientBalanceAfter,
          status: "completed",
          description:
            cleanDescription || "Money received",
          transfer: transfer._id,
        },
      ],
      {
        session,
        ordered: true,
      }
    );

    // 9. Complete the transfer record
    transfer.debitTransaction = transactions[0]._id;
    transfer.creditTransaction = transactions[1]._id;
    transfer.status = "completed";

    await transfer.save({ session });

    // 10. Prepare the original response
    const responseBody = {
      success: true,
      message: "Transfer successful",
      data: {
        transferReference: transfer.reference,
        amount: (amountMinor / 100).toFixed(2),
        currency: sender.currency,
        sender: {
          accountNumber: sender.accountNumber,
          balanceBefore: (
            senderBefore.balanceMinor / 100
          ).toFixed(2),
          balanceAfter: (
            senderBalanceAfter / 100
          ).toFixed(2),
        },
        recipient: {
          accountNumber: recipient.accountNumber,
          balanceBefore: (
            recipientBefore.balanceMinor / 100
          ).toFixed(2),
          balanceAfter: (
            recipientBalanceAfter / 100
          ).toFixed(2),
        },
      },
    };

    // 11. Save the key and response in the SAME transaction
    await IdempotencyKey.create(
      [
        {
          user: req.user._id,
          key: cleanKey,
          requestHash,
          status: "completed",
          responseStatus: 200,
          responseBody,
          expiresAt: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ),
        },
      ],
      { session }
    );

    // 12. Commit the transfer and saved response together
    await session.commitTransaction();

    return res.status(200).json(responseBody);
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Transfer error:", error.message);

    // Another simultaneous request may have completed first.
    // Return its saved response instead of transferring again.
    try {
      const previous = await IdempotencyKey.findOne({
        user: req.user._id,
        key: cleanKey,
      });

      if (previous) {
        if (previous.requestHash !== requestHash) {
          return res.status(409).json({
            success: false,
            message:
              "This Idempotency-Key was used with different request details.",
          });
        }

        if (previous.status === "completed") {
          return res
            .status(previous.responseStatus || 200)
            .json(previous.responseBody);
        }

        return res.status(409).json({
          success: false,
          message:
            "This request is still processing. Please try again shortly.",
        });
      }
    } catch (lookupError) {
      console.error(
        "Idempotency lookup error:",
        lookupError.message
      );
    }

    return res.status(500).json({
      success: false,
      message:
        "Transfer could not be confirmed. Check the account balances and transaction history before retrying with a new key.",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};


 // ACCOUNT STATEMENT
export const getAccountStatement = async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const {
      from,
      to,
      page = 1,
      limit = 10,
    } = req.query;

    // 1. Validate dates
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Please provide both from and to dates (YYYY-MM-DD)",
      });
    }

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      fromDate.toISOString().slice(0, 10) !== from ||
      toDate.toISOString().slice(0, 10) !== to ||
      fromDate > toDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter valid dates. The from date must not be after the to date.",
      });
    }

    // Include the whole of the final day
    const endDate = new Date(toDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    // 2. Validate pagination
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

    // 3. Confirm the account belongs to the logged-in customer
    const account = await Account.findOne({
      accountNumber,
      owner: req.user._id,
    }).select("accountNumber accountType balanceMinor currency status createdAt");

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // 4. Get the balance immediately before the statement period
    const previousTransaction = await Transaction.findOne({
      account: account._id,
      createdAt: { $lt: fromDate },
    })
      .sort({ createdAt: -1, _id: -1 })
      .select("balanceAfterMinor")
      .lean();

    const openingBalanceMinor = previousTransaction
      ? previousTransaction.balanceAfterMinor
      : 0;

    // 5. Get all transactions inside the requested date range
    const dateFilter = {
      account: account._id,
      createdAt: {
        $gte: fromDate,
        $lt: endDate,
      },
    };

    const skip = (pageNumber - 1) * pageSize;

    const [transactions, total, summaryTransactions, lastTransaction] =
      await Promise.all([
        Transaction.find(dateFilter)
          .populate(
            "transfer",
            "reference sender recipient amountMinor currency status"
          )
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean(),

        Transaction.countDocuments(dateFilter),

        // Use every transaction in the period for accurate totals
        Transaction.find(dateFilter)
          .select("amountMinor balanceBeforeMinor balanceAfterMinor")
          .lean(),

        // Last balance recorded by the end of the statement period
        Transaction.findOne({
          account: account._id,
          createdAt: { $lt: endDate },
        })
          .sort({ createdAt: -1, _id: -1 })
          .select("balanceAfterMinor")
          .lean(),
      ]);

    // 6. Calculate money received and money paid out
    let totalCreditsMinor = 0;
    let totalDebitsMinor = 0;

    for (const transaction of summaryTransactions) {
      const change =
        transaction.balanceAfterMinor -
        transaction.balanceBeforeMinor;

      if (change > 0) {
        totalCreditsMinor += change;
      } else if (change < 0) {
        totalDebitsMinor += Math.abs(change);
      }
    }

    const closingBalanceMinor = lastTransaction
      ? lastTransaction.balanceAfterMinor
      : 0;

    // 7. Format the transaction list
    const data = transactions.map((transaction) => ({
      reference: transaction.reference,
      type: transaction.type,
      amount: (transaction.amountMinor / 100).toFixed(2),
      currency: transaction.currency,
      balanceBefore: (
        transaction.balanceBeforeMinor / 100
      ).toFixed(2),
      balanceAfter: (
        transaction.balanceAfterMinor / 100
      ).toFixed(2),
      status: transaction.status,
      description: transaction.description,
      date: transaction.createdAt,
      transfer: transaction.transfer
        ? {
            reference: transaction.transfer.reference,
            status: transaction.transfer.status,
          }
        : null,
    }));

    // 8. Return the statement
    return res.status(200).json({
      success: true,
      message: "Account statement retrieved successfully",
      statement: {
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        currency: account.currency,
        status: account.status,
        period: {
          from,
          to,
        },
        openingBalance: (openingBalanceMinor / 100).toFixed(2),
        totalCredits: (totalCreditsMinor / 100).toFixed(2),
        totalDebits: (totalDebitsMinor / 100).toFixed(2),
        closingBalance: (closingBalanceMinor / 100).toFixed(2),
      },
      pagination: {
        page: pageNumber,
        limit: pageSize,
        totalTransactions: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: skip + transactions.length < total,
        hasPreviousPage: pageNumber > 1,
      },
      data,
    });
  } catch (error) {
    console.error("Account statement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve account statement",
    });
  }
};
