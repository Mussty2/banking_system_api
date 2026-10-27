import mongoose from "mongoose";

const idempotencyKeySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    key: {
      type: String,
      required: true,
      trim: true
    },

    requestHash: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ["processing", "completed"],
      default: "processing"
    },

    responseStatus: {
      type: Number,
      default: null
    },

    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    expiresAt: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

// A user cannot execute the same key twice concurrently.
idempotencyKeySchema.index(
  { user: 1, key: 1 },
  { unique: true }
);

// Expired keys can eventually be removed by MongoDB.
idempotencyKeySchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const IdempotencyKey = mongoose.model(
  "IdempotencyKey",
  idempotencyKeySchema
);

export default IdempotencyKey;
