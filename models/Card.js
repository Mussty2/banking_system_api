import mongoose from "mongoose";

const cardSchema = new mongoose.Schema(
  {
    owner: {
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

    lastFourDigits: {
      type: String,
      required: true,
      match: /^\d{4}$/
    },

    cardType: {
      type: String,
      enum: ["debit", "virtual"],
      required: true
    },

    expiryMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },

    expiryYear: {
      type: Number,
      required: true,
      min: 2026
    },

    status: {
      type: String,
      enum: ["active", "blocked", "expired"],
      default: "active"
    }
  },
  { timestamps: true }
);

const Card = mongoose.model("Card", cardSchema);

export default Card;
