require("dotenv").config();
const mongoose = require("mongoose");

const Review = require("../models/reviewSchema");
const Product = require("../models/productSchema");

const MONGO_URI = process.env.MONGO_URI;

const fixProductRatings = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");

    const stats = await Review.aggregate([
      {
        $group: {
          _id: "$productId",
          average: { $avg: "$rating" },
          count: { $sum: 1 }
        }
      }
    ]);

    for (const item of stats) {
      await Product.findByIdAndUpdate(item._id, {
        "ratings.average": Number(item.average.toFixed(1)),
        "ratings.count": item.count
      });
    }

    const reviewedProductIds = stats.map(s => s._id);

    await Product.updateMany(
      { _id: { $nin: reviewedProductIds } },
      {
        "ratings.average": 0,
        "ratings.count": 0
      }
    );

    console.log("Product ratings fixed successfully");
    process.exit(0);

  } catch (err) {
    console.error("Fix ratings error:", err);
    process.exit(1);
  }
};

fixProductRatings();
