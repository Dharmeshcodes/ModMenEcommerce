const Review = require("../../models/reviewSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");


const addReview = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const { productId, rating, comment } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "Login required" });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.json({ success: false, message: "Invalid rating" });
    }

    const delivered = await Order.findOne({
      userId,
      "orderedItems.productId": productId,
      "orderedItems.status": "delivered"
    });

    if (!delivered) {
      return res.json({ success: false, message: "You can review only after delivery" });
    }

    const existing = await Review.findOne({ userId, productId });
    if (existing) {
      return res.json({ success: false, message: "You already reviewed this product" });
    }

    await Review.create({
      userId,
      productId,
      rating,
      comment: comment || ""
    });

    const stats = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, avg: { $avg: "$rating" } } }
    ]);

    const avgRating = stats[0]?.avg || 0;
    await Product.findByIdAndUpdate(productId, { averageRating: avgRating });

    return res.json({ success: true, message: "Review added" });

  } catch (err) {
    console.log("addReview error:", err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};


const deleteReview = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const { reviewId } = req.params;

    if (!userId) {
      return res.json({ success: false, message: "Login required" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.json({ success: false, message: "Review not found" });
    }

    if (review.userId.toString() !== userId.toString()) {
      return res.json({ success: false, message: "Not allowed" });
    }

    const productId = review.productId;

    await Review.findByIdAndDelete(reviewId);

    const stats = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, avg: { $avg: "$rating" } } }
    ]);

    const avgRating = stats[0]?.avg || 0;
    await Product.findByIdAndUpdate(productId, { averageRating: avgRating });

    return res.json({ success: true, message: "Review deleted" });

  } catch (err) {
    console.log("deleteReview error:", err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};

module.exports = { addReview, deleteReview };
