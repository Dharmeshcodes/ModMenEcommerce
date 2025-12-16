const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const SubCategory = require("../../models/subcategorySchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/adressSchema");
const Wallet = require("../../models/walletSchema");



const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userData = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    let errorMessage = null;

    if (!cart || cart.items.length === 0) {
      return res.render("user/cart", {
        user: userData,
        items: [],
        grandTotal: 0,
        tax: 0,
        shippingCharge: 0,
        payableTotal: 0,
        errorMessage: "Your cart is empty."
      });
    }

    const validItems = [];

    for (let item of cart.items) {
      const product = await Product.findById(item.productId)
        .populate("categoryId")
        .populate("subCategoryId");

      if (
        !product ||
        product.isDeleted ||
        !product.isListed ||
        !product.categoryId ||
        product.categoryId.isDeleted ||
        !product.subCategoryId ||
        product.subCategoryId.isDeleted
      ) {
        errorMessage = "Some unavailable products were removed from your cart.";
        continue;
      }

      const variant = product.variants.find(
        v => v.color === item.color && v.size === item.size
      );

      if (!variant) {
        errorMessage = "Some unavailable products were removed.";
        continue;
      }

      const stock = variant.variantQuantity;

      if (stock <= 0) {
        item.productId.stock = 0;
        validItems.push(item);
        continue;
      }

      if (item.quantity > stock) {
        item.quantity = stock;
        errorMessage = "Quantities adjusted due to stock changes.";
      }

      item.salePrice = variant.salePrice;
      item.productId.stock = stock;
      validItems.push(item);
    }

    cart.items = validItems;
    await cart.save();

    const inStockItems = cart.items.filter(i => i.productId.stock > 0);

    if (inStockItems.length === 0) {
      return res.render("user/cart", {
        user: userData,
        items: cart.items,
        grandTotal: 0,
        tax: 0,
        shippingCharge: 0,
        payableTotal: 0,
        errorMessage: "All items in your cart are out of stock."
      });
    }

    let grandTotal = 0;
    inStockItems.forEach(i => {
      grandTotal += i.quantity * i.salePrice;
    });

    const tax = +(grandTotal * 0.18).toFixed(2);

    const addressesDoc = await Address.findOne({ userId });
    const addresses = addressesDoc ? addressesDoc.address : [];

    let shippingCharge = 50;
    const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];

    if (defaultAddress?.state) {
      const state = defaultAddress.state.trim().toLowerCase();
      if (state === "kerala") shippingCharge = 0;
    }

    const payableTotal = +(grandTotal + tax + shippingCharge).toFixed(2);

    return res.render("user/checkout-address", {
      user: userData,
      addresses,
      cartItems: cart.items,
      grandTotal,
      tax,
      shippingCharge,
      payableTotal,
      errorMessage
    });

  } catch (error) {
    console.log(error);
    return res.redirect("/user/Page404");
  }
};
const loadPaymentPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id;
    const userData = await User.findById(userId);
    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) return res.redirect("/user/cart");

    const validItems = [];

    for (let item of cart.items) {
      const product = await Product.findById(item.productId)
        .populate("categoryId")
        .populate("subCategoryId");

      if (
        !product ||
        !product.isListed ||
        product.isDeleted ||
        !product.categoryId ||
        product.categoryId.isDeleted ||
        !product.subCategoryId ||
        product.subCategoryId.isDeleted
      ) continue;

      const variant = product.variants.find(
        v => v.size == item.size && v.color == item.color
      );

      if (!variant) continue;

      const stock = variant.variantQuantity;

      if (stock <= 0) continue;

      if (item.quantity > stock) item.quantity = stock;

      item.salePrice = variant.salePrice;
      item.variantPrice = variant.variantPrice;
      validItems.push(item);
    }

    cart.items = validItems;
    await cart.save();

    const inStockItems = validItems;

    if (inStockItems.length === 0) return res.redirect("/user/cart");

    let subtotal = 0;
    inStockItems.forEach(i => {
      subtotal += i.salePrice * i.quantity;
    });

    subtotal = +subtotal.toFixed(2);

    const tax = +(subtotal * 0.18).toFixed(2);
    const cgst = +(tax / 2).toFixed(2);
    const sgst = +(tax / 2).toFixed(2);

    const addressId = req.query.addressId;
    const addressDoc = await Address.findOne({ userId });
    const addresses = addressDoc ? addressDoc.address : [];

    const address = addresses.find(a => a._id.toString() === addressId);

    if (!address) {
      return res.redirect("/user/checkout-address");
    }

    let shippingCharge = 50;
    if (address.state) {
      const state = address.state.trim().toLowerCase();
      if (state === "kerala") shippingCharge = 0;
    }

    let payableTotal = subtotal + tax + shippingCharge;

    let appliedCoupon = req.session.appliedCoupon;

    if (appliedCoupon) {
      payableTotal -= appliedCoupon.discount;
      if (payableTotal < 0) payableTotal = 0;
    }
    const walletDoc = await Wallet.findOne({ userId });
const walletBalance = walletDoc ? walletDoc.balance : 0;


    return res.render("user/checkoutPayment", {
      user: userData,
      address,
      cartItems: inStockItems,
      subtotal,
      tax,
      cgst,
      sgst,
      shippingCharge,
      payableTotal,
      appliedCoupon,
      walletBalance
    });

  } catch (err) {
    console.log(err);
    return res.redirect("/500");
  }
};

const loadOrderReviewPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressId = req.query.addressId;
    const paymentMethod = req.query.paymentMethod || "cod";
    const userData = await User.findById(userId);

    let addressDoc = await Address.findOne(
      { "address._id": addressId },
      { "address.$": 1 }
    );

    let address = addressDoc ? addressDoc.address[0] : null;

    if (!address) {
      const parent = await Address.findOne({ userId });
      if (!parent) return res.redirect("/user/checkout-address");
      address = parent.address.find(a => a.isDefault) || parent.address[0];
    }

    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.redirect("/user/cart");
    }

    const validItems = [];
    let errorMessage = null;

    for (let item of cart.items) {
      const product = await Product.findById(item.productId)
        .populate("categoryId")
        .populate("subCategoryId");

      if (
        !product ||
        product.isDeleted ||
        !product.isListed ||
        !product.categoryId ||
        product.categoryId.isDeleted ||
        !product.subCategoryId ||
        product.subCategoryId.isDeleted
      ) {
        errorMessage = "Some unavailable products were removed from your cart.";
        continue;
      }

      const variant = product.variants.find(
        v => v.color === item.color && v.size === item.size
      );

      if (!variant) {
        errorMessage = "Some unavailable products were removed from your cart.";
        continue;
      }

      const stock = variant.variantQuantity;

      if (stock <= 0) continue;

      if (item.quantity > stock) {
        item.quantity = stock;
        errorMessage = "Quantities adjusted due to stock changes.";
      }

      item.salePrice = variant.salePrice;
      item.variantPrice = variant.variantPrice;
      item.productId = product;
      validItems.push(item);
    }

    cart.items = validItems;
    await cart.save();

    if (validItems.length === 0) {
      return res.redirect("/user/cart");
    }

    let subtotal = 0;
    let discount = 0;

    validItems.forEach(i => {
      subtotal += i.salePrice * i.quantity;
      discount += (i.variantPrice - i.salePrice) * i.quantity;
    });

    subtotal = +subtotal.toFixed(2);

    const cgst = +(subtotal * 0.09).toFixed(2);
    const sgst = +(subtotal * 0.09).toFixed(2);
    const tax = +(cgst + sgst).toFixed(2);

    let shippingCharge = 50;
    if (address.state) {
      const state = address.state.trim().toLowerCase();
      if (state === "kerala") shippingCharge = 0;
    }

    const applied = req.session.appliedCoupon || null;
    const couponDiscount = applied ? applied.discount : 0;

    let payableTotal = subtotal + tax + shippingCharge - couponDiscount;
    if (payableTotal < 0) payableTotal = 0;
    payableTotal = +payableTotal.toFixed(2);

    return res.render("user/orderReview", {
      address,
      items: validItems,
      paymentMethod,
      subtotal,
      cgst,
      sgst,
      tax,
      shippingCharge,
      discount,
      couponDiscount,
      payableTotal,
      errorMessage,
      user: userData
    });

  } catch (error) {
    console.log(error);
    return res.redirect("/500");
  }
};

module.exports = {
  getCheckoutPage,
  loadPaymentPage,
 loadOrderReviewPage
};
