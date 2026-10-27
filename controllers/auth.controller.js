import User from "../models/user.js";
import jwt from "jsonwebtoken";

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
};

// REGISTER USER
export const register = async (req, res) => {
  try {
    const { firstname, lastname, email, phone, password } = req.body;

    // Check required fields
    if (!firstname || !lastname || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number already registered",
      });
    }

    // Create customer account
    const user = await User.create({
      firstname,
      lastname,
      email: email.toLowerCase(),
      phone,
      password,
      role: "customer",
    });

    // Generate token
    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

// LOGIN USER
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and include password
    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

// GET LOGGED-IN USER
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Could not get user details",
      error: error.message,
    });
  }
};

//get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Get all users error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
};

//create admin 

export const createAdmin = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      phone,
      password,
    } = req.body;

    // Check required fields
    if (!firstname || !lastname || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    // Check whether the user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { phone: phone.trim() },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number already exists",
      });
    }

    // Create the admin
    const admin = await User.create({
      firstname,
      lastname,
      email,
      phone,
      password,
      role: "admin",
    });

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: {
        id: admin._id,
        firstname: admin.firstname,
        lastname: admin.lastname,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create admin",
    });
  }
};

//create teller

export const createTeller = async (req, res) => {
  try {
    const { firstname, lastname, email, phone, password } = req.body;

    if (!firstname || !lastname || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide firstname, lastname, email, phone and password."
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters."
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: String(email).trim().toLowerCase() },
        { phone: String(phone).trim() }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number is already registered."
      });
    }

    const teller = await User.create({
      firstname: String(firstname).trim(),
      lastname: String(lastname).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      password,
      role: "teller"
    });

    return res.status(201).json({
      success: true,
      message: "Teller account created successfully.",
      data: {
        id: teller._id,
        firstname: teller.firstname,
        lastname: teller.lastname,
        email: teller.email,
        phone: teller.phone,
        role: teller.role
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number is already registered."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create teller account."
    });
  }
};


 // CREATE BANK MANAGER
export const createManager = async (req, res) => {
  try {
    const { firstname, lastname, email, phone, password } = req.body;

    // Check required fields
    if (!firstname || !lastname || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields.",
      });
    }

    // Check password length
    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(phone).trim();

    // Check if email or phone already exists
    const existingUser = await User.findOne({
      $or: [
        { email: cleanEmail },
        { phone: cleanPhone },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number is already registered.",
      });
    }

    // Create manager account
    const manager = await User.create({
      firstname: String(firstname).trim(),
      lastname: String(lastname).trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password,
      role: "manager",
    });

    return res.status(201).json({
      success: true,
      message: "Bank manager account created successfully.",
      data: {
        id: manager._id,
        firstname: manager.firstname,
        lastname: manager.lastname,
        email: manager.email,
        phone: manager.phone,
        role: manager.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number is already registered.",
      });
    }

    console.error("Create manager error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create bank manager account.",
    });
  }
};
