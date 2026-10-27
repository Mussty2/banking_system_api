import Document from "../models/Document.js";
import fs from "node:fs/promises";

// CUSTOMER: UPLOAD IDENTITY DOCUMENT
export const submitDocument = async (req, res) => {
  try {
    const { documentType } = req.body;

    const allowedTypes = [
      "national_id",
      "passport",
      "drivers_license",
      "voters_card",
    ];

    if (!allowedTypes.includes(documentType)) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      return res.status(400).json({
        success: false,
        message: "Select a valid document type.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a document.",
      });
    }

    // Prevent multiple pending submissions of the same type.
    const pending = await Document.findOne({
      owner: req.user._id,
      documentType,
      status: "pending",
    });

    if (pending) {
      await fs.unlink(req.file.path).catch(() => {});

      return res.status(409).json({
        success: false,
        message: "You already have a document of this type awaiting review.",
      });
    }

    const document = await Document.create({
      owner: req.user._id,
      documentType,
      fileName: req.file.originalname,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });

    return res.status(201).json({
      success: true,
      message: "Identity document submitted for review.",
      data: {
        id: document._id,
        documentType: document.documentType,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    console.error("Document submission error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to submit identity document.",
    });
  }
};

// CUSTOMER: VIEW MY DOCUMENTS
export const getMyDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      owner: req.user._id,
    })
      .select("-filePath")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve documents.",
    });
  }
};

// MANAGER / ADMIN: VIEW DOCUMENT SUBMISSIONS
export const getPendingDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      status: "pending",
    })
      .select("-filePath")
      .populate("owner", "firstname lastname email")
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve pending documents.",
    });
  }
};

// MANAGER / ADMIN: APPROVE OR REJECT A DOCUMENT
export const reviewDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNote = "" } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected.",
      });
    }

    if (
      typeof reviewNote !== "string" ||
      reviewNote.length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Review note must be 500 characters or fewer.",
      });
    }

    const document = await Document.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        status,
        reviewNote,
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
      },
      { new: true, runValidators: true }
    ).select("-filePath");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Pending document not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Document ${status} successfully.`,
      data: document,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to review document.",
    });
  }
};
