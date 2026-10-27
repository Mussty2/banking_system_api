import mongoose from "mongoose";

const loanSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
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

    interestRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    durationMonths: {
      type: Number,
      required: true,
      min: 1,
      max: 360,
      validate: Number.isInteger
    },

    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },

    status: {
      type: String,
      enum: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "disbursed",
        "repaid",
        "defaulted"
      ],
      default: "pending"
    },

    monthlyRepaymentMinor: {
      type: Number,
      min: 0,
      default: null,
      validate: {
        validator: value =>
          value === null || Number.isSafeInteger(value),
        message: "Repayment must be a safe integer"
      }
    },

    outstandingBalanceMinor: {
     type: Number,
     min: 0,
     default: 0,
     validate: Number.isSafeInteger
   },
   
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    approvedAt: {
      type: Date,
      default: null
    },

    disbursedAt: {
      type: Date,
      default: null
    },

    repaidAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

const Loan = mongoose.model("Loan", loanSchema);

export default Loan;
