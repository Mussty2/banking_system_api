import AuditLog from "../models/auditLog.js";

// Record an audit log
export const createAuditLog = async ({
  req,
  action,
  resourceType,
  resourceId = null,
  details = {},
}) => {
  try {
    return await AuditLog.create({
      actor: req.user?._id || null,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip || null,
    });
  } catch (error) {
    console.error("Audit log error:", error.message);
    return null;
  }
};

// Get audit logs (admin and manager)
export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const [logs, total] = await Promise.all([
      AuditLog.find()
        .populate("actor", "firstname lastname email role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      AuditLog.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      message: "Audit logs retrieved successfully",
      pagination: {
        page,
        limit,
        totalLogs: total,
        totalPages: Math.ceil(total / limit),
      },
      data: logs,
    });
  } catch (error) {
    console.error("Get audit logs error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve audit logs",
    });
  }
};
