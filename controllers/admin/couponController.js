const Coupon = require("../../models/couponSchema");

const loadCouponPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const filter = req.query.filter || "all";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    let query = {};

    if (search.trim() !== "") {
      query.code = { $regex: search.trim(), $options: "i" };
    }

    if (filter === "active") {
      query.status = true;
    } else if (filter === "inactive") {
      query.status = false;
    }

    const [coupons, totalCoupons] = await Promise.all([
      Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCoupons / limit);

    return res.render("admin/coupon-list", {
      coupons,
      search,
      filter,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    return res.redirect("/admin/error");
  }
};


const loadAddCouponPage = async (req, res) => {
  try {
    return res.render("admin/add-coupon");
  } catch (error) {
    return res.redirect("/admin/error");
  }
};

const addCoupon = async (req, res) => {
  try {
    const {
      name,
      code,
      type,
      description,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      startDate,
      expiryDate,
      usagePerUser
    } = req.body;

    const exists = await Coupon.findOne({ code });
    if (exists) {
      return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }

    const coupon = new Coupon({
      name,
      code,
      type,
      description,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      startDate,
      expiryDate,
      usagePerUser
    });

    await coupon.save();

    return res.status(200).json({ success: true, message: "Coupon successfully added" });

  } catch (error) {
    return res.status(500).json({ success: false, message: "There is an error in adding coupon" });
  }
};

const loadEditCouponPage = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    return res.render("admin/edit-coupon", { coupon });
  } catch (error) {
    return res.redirect("/admin/error");
  }
};

const updateCoupon = async (req, res) => {
  try {
    console.log("edit coupon controller function hit")
    const {
      name,
      code,
      description,
      type,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      startDate,
      expiryDate,
      usagePerUser,
      status
    } = req.body;

    const exists = await Coupon.findOne({
      code,
      _id: { $ne: req.params.id }
    });

    if (exists) {
      return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }

    await Coupon.findByIdAndUpdate(req.params.id, {
      name,
      code,
      type,
      description,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      startDate,
      expiryDate,
      usagePerUser,
      status
    });

    return res.status(200).json({ success: true, message: "Coupon updated successfully" });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};


const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    const exists = await Coupon.findById(couponId);
    if (!exists) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    await Coupon.findByIdAndDelete(couponId);

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while deleting coupon"
    });
  }
};
const toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.params.id;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    coupon.status = !coupon.status; 
    await coupon.save();

    return res.status(200).json({
      success: true,
      status: coupon.status
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};




module.exports = {
  loadCouponPage,
  loadAddCouponPage,
  addCoupon,
  loadEditCouponPage,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
};
