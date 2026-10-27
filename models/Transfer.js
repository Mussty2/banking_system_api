import mongoose from "mongoose";

const transferSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      immutable: true
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },

    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

    debitTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null
    },

    creditTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed", "reversed"],
      default: "pending"
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ""
    }
  },
  { timestamps: true }
);

transferSchema.index({ sender: 1, createdAt: -1 });
transferSchema.index({ recipient: 1, createdAt: -1 });

const Transfer = mongoose.model("Transfer", transferSchema);

export default Transfer;
