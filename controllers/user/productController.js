const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const subCategory = require('../../models/subcategorySchema');
const User = require('../../models/userSchema');
const Review = require('../../models/reviewSchema');

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

    if (!product || product.isDeleted || !product.isListed || !product.categoryId || !product.subCategoryId) {
      return res.redirect('/user/sale');
    }

    const variant = product.variants && product.variants.length > 0 ? product.variants[0] : null;

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

    res.render('user/product-detail', {
      product,
      alsoLikeProducts,
      reviews,
      user: userDetails,
      variant
    });

  } catch (error) {
    console.error('Error in product detail page:', error);
    res.status(500).send('there is an error in product detail page');
  }
};

module.exports = {
  productDetails
};
