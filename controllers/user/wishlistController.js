const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const SubCategory = require("../../models/subcategorySchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");


const toggleWishlist = async (req, res) => {
  try {
    console.log("the controller function hit");
    const userId = req.session.user?._id;
    const productId = req.body.productId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const product = await Product.findById(productId)
      .populate("categoryId")
      .populate("subCategoryId");

    if (!product || product.isDeleted || !product.isListed ||
        product.categoryId?.isDeleted || product.subCategoryId?.isDeleted) {
      return res.status(400).json({ success: false, message: "Product unavailable" });
    }

    const exists = user.wishlist.some(id => id.toString() === productId.toString());

    if (exists) {
      user.wishlist.pull(productId);
      await user.save();
      return res.json({ success: true, action: "removed" });
    } 
    
    const cart = await Cart.findOne({ userId });
    if (cart?.items.some(i => i.productId.toString() === productId)) {
      return res.json({ success: false, message: "Already in cart" });
    }

    user.wishlist.push(productId);
    await user.save();
    return res.json({ success: true, action: "added" });

  } catch (error) {
    console.log("Toggle Wishlist Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};



const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect("user/login");

    const user = await User.findById(userId);
    if (!user) return res.redirect("user/login");

    const cart = await Cart.findOne({ userId });

    let wishlistIds = [...user.wishlist];

    const products = await Product.find({ _id: { $in: wishlistIds } })
      .populate("categoryId")
      .populate("subCategoryId");

    let validProducts = [];

    for (const product of products) {
      if (
        !product ||
        product.isDeleted ||
        !product.isListed ||
        !product.categoryId ||
        product.categoryId?.isDeleted ||
        (product.subCategoryId && product.subCategoryId?.isDeleted)
      ) {
        user.wishlist.pull(product?._id);
        continue;
      }

      if (cart?.items?.some(i => i.productId.toString() === product._id.toString())) {
        user.wishlist.pull(product._id);
        continue;
      }

      validProducts.push(product);
    }

    await user.save();

    return res.render("user/wishlist", {
      user,
      wishlist: validProducts
    });
  } catch (error) {
    console.error("getWishlist Error:", error);
    return res.redirect("user/pagenotfound");
  }
};

let removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required" });
    }

    const productId = req.query.productId;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID missing" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const index = user.wishlist.indexOf(productId);
    if (index > -1) {
      user.wishlist.splice(index, 1);
      await user.save();
    }

    return res.status(200).json({ success: true, message: "Removed successfully" });

  } catch (error) {
    console.error("Remove wishlist error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const emptyWishlist = async (req, res) => {
  try {
    console.log("controller function hit");

    const userId = req.params.userId;

    await User.updateOne(
      { _id: userId },
      { $set: { wishlist: [] } }
    );

    res.json({ success: true, message: "Wishlist cleared successfully" });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Server error" });
  }
};







module.exports={
    toggleWishlist,
    getWishlist,
    removeFromWishlist,
    emptyWishlist
}