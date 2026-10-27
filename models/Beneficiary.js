import mongoose from "mongoose";

const beneficiarySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    beneficiaryName: {
      type: String,
      required: true,
      trim: true
    },

    accountNumber: {
      type: String,
      required: true,
      trim: true
    },

    bankCode: {
      type: String,
      required: true,
      trim: true
    },

    bankName: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true }
);

beneficiarySchema.index({
  owner: 1,
  accountNumber: 1,
  bankCode: 1
}, { unique: true });

const Beneficiary = mongoose.model(
  "Beneficiary",
  beneficiarySchema
);

export default Beneficiary;
