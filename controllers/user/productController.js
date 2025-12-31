const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const subCategory = require('../../models/subcategorySchema');
const User = require('../../models/userSchema');
const Review = require('../../models/reviewSchema');
const Coupon = require('../../models/couponSchema');

const HTTP_STATUS = require("../../constans/httpStatus"); 
const { apiLogger, errorLogger } = require("../../config/logger");

const productDetails = async (req, res) => {
  try {
    const user = req.session.user || null;
    let userDetails = null;

    if (user && user._id) {
      userDetails = await User.findById(user._id).lean();
    }

    const id = req.params.id;

    const product = await Product.findById(id)
      .populate({
        path: 'categoryId',
        match: { isDeleted: false, isListed: true }
      })
      .populate({
        path: 'subCategoryId',
        match: { isDeleted: false, isListed: true }
      })
      .lean();

    if (
          !product ||
          product.isDeleted ||
          !product.isListed ||
          !product.categoryId ||
          !product.subCategoryId
        ) {
          req.flash(
            'error_msg',
            'Some products are unavailable right now. Please explore other items.'
          );
          return res.redirect('/user/sale');
        }


    const variant =
      product.variants && product.variants.length > 0
        ? product.variants[0]
        : null;

    const alsoLikeProducts = await Product.find({
      categoryId: product.categoryId,
      _id: { $ne: id },
      isDeleted: false,
      isListed: true
    }).limit(4).lean();

    const reviews = await Review.find({ productId: id })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const today = new Date();

    const coupons = await Coupon.find({
      status: true,
      startDate: { $lte: today },
      expiryDate: { $gte: today }
    })
      .select('code description')
      .lean();

    product.coupons = coupons;

    return res.render('user/product-detail', {
      product,
      alsoLikeProducts,
      reviews,
      user: userDetails,
      variant
    });

  } catch (error) {
    errorLogger.error("Product Details Page Error", error);
    return res.redirect("/user/Page-404");
  }
};

module.exports = {
  productDetails
};
