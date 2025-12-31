const Review = require("../../models/reviewSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");

const HTTP_STATUS = require("../../constans/httpStatus"); 
const { apiLogger, errorLogger } = require("../../config/logger"); 
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

    const productObjectId = new mongoose.Types.ObjectId(productId);

    const delivered = await Order.findOne({
      userId,
      orderedItems: {
        $elemMatch: {
          productId: productObjectId,
          status: "delivered"
        }
      }
    });

    if (!delivered) {
      return res.json({ success: false, message: "You can review only after delivery" });
    }

    const existing = await Review.findOne({ userId, productId: productObjectId });
    if (existing) {
      return res.json({ success: false, message: "You already reviewed this product" });
    }

    await Review.create({
      userId,
      productId: productObjectId,
      rating,
      comment: comment || ""
    });

    const stats = await Review.aggregate([
      { $match: { productId: productObjectId } },
      {
        $group: {
          _id: "$productId",
          average: { $avg: "$rating" },
          count: { $sum: 1 }
        }
      }
    ]);

    const ratingData = stats.length
      ? {
          average: Number(stats[0].average.toFixed(1)),
          count: stats[0].count
        }
      : { average: 0, count: 0 };

    await Product.findByIdAndUpdate(productObjectId, {
      "ratings.average": ratingData.average,
      "ratings.count": ratingData.count
    });

    apiLogger.info("Review added successfully for product %s", productId);

    return res.json({ success: true, message: "Review added" });

  } catch (err) {
    errorLogger.error("addReview error: %o", err);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Something went wrong" });
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
      { $match: { productId } },
      {
        $group: {
          _id: "$productId",
          average: { $avg: "$rating" },
          count: { $sum: 1 }
        }
      }
    ]);

    const ratingData = stats.length
      ? {
          average: Number(stats[0].average.toFixed(1)),
          count: stats[0].count
        }
      : { average: 0, count: 0 };

    await Product.findByIdAndUpdate(productId, {
      "ratings.average": ratingData.average,
      "ratings.count": ratingData.count
    });

    apiLogger.info("Review deleted successfully: %s", reviewId);

    return res.json({ success: true, message: "Review deleted" });

  } catch (err) {
    errorLogger.error("deleteReview error: %o", err);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Something went wrong" });
  }
};


module.exports = { addReview, deleteReview };
