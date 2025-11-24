const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product=require("../../models/productSchema")

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
        status:item.status
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
    const orderId = req.params.orderId;
    const itemId = req.params.itemId;
    const { newStatus } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, msg: "Order not found" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, msg: "Item not found" });
    }

    item.status = newStatus;

    const notCancelled = order.orderedItems.filter(it => it.status !== "cancelled");
    if (notCancelled.length === 0) {
      order.status = "cancelled";
    }

    const allDelivered = order.orderedItems.every(it => it.status === "delivered");
    if (allDelivered) {
      order.status = "delivered";
      order.deliveredOn = new Date();
    }

    await order.save();

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};


const returnItemDecision = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { decision } = req.body;

    if (!decision || (decision !== 'accept' && decision !== 'reject')) {
      return res.status(400).json({ success: false, message: 'Invalid decision' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const item = order.orderedItems.find(i => i._id.toString() === itemId || (i.itemId && i.itemId.toString() === itemId));
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    if (item.status !== 'return_requested') {
      return res.status(400).json({ success: false, message: 'No return request on this item' });
    }

    if (decision === 'accept') {
      item.status = 'returned';
      const product = await Product.findById(item.productId);
      if (product) {
        const variant = product.variants.find(v => v.size === item.size && v.color === item.color);
        if (variant) variant.variantQuantity += item.quantity;
        await product.save();
      }
    } else if (decision === 'reject') {
      item.status = 'delivered';
    }

    order.markModified('orderedItems');
    await order.save();

    return res.json({ success: true, message: `Item return ${decision}ed successfully` });
  } catch (err) {
    console.error('returnItemDecision error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const returnFullOrderDecision = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { decision } = req.body;

    if (!decision || (decision !== 'accept' && decision !== 'reject')) {
      return res.status(400).json({ success: false, message: 'Invalid decision' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.status !== 'return_requested') {
      return res.status(400).json({ success: false, message: 'Full order return not requested' });
    }

    if (decision === 'accept') {
      order.orderedItems.forEach(i => {
        if (i.status === 'return_requested') i.status = 'returned';
      });

      for (const item of order.orderedItems) {
        if (item.status === 'returned') {
          const product = await Product.findById(item.productId);
          if (product) {
            const variant = product.variants.find(v => v.size === item.size && v.color === item.color);
            if (variant) variant.variantQuantity += item.quantity;
            await product.save();
          }
        }
      }

      order.status = 'returned';
    } else if (decision === 'reject') {
      order.orderedItems.forEach(i => {
        if (i.status === 'return_requested') i.status = 'delivered';
      });
      order.status = 'delivered';
    }

    order.markModified('orderedItems');
    await order.save();

    return res.json({ success: true, message: `Order return ${decision}ed successfully` });
  } catch (err) {
    console.error('returnFullOrderDecision error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
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
