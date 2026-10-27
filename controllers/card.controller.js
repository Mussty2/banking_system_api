
import { randomInt } from "crypto";
import Account from "../models/account.js";
import Card from "../models/Card.js";

// Create a new debit or virtual card
export const createCard = async (req, res) => {
  try {
    const { accountId, cardType } = req.body;

    if (!accountId || !cardType) {
      return res.status(400).json({
        success: false,
        message: "Account ID and card type are required."
      });
    }

    if (!["debit", "virtual"].includes(cardType)) {
      return res.status(400).json({
        success: false,
        message: "Card type must be debit or virtual."
      });
    }

    const account = await Account.findOne({
      _id: accountId,
      owner: req.user._id,
      status: "active"
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Active account not found."
      });
    }

    const now = new Date();

    const card = await Card.create({
      owner: req.user._id,
      account: account._id,
      lastFourDigits: String(randomInt(0, 10000)).padStart(4, "0"),
      cardType,
      expiryMonth: now.getMonth() + 1,
      expiryYear: now.getFullYear() + 3,
      status: "active"
    });

    return res.status(201).json({
      success: true,
      message: "Card created successfully.",
      data: card
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to create card.",
      error: error.message
    });
  }
};

// Get all cards belonging to the logged-in customer
export const getMyCards = async (req, res) => {
  try {
    const cards = await Card.find({
      owner: req.user._id
    })
      .populate("account", "accountNumber accountType")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: cards.length,
      data: cards
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve cards.",
      error: error.message
    });
  }
};

// Get one card belonging to the logged-in customer
export const getCardById = async (req, res) => {
  try {
    const card = await Card.findOne({
      _id: req.params.id,
      owner: req.user._id
    }).populate("account", "accountNumber accountType");

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: card
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve card.",
      error: error.message
    });
  }
};

// Block a card
export const blockCard = async (req, res) => {
  try {
    const card = await Card.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found."
      });
    }

    if (card.status === "expired") {
      return res.status(400).json({
        success: false,
        message: "An expired card cannot be blocked."
      });
    }

    if (card.status === "blocked") {
      return res.status(400).json({
        success: false,
        message: "This card is already blocked."
      });
    }

    card.status = "blocked";
    await card.save();

    return res.status(200).json({
      success: true,
      message: "Card blocked successfully.",
      data: card
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to block card.",
      error: error.message
    });
  }
};

// Unblock a card
export const unblockCard = async (req, res) => {
  try {
    const card = await Card.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found."
      });
    }

    if (card.status !== "blocked") {
      return res.status(400).json({
        success: false,
        message: "Only blocked cards can be unblocked."
      });
    }

    const now = new Date();
    const isExpired =
      card.expiryYear < now.getFullYear() ||
      (card.expiryYear === now.getFullYear() &&
        card.expiryMonth < now.getMonth() + 1);

    if (isExpired) {
      card.status = "expired";
      await card.save();

      return res.status(400).json({
        success: false,
        message: "This card has expired and cannot be unblocked."
      });
    }

    card.status = "active";
    await card.save();

    return res.status(200).json({
      success: true,
      message: "Card unblocked successfully.",
      data: card
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to unblock card.",
      error: error.message
    });
  }
};
