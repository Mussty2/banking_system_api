
import Beneficiary from "../models/Beneficiary.js";
import Account from "../models/account.js";

// Add a beneficiary
export const addBeneficiary = async (req, res) => {
  try {
    const { beneficiaryName, accountNumber, bankCode, bankName } = req.body;

    if (!beneficiaryName || !accountNumber || !bankCode || !bankName) {
      return res.status(400).json({
        success: false,
        message: "Please provide all beneficiary details",
      });
    }

    // Prevent saving your own account as a beneficiary
    const ownAccount = await Account.findOne({
      owner: req.user._id,
      accountNumber: accountNumber.trim(),
    });

    if (ownAccount) {
      return res.status(400).json({
        success: false,
        message: "You cannot add your own account as a beneficiary",
      });
    }

    const beneficiary = await Beneficiary.create({
      owner: req.user._id,
      beneficiaryName: beneficiaryName.trim(),
      accountNumber: accountNumber.trim(),
      bankCode: bankCode.trim(),
      bankName: bankName.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Beneficiary added successfully",
      data: beneficiary,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This beneficiary has already been added",
      });
    }

    console.error("Add beneficiary error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to add beneficiary",
    });
  }
};

// Get my beneficiaries
export const getMyBeneficiaries = async (req, res) => {
  try {
    const beneficiaries = await Beneficiary.find({
      owner: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Beneficiaries retrieved successfully",
      count: beneficiaries.length,
      data: beneficiaries,
    });
  } catch (error) {
    console.error("Get beneficiaries error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve beneficiaries",
    });
  }
};

// Delete a beneficiary
export const deleteBeneficiary = async (req, res) => {
  try {
    const beneficiary = await Beneficiary.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: "Beneficiary not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Beneficiary deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid beneficiary ID",
      });
    }

    console.error("Delete beneficiary error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete beneficiary",
    });
  }
};
