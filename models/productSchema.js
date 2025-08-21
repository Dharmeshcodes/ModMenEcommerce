const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const variantSchema = new Schema({
  size: {
    type: String,
    required: true,
  },
  variantPrice: {
    type: Number,
    required: true,
  },
  salePrice: {
    type: Number,
    required: true,
  },
  variantQuantity: {
    type: Number,
    required: true,
  },
  sku: {
    type: String,
    required: true,
    unique: true,
  },
});


const imageSchema = new Schema({
  url: {
    type: String,
    required: true,
  },
  thumbnail: {
    type: String,
    required: true,
  },
  isMain: {
    type: Boolean,
    default: false,
  },
});

const productSchema = new Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    auto: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subcategory",
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  offer: {
    type: Number,
    required: true,
  },
  displayOffer: {
    type: Number,
    default: function () {
      return this.offer;
    },
  },
  offerSource: {
    type: String,
    enum: ["product", "category"],
    default: "product",
  },
  maxRedeem: {
    type: Number,
    default: 0,
  },
  images: [imageSchema],
  variants: [variantSchema],
  tags: [
    {
      type: String,
    },
  ],
  ratings: {
    average: {
      type: Number,
      default: 0,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  isListed: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  FitType: {
    type: String,
  },
});


productSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});


const Product = mongoose.model("Product", productSchema);
module.exports = Product;
