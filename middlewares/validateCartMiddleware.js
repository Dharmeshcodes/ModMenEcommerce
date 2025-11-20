const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const SubCategory = require("../models/subcategorySchema");
const User = require("../models/userSchema");
const Cart = require("../models/cartSchema");



const validateCartMiddleware = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const userData = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate("items.productId");

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

    let changed = false;
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
        changed = true;
        continue;
      }

      const variant = product.variants.find(
        v => v.color === item.color && v.size === item.size
      );

      if (!variant) {
        changed = true;
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
        changed = true;
      }

      item.productId.stock = stock;

      validItems.push(item);
    }

    cart.items = validItems;
    await cart.save();

  
    if (changed) {
      let grandTotal = 0;

      cart.items.forEach(i => {
        if (i.productId.stock > 0) {
          grandTotal += i.quantity * i.salePrice;
        }
      });

      const tax = grandTotal * 0.18;
      const shippingCharge = grandTotal < 1000 && grandTotal > 0 ? 50 : 0;
      const payableTotal = grandTotal + tax + shippingCharge;

      return res.render("user/cart", {
        user: userData,
        items: cart.items,
        grandTotal,
        tax,
        shippingCharge,
        payableTotal,
        errorMessage: "Some items were updated due to changes in stock."
      });
    }

    next();

  } catch (error) {
    return res.redirect("/pageNotFound");
  }
};


module.exports = validateCartMiddleware;
