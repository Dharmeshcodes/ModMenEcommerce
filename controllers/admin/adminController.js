const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const Order = require("../../models/orderSchema");
const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);
const ExcelJS = require("exceljs");
const puppeteer = require("puppeteer");
const HTTP_STATUS = require("../../constans/httpStatus");
const MESSAGES = require("../../constans/messages");
const { apiLogger, errorLogger } = require("../../config/logger");



const loadAdminLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { message: null }); 
  } catch (error) {
    errorLogger.error('there is an error in loading admin login page: %o',error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.COMMON.SOMETHING_WENT_WRONG);
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    apiLogger.info('Admin login attempt: %o', req.body);

    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) {
      return res.render('admin/login', { message: MESSAGES.AUTH.INVALID_CREDENTIALS});
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.render('admin/login', { message:MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

    req.session.admin =admin._id;
    res.redirect('/admin/dashboard');

  } catch (error) {
     errorLogger.error('Admin login failed: %o', error);
    res.render('admin/login', { message: MESSAGES.COMMON.SOMETHING_WENT_WRONG });
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
    apiLogger.info("Admin sales report accessed", { query: req.query });

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
        { "userId.fullName": { $regex: search, $options: "i" } }
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
    errorLogger.error("Sales report error", { error });
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
                { "userId.fullName": { $regex: search, $options: "i" } }
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
            { key: "orderId", width: 18 },
            { key: "orderDate", width: 16 },
            { key: "buyer", width: 20 },
            { key: "product", width: 28 },
            { key: "productId", width: 22 },
            { key: "qty", width: 8 },
            { key: "price", width: 12 },
            { key: "category", width: 18 },
            { key: "discount", width: 14 },
            { key: "total", width: 14 }
        ];

        const header = sheet.addRow({
            orderId: "Order ID",
            orderDate: "Order Date",
            buyer: "Buyer",
            product: "Product",
            productId: "Product ID",
            qty: "Qty",
            price: "Price",
            category: "Category",
            discount: "Discount",
            total: "Total"
        });

        header.font = { bold: true };

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
                    buyer: order.userId?.fullName || "Unknown",
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
         errorLogger.error("Sales excel export error", { error: err });
        res.redirect("/admin/pageerror")
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
                { "userId.fullName": { $regex: search, $options: "i" } }
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
                    buyer: order.userId?.fullName || "Unknown",
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
         errorLogger.error("Sales PDF export error", { error: err });
        res.redirect("/admin/pageerror")
    }
};


module.exports = {
  loadAdminLogin,
  adminLogin,
  logout,
  getSalesReport,
  exportSalesExcel,
  exportSalesPDF,

};
