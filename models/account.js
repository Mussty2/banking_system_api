import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    accountNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    accountType: {
      type: String,
      enum: ["savings", "current"],
      required: true
    },

    balanceMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Balance must be a safe integer"
      }
    },

    currency: {
      type: String,
      enum: ["NGN"],
      default: "NGN",
      immutable: true
    },

    status: {
      type: String,
      enum: ["active", "frozen", "closed"],
      default: "active"
    }
  },
  { timestamps: true }
);

accountSchema.index({ owner: 1, status: 1 });

const Account = mongoose.model("Account", accountSchema);

export default Account;
