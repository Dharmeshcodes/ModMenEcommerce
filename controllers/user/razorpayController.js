const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const redisClient = require("../../config/redis");

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const loadOnlinePaymentPage = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId });
    if (!order) return res.redirect("/user/cart");

    const activePayment = await redisClient.get(`payment_active:${orderId}`);
    if (activePayment) {
      return res.redirect(`/user/online-payment/${orderId}`);
    }

    const cart = await Cart.findOne({ userId: order.userId }).populate("items.productId");
    for (let item of cart.items) {
      const variant = item.productId.variants.find(v => v.size === item.size && v.color === item.color);
      if (!variant || variant.variantQuantity < item.quantity) {
        await Order.updateOne({ orderId }, { $set: { status: "cancelled", paymentStatus: "failed" } });
        return res.redirect("/user/cart?error=OutOfStock");
      }
    }

    if (!order.paymentSessionId) {
      const paymentSessionId = crypto.randomUUID();

      await redisClient.setEx(
        `payment_active:${orderId}`,
        900,
        paymentSessionId
      );

      await redisClient.setEx(
        `payment_session:${paymentSessionId}`,
        900,
        "valid"
      );

      order.paymentSessionId = paymentSessionId;
      await order.save();
    }

    const amount = Math.round((order.payableAmount || order.payableTotal || 0) * 100);
    const razorpayOrder = await razorpayInstance.orders.create({
      amount,
      currency: "INR",
      receipt: `order_rcpt_${orderId}`,
      payment_capture: 1
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.render("user/onlinePayment", {
      order,
      razorpayOrder,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.log("Razorpay load error:", error);
    return res.redirect("/500");
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order || !order.paymentSessionId) {
      return res.json({
        success: false,
        message: "Invalid or expired payment session"
      });
    }

    const sessionKey = `payment_session:${order.paymentSessionId}`;
    const sessionValid = await redisClient.get(sessionKey);

    if (!sessionValid) {
      return res.json({
        success: false,
        message: "Payment session expired or already used"
      });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await Order.updateOne(
        { orderId },
        { $set: { status: "failed", paymentStatus: "failed" } }
      );
      await redisClient.del(`payment_active:${orderId}`);
      await redisClient.del(`payment_session:${order.paymentSessionId}`);
      return res.json({ success: false, redirectURL: `/user/orderFailed/${orderId}` });
    }

    const hash = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (hash !== razorpay_signature) {
      await Order.updateOne(
        { orderId },
        { $set: { status: "failed", paymentStatus: "failed" } }
      );
      await redisClient.del(`payment_active:${orderId}`);
      await redisClient.del(`payment_session:${order.paymentSessionId}`);
      return res.json({ success: false, redirectURL: `/user/orderFailed/${orderId}` });
    }

    const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);
    if (payment.status !== "captured") {
      await Order.updateOne(
        { orderId },
        { $set: { status: "failed", paymentStatus: "failed" } }
      );
      await redisClient.del(`payment_active:${orderId}`);
      await redisClient.del(`payment_session:${order.paymentSessionId}`);
      return res.json({ success: false, redirectURL: `/user/orderFailed/${orderId}` });
    }

    const cart = await Cart.findOne({ userId: order.userId }).populate("items.productId");
    for (let item of cart.items) {
      const variant = item.productId.variants.find(
        v => v.size === item.size && v.color === item.color
      );
      if (!variant || variant.variantQuantity < item.quantity) {
        await Order.updateOne(
          { orderId },
          { $set: { status: "cancelled", paymentStatus: "failed" } }
        );
        await redisClient.del(`payment_active:${orderId}`);
        await redisClient.del(`payment_session:${order.paymentSessionId}`);
        return res.json({ success: false, redirectURL: "/user/cart?error=OutOfStock" });
      }
    }

    order.paymentStatus = "completed";
    order.status = "confirmed";
    order.orderedItems.forEach(i => (i.status = "confirmed"));
    await order.save();

    for (let item of order.orderedItems) {
      await Product.updateOne(
        { _id: item.productId, "variants.size": item.size, "variants.color": item.color },
        { $inc: { "variants.$.variantQuantity": -item.quantity } }
      );
    }

    await Cart.updateOne({ userId: order.userId }, { $set: { items: [] } });

    await redisClient.del(`payment_active:${orderId}`);
    await redisClient.del(`payment_session:${order.paymentSessionId}`);

    return res.json({
      success: true,
      redirectURL: `/user/orderSuccess/${order.orderId}`
    });
  } catch (error) {
    console.log("Payment verification error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getOrderFailedPage = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId });
    if (!order) return res.redirect("/user/order");
    return res.render("user/orderFailed", { order });
  } catch (error) {
    console.log("Order failed page error:", error);
    return res.redirect("/user/Page-404.ejs");
  }
};

const retryPayment = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(400).json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== "failed") {
      return res.status(400).json({ success: false, message: "Payment already completed or retry not allowed" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Order is cancelled. Retry not allowed" });
    }

    await redisClient.del(`payment_active:${orderId}`);

    if (order.paymentSessionId) {
      await redisClient.del(`payment_session:${order.paymentSessionId}`);
    }

    const cart = await Cart.findOne({ userId: order.userId }).populate("items.productId");
    for (let item of cart.items) {
      const variant = item.productId.variants.find(
        v => v.size === item.size && v.color === item.color
      );
      if (!variant || variant.variantQuantity < item.quantity) {
        await Order.updateOne(
          { orderId },
          { $set: { status: "cancelled", paymentStatus: "failed" } }
        );
        return res.json({ success: false, redirectURL: "/user/cart?error=OutOfStock" });
      }
    }

    const newPaymentSessionId = crypto.randomUUID();

    await redisClient.setEx(
      `payment_active:${orderId}`,
      900,
      newPaymentSessionId
    );

    await redisClient.setEx(
      `payment_session:${newPaymentSessionId}`,
      900,
      "valid"
    );

    order.paymentSessionId = newPaymentSessionId;

    const amount = Math.round((order.payableAmount || order.payableTotal || 0) * 100);

    const razorpayOrder = await razorpayInstance.orders.create({
      amount,
      currency: "INR",
      receipt: `retry_rcpt_${orderId}`,
      payment_capture: 1
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.json({
      success: true,
      redirectURL: `/user/online-payment/${orderId}`
    });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Error processing retry request" });
  }
};

module.exports = {
  loadOnlinePaymentPage,
  verifyRazorpayPayment,
  getOrderFailedPage,
  retryPayment
};
