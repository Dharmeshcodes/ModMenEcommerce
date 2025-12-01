const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["fixed", "percentage"],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  maxDiscountAmount: {
    type: Number,
    default: null
  },
  minimumOrderAmount: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  status: {
    type: Boolean,
    default: true
  },
  // usageLimit: {
  //   type: Number,
  //   default: 1
  // },
  usagePerUser: {
    type: Number,
    default: 1
  },
  // usedCount: {
  //   type: Number,
  //   default: 0
  // },
  usedUsers: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      count: { type: Number, default: 0 }
    }
  ]
});

module.exports = mongoose.model("Coupon", couponSchema);
