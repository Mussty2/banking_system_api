import Transaction from "../models/Transaction.js";

// GET FINANCIAL TRANSACTION REPORT
export const getFinancialReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    // 1. Validate dates
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Please provide from and to dates (YYYY-MM-DD)",
      });
    }

    const validDate = (date) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

      const parsed = new Date(`${date}T00:00:00.000Z`);

      return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
      );
    };

    if (!validDate(from) || !validDate(to) || from > to) {
      return res.status(400).json({
        success: false,
        message: "Enter valid dates. The from date must not be after the to date.",
      });
    }

    const startDate = new Date(`${from}T00:00:00.000Z`);
    const endDate = new Date(`${to}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    // 2. Find completed transactions in the selected period
    const report = await Transaction.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: "$type",
          totalAmountMinor: { $sum: "$amountMinor" },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    // 3. Prepare the totals
    const summary = {
      deposits: { count: 0, amount: 0 },
      withdrawals: { count: 0, amount: 0 },
      transfersOut: { count: 0, amount: 0 },
      transfersIn: { count: 0, amount: 0 },
      loanDisbursements: { count: 0, amount: 0 },
      loanRepayments: { count: 0, amount: 0 },
      reversals: { count: 0, amount: 0 },
    };

    const reportTypes = {
      deposit: "deposits",
      withdrawal: "withdrawals",
      transfer_debit: "transfersOut",
      transfer_credit: "transfersIn",
      loan_disbursement: "loanDisbursements",
      loan_repayment: "loanRepayments",
      reversal: "reversals",
    };

    let totalTransactions = 0;

    for (const item of report) {
      const key = reportTypes[item._id];

      if (!key) continue;

      summary[key].count = item.transactionCount;
      summary[key].amount = Number(
        (item.totalAmountMinor / 100).toFixed(2)
      );

      totalTransactions += item.transactionCount;
    }

    // 4. Return the financial report
    return res.status(200).json({
      success: true,
      message: "Financial report retrieved successfully",
      period: { from, to },
      currency: "NGN",
      totalTransactions,
      summary,
      note:
        "Transfers are reported separately as outgoing and incoming entries. Do not add both sides together when calculating unique transfer volume.",
    });
  } catch (error) {
    console.error("Financial report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate financial report",
    });
  }
};
