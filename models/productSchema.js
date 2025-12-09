const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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

const offerSchema = new Schema({
  productOffer: {
    type: Number
  },
  maxRedeem: {
    type: Number,
    default: 0,
  },
  startDate: {
    type: Date,
  },
  validUntil: {
    type: Date,
  },
});

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
    unique: false
  },
  color: {
    type: String,
    required: true,
  },
});

function arrayLimit(val) {
  return Array.isArray(val) && val.length >= 1;  
}

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
    ref: 'Category',
    required: true,
  },
  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subcategory',
  },
  color: {
    type: String,
    required: true,
  },

  offer: offerSchema,

  displayOffer: {
    type: Number,
    default: function () {
      return this.offer ? this.offer.productOffer : 0;
    },
  },

  offerSource: {
    type: String,
    enum: ['product', 'category', 'subcategory'],
    default: 'product',
  },

  images: {
    type: [imageSchema],
    validate: [arrayLimit, 'At least 1 image required'],   // <-- UPDATED VALIDATOR
  },

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

  isDeleted: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },

  fitType: {
    type: String,
  },

  sleeveType: {
    type: String,
  },

  washCare: {
    type: String,
  },
});

productSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
