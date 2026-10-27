import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      immutable: true
    },

    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },

    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
      enum: [
        "deposit",
        "withdrawal",
        "transfer_debit",
        "transfer_credit",
        "loan_disbursement",
        "loan_repayment",
        "reversal"
      ],
      required: true
    },

    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger
    },

    currency: {
      type: String,
      enum: ["NGN"],
      default: "NGN"
    },

    balanceBeforeMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger
    },

    balanceAfterMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger
    },

    status: {
      type: String,
      enum: ["completed", "reversed"],
      default: "completed"
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ""
    },

    transfer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transfer",
      default: null
    },

    relatedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null
    },

    reversedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

transactionSchema.index({ account: 1, createdAt: -1 });
transactionSchema.index({ initiatedBy: 1, createdAt: -1 });

const Transaction = mongoose.model(
  "Transaction",
  transactionSchema
);

export default Transaction;
