const User = require('../../models/userSchema');
const { apiLogger, errorLogger } = require('../../config/logger');
const Order = require("../../models/orderSchema");
const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);

const loadAdminDashboard = async (req, res) => {
  try {
    let { type, from, to } = req.query;
    type = type || "day";

    if (type !== "custom") {
      from = null;
      to = null;
    }

        const now = dayjs().utc();

    let fromDate;
    let toDate = now.endOf("day").toDate();

    if (type === "week") {
      fromDate = now.subtract(6, "day").startOf("day").toDate();
    } else if (type === "month") {
      fromDate = now.startOf("month").toDate();
    } else if (type === "year") {
      fromDate = now.startOf("year").toDate();
    } else if (type === "custom" && from && to) {
      fromDate = dayjs(from).startOf("day").toDate();
      toDate = dayjs(to).endOf("day").toDate();
    }

    const dateFilter = fromDate && toDate ? { $gte: fromDate, $lte: toDate } : null;

    const baseFilter = {
      status: { $nin: ["cancelled", "returned", "failed", "return-requested"] }
    };

    if (dateFilter) baseFilter.createdOn = dateFilter;

    const totalCustomers = await User.countDocuments({ role: "user" });
    const totalOrders = await Order.countDocuments(baseFilter);

    const revenueAgg = await Order.aggregate([
      { $match: baseFilter },
      { $group: { _id: null, total: { $sum: "$payableAmount" } } }
    ]);

    const totalSales = revenueAgg[0]?.total || 0;

    const pendingFilter = { status: "pending" };
    if (dateFilter) pendingFilter.createdOn = dateFilter;

    const totalPending = await Order.countDocuments(pendingFilter);

    let groupId;

    if (type === "year") {
      groupId = {
        year: { $year: "$createdOn" },
        month: { $month: "$createdOn" }
      };
    } else {
      groupId = {
        year: { $year: "$createdOn" },
        month: { $month: "$createdOn" },
        day: { $dayOfMonth: "$createdOn" }
      };
    }

    const salesAgg = await Order.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: groupId,
          totalSales: { $sum: "$payableAmount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    const chartLabels = [];
    const chartData = [];

    for (const row of salesAgg) {
      const id = row._id;

      if (type === "year") {
        const date = new Date(id.year, id.month - 1, 1);
        chartLabels.push(
          date.toLocaleString("default", { month: "short", year: "numeric" })
        );
      } else {
        const date = new Date(id.year, id.month - 1, id.day);
        chartLabels.push(date.toLocaleDateString("en-IN"));
      }

      chartData.push(Number(row.totalSales.toFixed(2)));
    }

    const topProducts = await Order.aggregate([
      { $match: baseFilter },
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: "$orderedItems.productName",
          totalQty: { $sum: "$orderedItems.quantity" }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 3 }
    ]);

    const topCategories = await Order.aggregate([
      { $match: baseFilter },
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: "$orderedItems.category",
          totalQty: { $sum: "$orderedItems.quantity" }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 3 }
    ]);

    const topSubcategories = await Order.aggregate([
      { $match: baseFilter },
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: "$orderedItems.subCategory",
          totalQty: { $sum: "$orderedItems.quantity" }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 3 }
    ]);

    res.render("admin/dashboard", {
      totalCustomers,
      totalOrders,
      totalSales,
      totalPending,
      topProducts,
      topCategories,
      topSubcategories,
      chartLabels,
      chartData,
      type,
      from,
      to
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.redirect("/admin/pageerror");
  }
};

module.exports = {
  loadAdminDashboard
};
