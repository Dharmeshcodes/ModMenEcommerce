const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");

const loadUserCoupons = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userData = await User.findById(userId);

    let coupons = await Coupon.find({
      status: true,
      expiryDate: { $gte: new Date() }
    }).sort({ expiryDate: 1 });

    coupons = coupons.filter(c => {
      const entry = c.usedUsers.find(u => u.userId.toString() === userId.toString());
      const used = entry ? entry.count : 0;
      return used < c.usagePerUser;
    });

    return res.render("user/coupon", {
      user: userData,
      coupons
    });

  } catch (error) {
    console.log(error);
    return res.redirect("/500");
  }
};

async function computeTotals(userId) {
  const cart = await Cart.findOne({ userId }).populate("items.productId");
  let subtotal = 0;

  cart.items.forEach(i => {
    subtotal += i.salePrice * i.quantity;
  });

  const tax = subtotal * 0.18;
  const shipping = subtotal < 1000 ? 50 : 0;
  const payable = subtotal + tax + shipping;

  return { subtotal, tax, shipping, payable };
}

const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { code } = req.body;

    const coupon = await Coupon.findOne({ code: code.trim() });
    if (!coupon) return res.status(404).json({ message: "Invalid Coupon" });

    if (!coupon.status) return res.status(400).json({ message: "Coupon is inactive" });

    if (new Date() > coupon.expiryDate)
      return res.status(400).json({ message: "Coupon expired" });

    if (new Date() < coupon.startDate)
      return res.status(400).json({ message: "Coupon not active yet" });

    const entry = coupon.usedUsers.find(u => u.userId.toString() === userId.toString());
    const userUsedCount = entry ? entry.count : 0;

    if (userUsedCount >= coupon.usagePerUser)
      return res.status(400).json({ message: "You already used this coupon" });

    const { subtotal, tax, shipping, payable } = await computeTotals(userId);

    if (subtotal < coupon.minimumOrderAmount) {
      return res.status(400).json({
        message: `Minimum order amount is ₹${coupon.minimumOrderAmount}`
      });
    }

    let discount = 0;

    if (coupon.type === "percentage") {
      discount = Math.floor((coupon.discountValue / 100) * subtotal);
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      discount = coupon.discountValue;
    }

    const finalTotal = payable - discount;

    req.session.appliedCoupon = {
      code: coupon.code,
      discount,
      subtotal,
      tax,
      shipping,
      finalTotal
    };

    return res.json({
      success: true,
      discount,
      newTotal: finalTotal
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
};

const cancelCoupon = async (req, res) => {
  delete req.session.appliedCoupon;
  return res.json({ success: true });
};

const availableCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({
      status: true,
      expiryDate: { $gte: new Date() }
    }).select("name code description type discountValue minimumOrderAmount expiryDate");


    return res.json({
      success: true,
      coupons
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: "Failed to load coupons"
    });
  }
};


module.exports = {
  applyCoupon,
  cancelCoupon,
  availableCoupons,
  loadUserCoupons
};
