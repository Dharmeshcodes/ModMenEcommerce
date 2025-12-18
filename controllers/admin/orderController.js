const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product=require("../../models/productSchema")
const Wallet = require("../../models/walletSchema");
const { addMoneyToWallet, deductMoneyFromWallet } = require("../../utils/walletUtils");

const getAdminOrderlist = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 7;
    const skip = (page - 1) * limit;

    const statusFilter = req.query.status || "";
    const search = req.query.search?.trim() || "";

    let query = {};

    if (statusFilter) {
      query.status = statusFilter;
    }

    if (search) {
      const regex = new RegExp(search, "i");

      query.$or = [
        { orderId: regex },
        { "orderedItems.productName": regex },
        { customerName: regex }
      ];
    }

    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "fullName")
      .populate("orderedItems.productId", "images")
      .lean();

    const formattedOrders = [];

    for (const order of orders) {
      const first = order.orderedItems[0];
      let imageUrl = "/images/no-img.png";

      if (first?.productId?.images?.length > 0) {
        const imgs = first.productId.images;
        imageUrl = imgs.find(i => i.isMain)?.url || imgs[0].url;
      }

      formattedOrders.push({
        ...order,
        imageUrl,
        customerName: order.userId?.fullName,
        moreItems: order.orderedItems.length - 1
      });
    }

    const totalPages = Math.ceil(totalOrders / limit);

    return res.render("admin/orders", {
      orders: formattedOrders,
      currentPage: page,
      totalPages,
      totalOrders,
      limit,
      search,
      status: statusFilter
    });

  } catch (error) {
    console.log("Admin Order List Error:", error);
    return res.status(500).send("Server Error");
  }
};



const getAdminOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const order = await Order.findOne({ orderId })
      .populate("userId", "fullName email mobile")
      .populate("orderedItems.productId", "images sku name")
      .lean();

    if (!order) return res.status(404).send("Order not found");

    const createdDate = new Date(order.createdOn || order.createdAt || order.invoiceDate);
    const expectedDate = new Date(createdDate);
    expectedDate.setDate(createdDate.getDate() + 10);
    const expectedDelivery = expectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    const cgst = Math.round((order.subTotal || 0) * 0.09);
    const sgst = Math.round((order.subTotal || 0) * 0.09);
    const gstTotal = cgst + sgst;

    const items = [];
    for (const item of order.orderedItems) {
      let mainImage = "images/no-image.png";
      const product = item.productId;
      if (product?.images?.length > 0) {
        mainImage = product.images.find(i => i.isMain)?.url || product.images[0].url;
      }
      items.push({
        productName: item.productName || product?.name || 'Product',
        sku: product?.sku || item.sku || '',
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.salePrice,
        total: item.finalPrice || (item.salePrice * item.quantity),
        image: mainImage,
        itemId: item._id,
        status:item.status,
        returnReason: item.returnReason || "" 
      });
    }

    return res.render('admin/orderDetails', {
      order,
      items,
      expectedDelivery,
      cgst,
      sgst,
      gstTotal,
      user: req.session.admin || req.session.user || {}
    });
  } catch (err) {
    console.log("getAdminOrderDetails error:", err);
    return res.status(500).send("Server Error");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { newStatus } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, msg: "Order not found" });
    }

    if (order.status === "cancelled") {
      return res.json({ success: false, msg: "Cancelled order cannot be modified" });
    }

    if (order.status === "delivered") {
      const allowed = ["return_requested", "returned", "failed", "delivered"];

      if (!allowed.includes(newStatus)) {
        return res.json({
          success: false,
          msg: "Delivered order cannot change to this status"
        });
      }
    }

    order.status = newStatus;

    if (newStatus === "delivered") {
      order.deliveredOn = new Date();
    }

    order.orderedItems.forEach(item => {
      item.status = newStatus;
      if (newStatus === "delivered") {
        item.deliveredOn = new Date();
      }
    });

    order.markModified("orderedItems");
    await order.save();

    return res.json({ success: true });

  } catch (error) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

const updateOrderItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { newStatus } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, msg: "Order not found" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, msg: "Item not found" });
    }

    const blockedBackwards = ["pending", "confirmed", "shipped", "out_for_delivery", "cancelled"];

        if (item.status === "delivered" && blockedBackwards.includes(newStatus)) {
          return res.json({
            success: false,
            msg: "Delivered product status cannot be changed"
          });
        }

        if (item.status === "cancelled" && item.status !== newStatus) {
          return res.json({
            success: false,
            msg: "Cancelled product status cannot be changed"
          });
        }


    item.status = newStatus;

    const allCancelled = order.orderedItems.every(i => i.status === "cancelled");
    const allDelivered = order.orderedItems.every(i => i.status === "delivered");
    const allShipped = order.orderedItems.every(i => i.status === "shipped");
    const allConfirmed = order.orderedItems.every(i => i.status === "confirmed");
    const allOFD = order.orderedItems.every(i => i.status === "out_for_delivery");
    const anyReturnRequested = order.orderedItems.some(i => i.status === "return_requested");
    const allReturned = order.orderedItems.every(i => i.status === "returned");

    if (allCancelled) {
      order.status = "cancelled";
    } 
    else if (allDelivered) {
      order.status = "delivered";
      order.deliveredOn = new Date();
    }
    else if (allReturned) {
      order.status = "returned";
    }
    else if (anyReturnRequested) {
      order.status = "return_requested";
    }
    else if (allOFD) {
      order.status = "out_for_delivery";
    }
    else if (allShipped) {
      order.status = "shipped";
    }
    else if (allConfirmed) {
      order.status = "confirmed";
    }

    await order.save();

    return res.json({ success: true });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};
const returnItemDecision = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { decision } = req.body;

    if (!["accept_nostock", "accept_addstock", "reject"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision"
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const item = order.orderedItems.find(
      i => i._id.toString() === itemId
    );
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    if (item.status !== "return_requested") {
      return res.status(400).json({
        success: false,
        message: "No return request on this item"
      });
    }

    if (
      (decision === "accept_nostock" || decision === "accept_addstock") &&
      order.appliedCoupon &&
      order.couponDiscount > 0
    ) {
      const coupon = await Coupon.findOne({ code: order.appliedCoupon });

      if (coupon) {
        const remainingSubtotal = order.orderedItems
          .filter(i =>
            i._id.toString() !== itemId &&
            !["cancelled", "returned"].includes(i.status)
          )
          .reduce((sum, i) => sum + (i.salePrice * i.quantity), 0);

        if (remainingSubtotal < coupon.minimumOrderAmount) {
          return res.status(400).json({
            success: false,
            message: "Single item return not allowed as applied coupon will become invalid"
          });
        }
      }
    }

    if (decision === "reject") {
      item.status = "delivered";
    }

    if (decision === "accept_nostock" || decision === "accept_addstock") {
      const itemTotal = item.salePrice * item.quantity;

      const orderSaleTotal = order.orderedItems
        .filter(i => !["cancelled", "returned"].includes(i.status))
        .reduce((sum, i) => sum + (i.salePrice * i.quantity), 0);

      let couponShare = 0;
      if (order.couponDiscount > 0 && orderSaleTotal > 0) {
        couponShare = Math.round(
          (itemTotal / orderSaleTotal) * order.couponDiscount
        );
      }

      const cgst = itemTotal * 0.09;
      const sgst = itemTotal * 0.09;

      let refundAmount = itemTotal + cgst + sgst - couponShare;

      const remainingActiveItems = order.orderedItems.filter(i =>
        i._id.toString() !== itemId &&
        !["cancelled", "returned"].includes(i.status)
      );

      if (remainingActiveItems.length === 0 && order.deliveryCharge > 0) {
        refundAmount += order.deliveryCharge;
      }

      item.status = "returned";

      if (order.paymentMethod !== "cod") {
        await addMoneyToWallet(order.userId, refundAmount, {
          description: "Refund for returned item",
          method: order.paymentMethod,
          orderId
        });
      }

      if (decision === "accept_addstock") {
        const product = await Product.findById(item.productId);
        if (product) {
          const variant = product.variants.find(
            v => v.size === item.size && v.color === item.color
          );
          if (variant) {
            variant.variantQuantity += item.quantity;
          }
          await product.save();
        }
      }
    }

    const activeItems = order.orderedItems.filter(i =>
      !["cancelled", "returned"].includes(i.status)
    );

    if (activeItems.length === 0) {
      order.status = "returned";
    } else if (order.orderedItems.some(i => i.status === "return_requested")) {
      order.status = "return_requested";
    }

    order.markModified("orderedItems");
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Item return ${decision} processed`
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

const returnFullOrderDecision = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { decision } = req.body;

    if (!["accept_nostock", "accept_addstock", "reject"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision"
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.status !== "return_requested") {
      return res.status(400).json({
        success: false,
        message: "Full order return not requested"
      });
    }

    const returnRequestedItems = order.orderedItems.filter(
      i => i.status === "return_requested"
    );

    if (returnRequestedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items eligible for return"
      });
    }

    if (decision === "reject") {
      returnRequestedItems.forEach(i => {
        i.status = "delivered";
      });

      order.status = "delivered";
    }

    if (decision === "accept_nostock" || decision === "accept_addstock") {
      returnRequestedItems.forEach(i => {
        i.status = "returned";
      });

      if (order.paymentMethod !== "cod") {
        await addMoneyToWallet(order.userId, order.payableAmount, {
          description: "Refund for full order return",
          method: order.paymentMethod,
          orderId
        });
      }

      if (decision === "accept_addstock") {
        for (const item of returnRequestedItems) {
          const product = await Product.findById(item.productId);
          if (product) {
            const variant = product.variants.find(
              v => v.size === item.size && v.color === item.color
            );
            if (variant) {
              variant.variantQuantity += item.quantity;
            }
            await product.save();
          }
        }
      }

      order.status = "returned";
      order.paymentStatus = "refunded";
    }

    order.markModified("orderedItems");
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order return ${decision} processed`
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};



module.exports = {
  getAdminOrderlist,
  getAdminOrderDetails,
  updateOrderStatus,
  updateOrderItemStatus,
  returnFullOrderDecision,
  returnItemDecision
 
};
