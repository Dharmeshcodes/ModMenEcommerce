const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const SubCategory = require("../../models/subcategorySchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/adressSchema");



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

      // Keep OOS items
      if (stock <= 0) {
        item.productId.stock = 0;
        item.mainImage = product.images?.[0]?.url || product.images?.[0] || null;
        validItems.push(item);
        continue;
      }

      if (item.quantity > stock) {
        item.quantity = stock;
        errorMessage = "Quantities adjusted due to stock changes.";
      }

      item.salePrice = variant.salePrice;
      item.productId.stock = stock;

      item.mainImage =
        product.images?.[0]?.url ||
        product.images?.[0] ||
        null;

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

    const addressesDoc = await Address.findOne({ userId });
    const addresses = addressesDoc ? addressesDoc.address : [];

    return res.render("user/checkout-address", {
      user: userData,
      addresses,
      cartItems: cart.items,
      grandTotal,
      errorMessage
    });

  } catch (error) {
    console.log(error);
    return res.redirect("/pageNotFound");
  }
};
const loadPaymentPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id;
    const userData = await User.findById(userId);
    let cart = await Cart.findOne({ userId }).populate("items.productId");

    let errorMessage = null;

    if (!cart) {
      return res.redirect("/user/cart");
    }

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
      ) {
        errorMessage = "Some unavailable products were removed.";
        continue;
      }

      const variant = product.variants.find(
        v => v.size == item.size && v.color == item.color
      );

      if (!variant) {
        errorMessage = "Some items were removed from your cart.";
        continue;
      }

      const stock = variant.variantQuantity;

      if (stock <= 0) {
        item.productId.stock = 0;
        validItems.push(item);
        continue;
      }

      if (variant.variantQuantity < item.quantity) {
        item.quantity = variant.variantQuantity;
        errorMessage = "Some quantities were adjusted.";
      }

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
        errorMessage: "All cart items are out of stock. Cannot proceed."
      });
    }

    let grandTotal = 0;
    inStockItems.forEach(item => {
      grandTotal += item.salePrice * item.quantity;
    });

    let tax = grandTotal * 0.18;
    let shippingCharge = grandTotal < 1000 ? 50 : 0;
    let payableTotal = grandTotal + tax + shippingCharge;

    let addressId = req.query.addressId;

    const addressDoc = await Address.findOne({ userId });
    const allAddresses = addressDoc ? addressDoc.address : [];

    if (!addressId) {
      const defaultAddress = allAddresses.find(a => a.isDefault);
      if (defaultAddress) {
        addressId = defaultAddress._id;
      } else {
        return res.render("user/checkout-address", {
          user: userData,
          addresses: allAddresses,
          cartItems: cart.items,
          grandTotal,
          errorMessage: "Please select an address to continue."
        });
      }
    }

    const address = allAddresses.find(
      a => a._id.toString() === addressId.toString()
    );

    if (!address) {
      return res.render("user/checkout-address", {
        user: userData,
        addresses: allAddresses,
        cartItems: cart.items,
        grandTotal,
        errorMessage: "Invalid address. Please select again."
      });
    }

    return res.render("user/checkoutPayment", {
      user: userData,
      address,
      cartItems: cart.items,
      grandTotal,
      tax,
      shippingCharge,
      payableTotal,
      errorMessage
    });

  } catch (error) {
    res.redirect("/500");
  }
};
const loadOrderReviewPage = async (req, res) => {
  try {
    const paymentMethod = req.query.paymentMethod?.toLowerCase() || "cod";

    const user = req.session.user;
    const userId = user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.redirect("/user/cart")
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
        continue;
      }

      const variant = product.variants.find(
        (v) => v.color === item.color && v.size === item.size
      );

      if (!variant) continue;

      const stock = variant.variantQuantity;
      item.productId.stock = stock;

      if (stock > 0) {
        item.salePrice = variant.salePrice;
        item.variantPrice = variant.variantPrice;
        validItems.push(item);
      }
    }

    if (validItems.length === 0) {
      return res.redirect("/user/cart");
    }

    let subtotal = 0;
    let discount = 0;

    validItems.forEach((i) => {
      subtotal += i.salePrice * i.quantity;
      discount += (i.variantPrice - i.salePrice) * i.quantity;
    });

    const cgst = subtotal * 0.09;
    const sgst = subtotal * 0.09;
    const shippingCharge = subtotal < 1000 ? 50 : 0;
    const payableTotal = subtotal + cgst + sgst + shippingCharge - discount;

    const addressId = req.query.addressId;
    let address = await Address.findById(addressId);

    if (!address) {
      const addressDoc = await Address.findOne({ userId });
      if (addressDoc) {
        address = addressDoc.address.find((a) => a.isDefault);
        if (!address) {
          address = addressDoc.address[0];
        }
      }
    }

    if (!address) {
      return res.redirect("/user/checkout-address");
    }

    req.session.chekoutData={
      subtotal,
      cgst,
      sgst,
      shippingCharge,
      discount,
      payableTotal,
      addressId:address._id,

    }

    res.render("user/orderReview", {
      user,
      items: validItems,
      subtotal,
      cgst,
      sgst,
      shippingCharge,
      discount,
      payableTotal,
      address,
      paymentMethod
    });

  } catch (err) {
    console.log(err);
    res.redirect("/500");
  }
};



module.exports = {
  getCheckoutPage,
  loadPaymentPage,
 loadOrderReviewPage
};
