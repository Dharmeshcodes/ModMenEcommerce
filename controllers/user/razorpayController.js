const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


const loadOnlinePaymentPage = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId });
    if (!order) return res.redirect("/user/cart");
    const amount = Math.round((order.payableAmount || order.payableTotal || 0) * 100);
    const razorpayOrder = await razorpayInstance.orders.create({ amount, currency: "INR", receipt: `order_rcpt_${orderId}`, payment_capture: 1 });
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();
    return res.render("user/onlinePayment", { order, razorpayOrder, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.log("Razorpay load error:", error);
    return res.redirect("/500");
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await Order.findOneAndUpdate({ orderId }, { $set: { status: "failed", paymentStatus: "failed" } });
      return res.json({ success: false, redirectURL: `/user/orderFailed/${orderId}` });
    }
    const hash = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(razorpay_order_id + "|" + razorpay_payment_id).digest("hex");
    if (hash !== razorpay_signature) {
      await Order.findOneAndUpdate({ orderId }, { $set: { status: "failed", paymentStatus: "failed" } });
      return res.json({ success: false, redirectURL: `/user/orderFailed/${orderId}` });
    }
    const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);
    if (payment.status !== "captured") {
      await Order.findOneAndUpdate({ orderId }, { $set: { status: "failed", paymentStatus: "failed" } });
      return res.json({ success: false, redirectURL: `/user/orderFailed/${orderId}` });
    }
    const order = await Order.findOne({ orderId });
    if (!order) return res.json({ success: false, message: "Order not found" });
    order.paymentStatus = "completed";
    order.status = "confirmed";
    order.orderedItems.forEach(i => i.status = "confirmed");
    await order.save();
    for (let item of order.orderedItems) {
      await Product.updateOne(
        { _id: item.productId, "variants.size": item.size, "variants.color": item.color },
        { $inc: { "variants.$.variantQuantity": -item.quantity } }
      );
    }
    await Cart.updateOne({ userId: order.userId }, { $set: { items: [] } });
    return res.json({ success: true, redirectURL: `/user/orderSuccess/${order.orderId}` });
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
    if (!order) return res.status(400).json({ success: false, message: "Order not found" });
    if (order.paymentStatus !== "failed") return res.status(400).json({ success: false, message: "Payment already completed or retry not allowed" });
    if (order.status === "cancelled") return res.status(400).json({ success: false, message: "Order is cancelled. Retry not allowed" });
    const amount = Math.round((order.payableAmount || order.payableTotal || 0) * 100);
    const razorpayOrder = await razorpayInstance.orders.create({ amount, currency: "INR", receipt: `retry_rcpt_${orderId}`, payment_capture: 1 });
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();
    return res.json({ success: true, redirectURL: `/user/online-payment/${orderId}` });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Error processing retry request" });
  }
};

module.exports={
     loadOnlinePaymentPage,
  verifyRazorpayPayment,
  getOrderFailedPage,
  retryPayment
}