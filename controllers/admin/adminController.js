const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {apiLogger, errorLogger}=require('../../config/logger');
const Order = require("../../models/orderSchema");
const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);
const ExcelJS = require("exceljs");
const puppeteer = require("puppeteer");


const loadAdminLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { message: null }); 
  } catch (error) {
    errorLogger.error('there is an error in loading admin login page: %o',error);
    res.status(500).send('Server error loading admin login');
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    apiLogger.info('Admin login attempt: %o', req.body);

    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) {
      return res.render('admin/login', { message: 'Admin not found or invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.render('admin/login', { message: 'Invalid password' });
    }

    req.session.admin =admin._id;
    res.redirect('/admin/dashboard');

  } catch (error) {
     errorLogger.error('Admin login failed: %o', error);
    res.render('admin/login', { message: 'Login failed, please try again later' });
  }
};

const logout = async (req, res) => {
  try {
    if (req.session.admin) {
      delete req.session.admin;

      req.session.save((err) => {
        if (err) {
           errorLogger.error('Error saving session during logout: %o', err);
          return res.redirect('/admin/pageerror');
        }
        return res.redirect('/admin/login');
      });
    } else {
      return res.redirect('/admin/login');
    }
  } catch (error) {
    errorLogger.error('there is an error in adminlogout: %o',error);
    return res.redirect('/admin/pageerror');
  }
};

const buildDateFilter = (type, from, to) => {
  if (type === "day") {
    return {
      $gte: dayjs().startOf("day").toDate(),
      $lte: dayjs().endOf("day").toDate()
    };
  }

  if (type === "week") {
    return {
      $gte: dayjs().startOf("isoWeek").toDate(),
      $lte: dayjs().endOf("isoWeek").toDate()
    };
  }

  if (type === "month") {
    return {
      $gte: dayjs().startOf("month").toDate(),
      $lte: dayjs().endOf("month").toDate()
    };
  }

  if (type === "year") {
    return {
      $gte: dayjs().startOf("year").toDate(),
      $lte: dayjs().endOf("year").toDate()
    };
  }

  if (type === "custom" && from && to) {
    return {
      $gte: dayjs(from).startOf("day").toDate(),
      $lte: dayjs(to).endOf("day").toDate()
    };
  }

  return {};
};


const getSalesReport = async (req, res) => {
  try {
      const { type, from, to, search } = req.query;

      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      const query = { status: "delivered" };

      if (type) {
        query.createdOn = buildDateFilter(type, from, to);
      }

      if (search) {
        query.$or = [
          { "orderedItems.productName": { $regex: search, $options: "i" } },
          { "userId.name": { $regex: search, $options: "i" } }
        ];
      }

      const orders = await Order.find(query)
  .populate("userId")
  .populate({
      path: "orderedItems.productId",
      populate: { path: "categoryId" }
  })
  .sort({ createdOn: -1 });

      const salesRows = [];
      let totalSales = 0;
      let totalRevenue = 0;
      let totalProductDiscount = 0;
      let totalCouponDiscount = 0;

      for (const order of orders) {
        totalRevenue += order.payableAmount;
        totalProductDiscount += order.discountAmount;
        totalCouponDiscount += order.couponDiscount;

        for (const item of order.orderedItems) {
          if (item.status !== "delivered") continue;

          totalSales++;

          const product = item.productId;
          const discount = (item.price - item.salePrice) * item.quantity;
          const total = item.salePrice * item.quantity;

          salesRows.push({
            orderId: order.orderId,
            buyer: order.userId?.fullName || "Unknown",
            productName: item.productName,
            productId: product?._id || "",
            quantity: item.quantity,
            price: item.price,
            category: product?.categoryId.name || "N/A",
            discount,
            total,
            deliveredOn: item.deliveredOn || null,
            orderDate: new Date(order.createdOn).toLocaleDateString("en-IN")

          });
        }
      }

      const totalPages = Math.ceil(salesRows.length / limit);
      const salesData = salesRows.slice(skip, skip + limit);

      const filterQuery = new URLSearchParams(req.query).toString();

      res.render("admin/salesReport", {
        salesData,
        totalSales,
        totalRevenue,
        totalProductDiscount,
        totalCouponDiscount,
        type,
        from,
        to,
        search,
        totalPages,
        currentPage: page,
        filterQuery
      });

    } catch (error) {
      console.log("Sales Report Error:", error);
      res.redirect("/admin/pageerror");
    }
  };


const exportSalesExcel = async (req, res) => {
    try {
        const { type, from, to, search } = req.query;

        const query = { status: "delivered" };
        if (type) query.createdOn = buildDateFilter(type, from, to);
        if (search) {
            query.$or = [
                { "orderedItems.productName": { $regex: search, $options: "i" } },
                { "userId.name": { $regex: search, $options: "i" } }
            ];
        }

        const orders = await Order.find(query)
            .populate("userId")
            .populate({
                path: "orderedItems.productId",
                populate: { path: "categoryId" }
            })
            .sort({ createdOn: -1 });

        let totalSales = 0;
        let totalRevenue = 0;
        let totalProductDiscount = 0;
        let totalCouponDiscount = 0;

        orders.forEach(order => {
            totalRevenue += order.payableAmount;
            totalProductDiscount += order.discountAmount;
            totalCouponDiscount += order.couponDiscount;

            order.orderedItems.forEach(item => {
                if (item.status === "delivered") totalSales++;
            });
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Sales Report");

        sheet.mergeCells("A1", "J1");
        sheet.getCell("A1").value = "Sales Report";
        sheet.getCell("A1").font = { size: 16, bold: true };
        sheet.getCell("A1").alignment = { horizontal: "center" };

        sheet.mergeCells("A2", "J2");
        sheet.getCell("A2").value =
            type === "day" ? "Report Type: Today"
            : type === "week" ? "Report Type: Weekly"
            : type === "month" ? "Report Type: Monthly"
            : type === "year" ? "Report Type: Yearly"
            : type === "custom" ? `Report Type: Custom (${from} to ${to})`
            : "Report Type: All";
        sheet.getCell("A2").alignment = { horizontal: "center" };

        sheet.addRow([]);

        sheet.columns = [
            { header: "Order ID", key: "orderId", width: 18 },
            { header: "Order Date", key: "orderDate", width: 16 },
            { header: "Buyer", key: "buyer", width: 20 },
            { header: "Product", key: "product", width: 28 },
            { header: "Product ID", key: "productId", width: 22 },
            { header: "Qty", key: "qty", width: 8 },
            { header: "Price", key: "price", width: 12 },
            { header: "Category", key: "category", width: 18 },
            { header: "Discount", key: "discount", width: 14 },
            { header: "Total", key: "total", width: 14 }
        ];

        sheet.getRow(4).font = { bold: true };

        orders.forEach(order => {
            const orderDateStr = new Date(order.createdOn).toLocaleDateString("en-IN");

            order.orderedItems.forEach(item => {
                if (item.status !== "delivered") return;

                const product = item.productId;
                const discount = (item.price - item.salePrice) * item.quantity;
                const total = item.salePrice * item.quantity;

                sheet.addRow({
                    orderId: order.orderId,
                    orderDate: orderDateStr,
                    buyer: order.userId?.name || "Unknown",
                    product: item.productName,
                    productId: product?._id || "",
                    qty: item.quantity,
                    price: item.price,
                    category: product?.categoryId?.name || "N/A",
                    discount,
                    total
                });
            });
        });

        sheet.addRow([]);
        sheet.addRow(["Total Sales", totalSales]);
        sheet.addRow(["Total Revenue", totalRevenue]);
        sheet.addRow(["Total Product Discount", totalProductDiscount]);
        sheet.addRow(["Total Coupon Discount", totalCouponDiscount]);

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=sales-report.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.log(err);
        res.redirect("/admin/pageerror");
    }
};


const exportSalesPDF = async (req, res) => {
    try {
        const { type, from, to, search } = req.query;

        const query = { status: "delivered" };
        if (type) query.createdOn = buildDateFilter(type, from, to);
        if (search) {
            query.$or = [
                { "orderedItems.productName": { $regex: search, $options: "i" } },
                { "userId.name": { $regex: search, $options: "i" } }
            ];
        }

        const orders = await Order.find(query)
            .populate("userId")
            .populate({
                path: "orderedItems.productId",
                populate: { path: "categoryId" }
            })
            .sort({ createdOn: -1 });

        let totalSales = 0;
        let totalRevenue = 0;
        let totalProductDiscount = 0;
        let totalCouponDiscount = 0;

        const salesRows = [];

        for (const order of orders) {
            totalRevenue += order.payableAmount;
            totalProductDiscount += order.discountAmount;
            totalCouponDiscount += order.couponDiscount;

            for (const item of order.orderedItems) {
                if (item.status !== "delivered") continue;

                totalSales++;

                const product = item.productId;
                const discount = (item.price - item.salePrice) * item.quantity;
                const total = item.salePrice * item.quantity;

                salesRows.push({
                    orderId: order.orderId,
                    buyer: order.userId?.name || "Unknown",
                    productName: item.productName,
                    productId: product?._id || "",
                    qty: item.quantity,
                    price: item.price,
                    category: product?.categoryId?.name || "N/A",
                    discount,
                    total,
                    orderDate: new Date(order.createdOn).toLocaleDateString("en-IN")
                });
            }
        }

        const reportType =
            type === "day" ? "Today"
            : type === "week" ? "This Week"
            : type === "month" ? "This Month"
            : type === "year" ? "This Year"
            : type === "custom" ? "Custom Range"
            : "All Records";

        const dateRange =
            type === "custom"
                ? `${from || ""} to ${to || ""}`
                : "";

        const html = await new Promise((resolve, reject) => {
            res.render(
                "admin/salesReport-pdf",
                {
                    salesRows,
                    totalSales,
                    totalRevenue,
                    totalProductDiscount,
                    totalCouponDiscount,
                    reportType,
                    dateRange
                },
                (err, html) => (err ? reject(err) : resolve(html))
            );
        });

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setContent(html, { waitUntil: "networkidle0" });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true
        });

        await browser.close();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
        res.send(pdfBuffer);
    } catch (err) {
        console.log(err);
        res.redirect("/admin/pageerror");
    }
};

const loadAdminDashboard = async (req, res) => {
  try {

    const { type, from, to } = req.query;

    const dateFilter = type ? buildDateFilter(type, from, to) : {};

    const filter = { status: { $nin: ["cancelled", "returned", "failed", "return-requested"] } };
    if (Object.keys(dateFilter).length > 0) filter.createdOn = dateFilter;

    const totalCustomers = await User.countDocuments({ role: "user" });

    const totalOrders = await Order.countDocuments(filter);

    const revenueAgg = await Order.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$payableAmount" } } }
    ]);

    const totalSales = revenueAgg[0]?.total || 0;

    const pendingQuery = { status: "pending" };
    if (Object.keys(dateFilter).length > 0) pendingQuery.createdOn = dateFilter;

    const totalPending = await Order.countDocuments(pendingQuery);

    let groupId = {};

    if (type === "year") {
      groupId = { year: { $year: "$createdOn" } };
    } else if (type === "month") {
      groupId = { year: { $year: "$createdOn" }, month: { $month: "$createdOn" } };
    } else if (type === "week") {
      groupId = { year: { $year: "$createdOn" }, week: { $week: "$createdOn" } };
    } else {
      groupId = { year: { $year: "$createdOn" }, month: { $month: "$createdOn" }, day: { $dayOfMonth: "$createdOn" } };
    }

    let sortBy = {};

    if (type === "year") {
      sortBy = { "_id.year": 1 };
    } else if (type === "month") {
      sortBy = { "_id.year": 1, "_id.month": 1 };
    } else if (type === "week") {
      sortBy = { "_id.year": 1, "_id.week": 1 };
    } else {
      sortBy = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };
    }

    const salesAgg = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: groupId,
          totalSales: { $sum: "$payableAmount" }
        }
      },
      { $sort: sortBy }
    ]);

    const chartLabels = [];
    const chartData = [];

    for (const row of salesAgg) {
      const id = row._id;

      if (type === "year") {
        chartLabels.push(String(id.year));
      } else if (type === "month") {
        const date = new Date(id.year, id.month - 1, 1);
        chartLabels.push(date.toLocaleString("default", { month: "short", year: "numeric" }));
      } else if (type === "week") {
        chartLabels.push(`W${id.week} ${id.year}`);
      } else {
        const date = new Date(id.year, id.month - 1, id.day);
        chartLabels.push(date.toLocaleDateString("en-IN"));
      }

      chartData.push(Number(row.totalSales.toFixed(2)));
    }

    const topProducts = await Order.aggregate([
      { $match: filter },
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
      { $match: filter },
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
      { $match: filter },
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
  loadAdminLogin,
  adminLogin,
  loadAdminDashboard,
  logout,
  getSalesReport,
  exportSalesExcel,
  exportSalesPDF,

};
