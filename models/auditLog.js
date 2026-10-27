import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    action: {
      type: String,
      required: true,
      trim: true
    },

    resourceType: {
      type: String,
      required: true,
      enum: [
        "user",
        "account",
        "transaction",
        "transfer",
        "beneficiary",
        "card",
        "loan",
        "document",
        "system"
      ]
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    ipAddress: {
      type: String,
      default: null
    },

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  {
    versionKey: false
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
