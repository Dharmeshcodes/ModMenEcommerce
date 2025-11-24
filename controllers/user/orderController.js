const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const SubCategory = require("../../models/subcategorySchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/adressSchema");
const Order=require("../../models/orderSchema")
const logger = require('../../config/logger');
const path = require("path");
const ejs = require("ejs");
const puppeteer = require("puppeteer");




const confirmOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { addressId, paymentMethod } = req.body;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
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

      validItems.push(item);
    }

    if (validItems.length === 0) {
      return res.redirect("/user/cart");
    }

    let subTotal = 0;
    let discountAmount = 0;

    validItems.forEach(i => {
      subTotal += i.variantPrice * i.quantity;
      discountAmount += (i.variantPrice - i.salePrice) * i.quantity;
    });

    const cgst = subTotal * 0.09;
    const sgst = subTotal * 0.09;
    const deliveryCharge = subTotal < 1000 ? 50 : 0;

    const payableAmount =
      subTotal - discountAmount + cgst + sgst + deliveryCharge;

    const addressDoc = await Address.findOne({ userId });
    const selectedAddress = addressDoc.address.id(addressId);

    const addressString =
      `${selectedAddress.fullName}, ${selectedAddress.houseNo}, ` +
      `${selectedAddress.city}, ${selectedAddress.landMark}, ` +
      `${selectedAddress.district}, ${selectedAddress.state}, ` +
      `${selectedAddress.pincode}, Phone: ${selectedAddress.phone}`;

    const orderedItems = validItems.map(i => ({
      productId: i.productId._id,
      productName: i.productId.name,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
      price: i.variantPrice,
      salePrice: i.salePrice,
      finalPrice: i.salePrice * i.quantity,
      status: "pending"
    }));

    const order = new Order({
      userId,
      orderedItems,
      subTotal,
      discountAmount,
      deliveryCharge,
      payableAmount,
      address: addressString,
      appliedCoupon: null,
      paymentMethod,
      paymentStatus: "pending",
      status: "pending"
    });

    await order.save();

    for (let i of validItems) {
      await Product.updateOne(
        {
          _id: i.productId._id,
          "variants.size": i.size,
          "variants.color": i.color
        },
        { $inc: { "variants.$.variantQuantity": -i.quantity } }
      );
    }

    cart.items = cart.items.filter(
      c => !validItems.some(
        v =>
          v.productId._id.toString() === c.productId._id.toString() &&
          v.size === c.size &&
          v.color === c.color
      )
    );

    await cart.save();

    return res.redirect("/user/orderSuccess/" + order.orderId);


  } catch (error) {
    logger.error("Confirm Order Error", {
      message: error.message,
      stack: error.stack,
      userId: req.session.user._id
    });
    return res.redirect("/500");
  }
};

const loadOrderSuccess = async (req, res) => {
  try {
     const userId = req.session.user._id;
      const userDetails = await User.findById(userId);

    const orderId = req.params.orderId;

    const order = await Order.findOne({ orderId })
      .populate("orderedItems.productId");

    if (!order) {
      return res.redirect("/user/orders");
    }

    res.render("user/orderSuccess", { 
      order,
      user:userDetails
     });
     
  } catch (error) {
    console.log(error);
    res.redirect("/500");
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

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("orderedItems.productId", "images")
      .lean();

    const formattedOrders = [];

    for (const order of orders) {
      const createdDate = new Date(order.createdOn || order.createdAt);
      const expectedDate = new Date(createdDate);
      expectedDate.setDate(createdDate.getDate() + 10);

      const expectedDelivery = expectedDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short"
      });

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
        moreItems: order.orderedItems.length > 1 
          ? order.orderedItems.length - 1 
          : 0
      });
    }

    return res.render("user/order", {
      orders: formattedOrders,
      currentPage: page,
      totalPages,
      user: userData
    });

  } catch (error) {
    console.log("Error in getUserOrders:", error);
    res.status(500).send("Server Error");
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const orderId = req.params.orderId;

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedItems.productId", "images")
      .lean();

    if (!order) return res.status(404).send("Order not found");

    const createdDate = new Date(order.createdOn || order.createdAt);
    const expectedDate = new Date(createdDate);
    expectedDate.setDate(createdDate.getDate() + 10);

    const expectedDelivery = expectedDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short"
    });

    const cgst = Math.round(order.subTotal * 0.09);
    const sgst = Math.round(order.subTotal * 0.09);
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

    return res.render("user/orderDetails", {
      order,
      items,
      expectedDelivery,
      cgst,
      sgst,
      gstTotal,
      user: req.session.user
    });

  } catch (error) {
    console.log("Error in getOrderDetails:", error);
    res.status(500).send("Server Error");
  }
};


const cancelOrder = async (req, res) => {
  try {
    console.log("control fucntion hit for cancel item")
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.json({ success: false, message: "Cancellation reason required" });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    if (order.status === "cancelled") {
      return res.json({ success: false, message: "Order already cancelled" });
    }

    if (
      order.status === "shipped" ||
      order.status === "out_for_delivery" ||
      order.status === "delivered"
    ) {
      return res.json({
        success: false,
        message: "Order cannot be cancelled at this stage"
      });
    }

    for (let item of order.orderedItems) {
      const product = await Product.findById(item.productId);

      if (!product) continue;

      const variant = product.variants.find(
        (v) => v.size === item.size && v.color === item.color
      );

      if (variant) {
        variant.variantQuantity += item.quantity;
      }

      await product.save();

      item.status = "cancelled";
      item.cancelledOn = new Date();
      item.cancellationReason = reason;
    }

    order.status = "cancelled";
    order.cancelledOn = new Date();
    order.cancellationReason = reason;

   

    await order.save();

    return res.json({
      success: true,
      message: "Order cancelled successfully!"
    });

  } catch (error) {
    return res.json({
      success: false,
      message: "Something went wrong"
    });
  }
};

const cancelSingleItem = async (req, res) => {
  
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    console.log("orderid and item id are ",orderId,itemId)
    console.log(reason)

    if (!reason || reason.trim() === "") {
      return res.json({
        success: false,
        message: "Cancellation reason required"
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(400).json({ success: false, message: "Order not found" });
    }

  
    const item = order.orderedItems.find(
      (i) => i._id.toString() === itemId
    );

    if (!item) {
      return  res.status(400).json({
        success: false,
        message: "Item not found in this order"
      });
    }
 console.log("thestatus before if condition:",item.status)

    if(item.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "This item is already cancelled"
      });
    }

    if (
      item.status === "shipped" ||
      item.status === "out_for_delivery" ||
      item.status === "delivered" ||
      item.status === "returned" ||
      item.status === "return_requested" ||
      item.status === "failed"
    ) {
      return res.status(400).json({
        success: false,
        message: "This item cannot be cancelled at this stage"
      });
    }

    const product = await Product.findById(item.productId);

    if (product) {
      const variant = product.variants.find(
        (v) => v.size === item.size && v.color === item.color
      );

      if (variant) {
        variant.variantQuantity += item.quantity;
      }

      await product.save();
    }


    item.status = "cancelled";
    item.cancellationReason = reason;
    item.cancelledOn = new Date();
    

    const allItems = order.orderedItems;
        const allCancelled = allItems.every(i => i.status === "cancelled");
        const allDelivered = allItems.every(i => i.status === "delivered");
        const allReturned = allItems.every(i => i.status === "returned");
        const allReturnRequested = allItems.every(i => i.status === "return_requested");
        const allOutForDelivery = allItems.every(i => i.status === "out_for_delivery");
        const allShipped = allItems.every(i => i.status === "shipped");
        const allConfirmed = allItems.every(i => i.status === "confirmed");
        const allPending = allItems.every(i => i.status === "pending");
        const allFailed = allItems.every(i => i.status === "failed");

          if (allCancelled) order.status = "cancelled";
        else if (allDelivered) order.status = "delivered";
        else if (allReturned) order.status = "returned";
        else if (allReturnRequested) order.status = "return_requested";
        else if (allOutForDelivery) order.status = "out_for_delivery";
        else if (allShipped) order.status = "shipped";
        else if (allConfirmed) order.status = "confirmed";
        else if (allPending) order.status = "pending";
        else if (allFailed) order.status = "failed";

    await order.save();

    return res.json({
      success: true,
      message: "Item cancelled successfully!"
    });

  } catch (error) {
    console.log(error);
    return res.json({
      success: false,
      message: "Something went wrong"
    });
  }
};
const returnSingleItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    console.log("the cancel singleitem function hit")
      console.log("the orderit",orderId)
      console.log("the itemId",itemId)
    

    if (!reason || reason.trim() === "") {
      return res.json({ success: false, message: "Return reason required" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    const item = order.orderedItems.find(i => i._id.toString() === itemId);
    if (!item) {
      return res.json({ success: false, message: "Item not found" });
    }

    if (item.status !== "delivered") {
      return res.json({ success: false, message: "Return request not allowed at this stage" });
    }

    item.status = "return_requested";
    item.returnReason = reason;

    order.markModified("orderedItems");

    await order.save();

    return res.json({ success: true, message: "Return request submitted" });

  } catch (err) {
    return res.json({ success: false, message: "Something went wrong" });
  }
};

const returnEntireOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ success: false, message: "Return reason required" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Full order return allowed only after delivery"
      });
    }

    let changed = false;

    order.orderedItems.forEach(item => {
      if (item.status === "delivered") {
        item.status = "return_requested";
        item.returnReason = reason;
        changed = true;
      }
    });

    if (!changed) {
      return res.status(400).json({
        success: false,
        message: "No deliverable items eligible for return"
      });
    }

    order.status = "return_requested";

    order.markModified("orderedItems");
    await order.save();

    return res.json({
      success: true,
      message: "Return request submitted for the entire order"
    });

  } catch (err) {
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

    if (order.status !== "delivered")
      return res.status(400).send("Invoice only available after delivery");

    if (!order.invoiceDate) {
      order.invoiceDate = new Date();
      await order.save();
    }

    const templatePath = path.join(__dirname, "../../views/user/invoice.ejs");

    const html = await ejs.renderFile(templatePath, { order });

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px" },
    });

    const filename = `invoice-${order.orderId}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });

    return res.send(pdf);
  } catch (err) {
    console.log("Invoice error:", err);
    res.status(500).send("Error generating invoice");
  } finally {
    if (browser) await browser.close();
  }
};






module.exports={
    confirmOrder,
    loadOrderSuccess,
    getUserOrders,
    getOrderDetails,
    cancelOrder,
   cancelSingleItem,
   returnSingleItem,
   returnEntireOrder,
   generateInvoice

}
