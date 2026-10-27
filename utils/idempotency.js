import crypto from "node:crypto";
import IdempotencyKey from "../models/idempotencyKey.js";

export const hashRequest = (data) => {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
};

export const findPreviousRequest = async (userId, key, requestHash) => {
  const existing = await IdempotencyKey.findOne({
    user: userId,
    key,
  });

  if (!existing) {
    return { found: false };
  }

  if (existing.requestHash !== requestHash) {
    return {
      found: true,
      conflict: true,
      message: "This Idempotency-Key was already used with different request details.",
    };
  }

  if (existing.status !== "completed") {
    return {
      found: true,
      processing: true,
      message: "This request is still processing. Please try again shortly.",
    };
  }

  return {
    found: true,
    completed: true,
    responseStatus: existing.responseStatus,
    responseBody: existing.responseBody,
  };
};
