const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const SubCategory = require("../../models/subcategorySchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/adressSchema");
const Order = require("../../models/orderSchema");
const logger = require('../../config/logger');
const path = require("path");
const ejs = require("ejs");
const puppeteer = require("puppeteer");
const Coupon=require("../../models/couponSchema")
const Razorpay = require("razorpay");

const Wallet = require("../../models/walletSchema");
const { addMoneyToWallet, deductMoneyFromWallet } = require("../../utils/walletUtils");


const confirmOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { addressId, paymentMethod } = req.body;
    const appliedCoupon = req.session.appliedCoupon || null;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.redirect("/user/cart");
    }

    const validItems = [];
    for (let item of cart.items) {
      const product = await Product.findById(item.productId)
        .populate("categoryId")
        .populate("subCategoryId");

      if (!product) continue;
      if (!product.isListed || product.isDeleted) continue;
      if (product.categoryId?.isDeleted || !product.categoryId?.isListed) continue;
      if (product.subCategoryId?.isDeleted || !product.subCategoryId?.isListed) continue;

      const variant = product.variants.find(
        v => v.color === item.color && v.size === item.size
      );

      if (!variant) continue;
      if (variant.variantQuantity <= 0) continue;

      item.variantPrice = variant.variantPrice;
      item.salePrice = variant.salePrice;
      item.productId = product;

      validItems.push(item);
    }

    if (validItems.length === 0) {
      return res.redirect("/user/cart");
    }

    let subtotal = 0;
    let offerDiscount = 0;

    validItems.forEach(i => {
      subtotal += i.salePrice * i.quantity;
      offerDiscount += (i.variantPrice - i.salePrice) * i.quantity;
    });

    subtotal = +subtotal.toFixed(2);
    offerDiscount = +offerDiscount.toFixed(2);

    const tax = +(subtotal * 0.18).toFixed(2);
    const cgst = +(tax / 2).toFixed(2);
    const sgst = +(tax / 2).toFixed(2);

    const addressDoc = await Address.findOne({ userId });
    let selectedAddress = null;

    if (addressDoc) {
      selectedAddress =
        addressDoc.address.id(addressId) ||
        addressDoc.address.find(a => a.isDefault) ||
        addressDoc.address[0];
    }

    if (!selectedAddress) {
      return res.redirect("/user/checkout-address");
    }

    let shippingCharge = 50;
    if (selectedAddress?.state) {
      const state = selectedAddress.state.trim().toLowerCase();
      if (state === "kerala") {
        shippingCharge = 0;
      }
    }

    let couponDiscount = 0;
    if (appliedCoupon && appliedCoupon.discount) {
      couponDiscount = +appliedCoupon.discount;
    }

    let payableTotal = +(subtotal + tax + shippingCharge - couponDiscount).toFixed(2);
    if (payableTotal < 0) payableTotal = 0;

    delete req.session.appliedCoupon;

    const addressString = `${selectedAddress.fullName}, ${selectedAddress.houseNo}, ${selectedAddress.city}, ${selectedAddress.landMark}, ${selectedAddress.district}, ${selectedAddress.state}, ${selectedAddress.pincode}, Phone: ${selectedAddress.phone}`;

    const orderedItems = validItems.map(i => ({
      productId: i.productId._id,
      productName: i.productId.name,
      category: i.productId.categoryId?.name || "Unknown",
      subCategory: i.productId.subCategoryId?.name || "Unknown",
      size: i.size,
      color: i.color,
      quantity: i.quantity,
      price: i.variantPrice,
      salePrice: i.salePrice,
      finalPrice: i.salePrice * i.quantity,
      status: "pending"
    }));

    const orderData = {
      userId,
      orderedItems,
      subTotal: subtotal,
      subtotal,
      discountAmount: offerDiscount,
      offerDiscount,
      deliveryCharge:shippingCharge,
      couponDiscount,
      appliedCoupon: appliedCoupon ? appliedCoupon.code : null,
      payableAmount: payableTotal,
      payableTotal,
      address: addressString,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" || paymentMethod === "wallet" ? "completed" : "pending",
      status: paymentMethod === "cod" || paymentMethod === "wallet" ? "confirmed" : "pending"
    };

    if (paymentMethod === "cod" && payableTotal > 1000) {
      req.flash("error_msg", "COD is not available for orders above ₹1000.");
      return res.redirect("/user/checkoutPayment?addressId=" + addressId);
    }

    if (paymentMethod === "cod") {
      const order = new Order(orderData);
      await order.save();

      for (let i of validItems) {
        await Product.updateOne(
          { _id: i.productId._id, "variants.size": i.size, "variants.color": i.color },
          { $inc: { "variants.$.variantQuantity": -i.quantity } }
        );
      }

      cart.items = cart.items.filter(c =>
        !validItems.some(v =>
          v.productId._id.toString() === c.productId._id.toString() &&
          v.size === c.size &&
          v.color === c.color
        )
      );

      await cart.save();
      return res.redirect("/user/orderSuccess/" + order.orderId);
    }

    if (paymentMethod === "razorpay") {
      const order = new Order(orderData);
      await order.save();
      req.session.tempOrderId = order.orderId;
      return res.redirect(`/user/online-payment/${order.orderId}`);
    }

    if (paymentMethod === "wallet") {
      const wallet = await Wallet.findOne({ userId });

      if (!wallet || wallet.balance < payableTotal) {
        req.flash("error_msg", "Insufficient wallet balance");
        return res.redirect("/user/checkoutPayment?addressId=" + addressId);
      }

      await deductMoneyFromWallet(
        userId,
        payableTotal,
        { description: "Order Payment", method: "wallet_payment" }
      );

      orderedItems.forEach(item => item.status = "confirmed");

      const order = new Order(orderData);
      order.paymentStatus = "completed";
      order.status = "confirmed";
      await order.save();

      for (let i of validItems) {
        await Product.updateOne(
          { _id: i.productId._id, "variants.size": i.size, "variants.color": i.color },
          { $inc: { "variants.$.variantQuantity": -i.quantity } }
        );
      }

      cart.items = cart.items.filter(c =>
        !validItems.some(v =>
          v.productId._id.toString() === c.productId._id.toString() &&
          v.size === c.size &&
          v.color === c.color
        )
      );

      await cart.save();
      return res.redirect("/user/orderSuccess/" + order.orderId);
    }

    return res.redirect("/user/cart");

  } catch (error) {
    console.log("Confirm Order Error:", error);
    return res.redirect("/500");
  }
};


const loadOrderSuccess = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userDetails = await User.findById(userId);
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId }).populate("orderedItems.productId");
    if (!order) return res.redirect("/user/orders");
    return res.render("user/orderSuccess", { order, user: userDetails });
  } catch (error) {
    console.log(error);
    return res.redirect("/500");
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userData = await User.findById(userId);
    const limit = 3;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const totalOrders = await Order.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit);
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("orderedItems.productId", "images").lean();
    const formattedOrders = [];
    for (const order of orders) {
      const createdDate = new Date(order.createdOn || order.createdAt);
      const expectedDate = new Date(createdDate);
      expectedDate.setDate(createdDate.getDate() + 10);
      const expectedDelivery = expectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const firstItem = order.orderedItems[0];
      let mainImage = "/images/no-img.png";
      if (firstItem?.productId?.images?.length > 0) {
        const imgs = firstItem.productId.images;
        mainImage = imgs.find(i => i.isMain)?.url || imgs[0].url;
      }
      formattedOrders.push({
        ...order,
        status: order.status,
        expectedDelivery,
        imageUrl: mainImage,
        moreItems: order.orderedItems.length > 1 ? order.orderedItems.length - 1 : 0
      });
    }
    return res.render("user/order", { orders: formattedOrders, currentPage: page, totalPages, user: userData });
  } catch (error) {
    console.log("Error in getUserOrders:", error);
    return res.status(500).send("Server Error");
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId, userId }).populate("orderedItems.productId", "images").lean();
    if (!order) return res.status(404).send("Order not found");
    const createdDate = new Date(order.createdOn || order.createdAt);
    const expectedDate = new Date(createdDate);
    expectedDate.setDate(createdDate.getDate() + 10);
    const expectedDelivery = expectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const baseSubtotal = order.subTotal || order.subtotal || 0;
    const cgst = Math.round(baseSubtotal * 0.09);
    const sgst = Math.round(baseSubtotal * 0.09);
    const gstTotal = cgst + sgst;
    let items = [];
    for (const item of order.orderedItems) {
      let mainImage = "/images/no-img.png";
      const product = item.productId;
      if (product?.images?.length > 0) {
        mainImage = product.images.find(i => i.isMain)?.url || product.images[0].url;
      }
      items.push({
        productName: item.productName,
        size: item.size,
        color: item.color,
        price: item.salePrice,
        quantity: item.quantity,
        status: item.status,
        image: mainImage,
        itemId: item._id
      });
    }
    return res.render("user/orderDetails", { order, items, expectedDelivery, cgst, sgst, gstTotal, user: req.session.user });
  } catch (error) {
    console.log("Error in getOrderDetails:", error);
    return res.status(500).send("Server Error");
  }
};
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim() === "") return res.json({ success: false, message: "Cancellation reason required" });

    const order = await Order.findOne({ orderId });
    if (!order) return res.json({ success: false, message: "Order not found" });

    if (order.status === "cancelled") return res.json({ success: false, message: "Order already cancelled" });

    if (["shipped", "out_for_delivery", "delivered"].includes(order.status)) {
      return res.json({ success: false, message: "Order cannot be cancelled at this stage" });
    }

    const subtotal = order.subTotal || 0;
    const couponDiscount = order.couponDiscount || 0;
    let totalRefund = 0;

    for (let item of order.orderedItems) {
       if (item.status === "cancelled") {
        continue;
      }

      const product = await Product.findById(item.productId);
      if (product) {
        const variant = product.variants.find(v => v.size === item.size && v.color === item.color);
        if (variant) {
          variant.variantQuantity += item.quantity;
          await product.save();
        }
      }

      const itemTotal = (item.salePrice || 0) * (item.quantity || 0);
      const itemShare = subtotal > 0 ? itemTotal / subtotal : 0;
      const itemCouponShare = couponDiscount * itemShare;
      const itemCGST = itemTotal * 0.09;
      const itemSGST = itemTotal * 0.09;
      const itemRefund = itemTotal + itemCGST + itemSGST - itemCouponShare;
      totalRefund += itemRefund;

      item.status = "cancelled";
      item.cancellationReason = reason;
      item.cancelledOn = new Date();
    }

    totalRefund += order.deliveryCharge || 0;

    if (["wallet", "razorpay"].includes(order.paymentMethod)) {
      await addMoneyToWallet(order.userId, totalRefund, {
        description: "Order Cancelled Refund",
        method: order.paymentMethod,
        orderId: order.orderId
      });
    }

    if (order.appliedCoupon) {
      const coupon = await Coupon.findOne({ code: order.appliedCoupon });
      if (coupon) {
        const entryIndex = coupon.usedUsers.findIndex(u => u.userId.toString() === order.userId.toString());
        if (entryIndex !== -1) {
          if (coupon.usedUsers[entryIndex].count > 1) coupon.usedUsers[entryIndex].count -= 1;
          else coupon.usedUsers.splice(entryIndex, 1);
          await coupon.save();
        }
      }
    }

    order.status = "cancelled";
    order.paymentStatus = "refunded";
    order.cancelledOn = new Date();
    order.cancellationReason = reason;
    await order.save();

    return res.json({ success: true, message: "Order cancelled & refunded" });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Something went wrong" });
  }
};

const cancelSingleItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    console.log("oderid is",orderId)
     console.log("itemid is",itemId)
      console.log("reson is",reason)

    if (!reason || reason.trim() === "") {
      return res.json({ success: false, message: "Cancellation reason required" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.orderedItems.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });
    console.log("the items are",item)

    if (item.status === "cancelled") {
      return res.json({ success: false, message: "This item is already cancelled" });
    }

    if (["shipped", "out_for_delivery", "delivered"].includes(item.status)) {
      return res.json({ success: false, message: "Item cannot be cancelled at this stage" });
    }


    const product = await Product.findById(item.productId);
    console.log("the products are",product)
    if (product) {
      const variant = product.variants.find(
        v => v.size === item.size && v.color === item.color
      );
      if (variant) variant.variantQuantity += item.quantity;
      await product.save();
    }

    const itemTotal = item.salePrice * item.quantity;
    console.log("the itemTotal",itemTotal)

    let itemCouponShare = 0;
    if (order.couponDiscount > 0) {
      const orderSaleTotal = order.orderedItems
        .filter(i => i.status !== "cancelled")
        .reduce((sum, i) => sum + (i.salePrice * i.quantity), 0);

      itemCouponShare = (itemTotal / orderSaleTotal) * order.couponDiscount;
      itemCouponShare = Math.round(itemCouponShare);
    }

    const cgst = itemTotal * 0.09
    const sgst = itemTotal * 0.09;

    let refundAmount = itemTotal + cgst + sgst - itemCouponShare;

    if (order.deliveryCharge > 0) {
      const activeItems = order.orderedItems.filter(i => i.status !== "cancelled").length;
      if (activeItems === 1) {
        refundAmount += order.deliveryCharge;
      }
    }

    if (["wallet", "razorpay"].includes(order.paymentMethod)) {
      await addMoneyToWallet(order.userId, refundAmount, {
        description: "Refund for cancelled item",
        method: order.paymentMethod,
        orderId: order.orderId
      });
    }

    item.status = "cancelled";
    item.cancellationReason = reason;
    item.cancelledOn = new Date();

    const remainingActive = order.orderedItems.filter(i =>
      !["cancelled", "returned"].includes(i.status)
    );

    if (remainingActive.length === 0) {
      order.status = "cancelled";
    }

    await order.save();

    return res.json({ success: true, message: "Item cancelled successfully!" });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Something went wrong" });
  }
};


const returnSingleItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim() === "") return res.json({ success: false, message: "Return reason required" });

    const order = await Order.findOne({ orderId });
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.orderedItems.find(i => i._id.toString() === itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    if (item.status !== "delivered") return res.json({ success: false, message: "Return request not allowed at this stage" });

    item.status = "return_requested";
    item.returnReason = reason;

    order.markModified("orderedItems");
    await order.save();

    return res.json({ success: true, message: "Return request submitted" });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};

const returnEntireOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim() === "") return res.status(400).json({ success: false, message: "Return reason required" });

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.status !== "delivered") return res.status(400).json({ success: false, message: "Full order return allowed only after delivery" });

    let changed = false;
    order.orderedItems.forEach(item => {
      if (item.status === "delivered") {
        item.status = "return_requested";
        item.returnReason = reason;
        changed = true;
      }
    });

    if (!changed) return res.status(400).json({ success: false, message: "No deliverable items eligible for return" });

    order.status = "return_requested";

    order.markModified("orderedItems");
    await order.save();

    return res.json({ success: true, message: "Return request submitted for the entire order" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};


const generateInvoice = async (req, res) => {
  let browser;
  try {
    const { orderId } = req.params;
    const userId = req.session.user._id;
    const order = await Order.findOne({ orderId, userId }).populate("userId");
    if (!order) return res.status(404).send("Order not found");
    if (order.status !== "delivered") return res.status(400).send("Invoice only available after delivery");
    if (!order.invoiceDate) {
      order.invoiceDate = new Date();
      await order.save();
    }
    const templatePath = path.join(__dirname, "../../views/user/invoice.ejs");
    const html = await ejs.renderFile(templatePath, { order });
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "20px", bottom: "20px" } });
    const filename = `invoice-${order.orderId}.pdf`;
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` });
    return res.send(pdf);
  } catch (err) {
    console.log("Invoice error:", err);
    return res.status(500).send("Error generating invoice");
  } finally {
    if (browser) await browser.close();
  }
};


module.exports = {
  confirmOrder,
  loadOrderSuccess,
  getUserOrders,
  getOrderDetails,
  cancelOrder,
  cancelSingleItem,
  returnSingleItem,
  returnEntireOrder,
  generateInvoice,
 
};
