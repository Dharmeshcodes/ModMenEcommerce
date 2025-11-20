const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const SubCategory = require("../../models/subcategorySchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/adressSchema");
const Order=require("../../models/orderSchema")
const logger = require('../../config/logger');




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


module.exports={
    confirmOrder,
    loadOrderSuccess
}
