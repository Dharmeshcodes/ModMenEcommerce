const mongoose = require('mongoose');
const { Schema } = mongoose;

const offerSchema = new Schema({
  offerPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  maxRedeem: {
    type: Number,
    default: 0,
    min: 0
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  }
});

const categorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  subcategories: [{
    type: Schema.Types.ObjectId,
    ref: 'Subcategory',
    default: []
  }],
  offer: {
    type: offerSchema,
    default: null
  },
  description: {
    type: String,
    trim: true,
  },
  addedDate: {
    type: Date,
    default: Date.now,
  },
  isListed: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  image: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model('Category', categorySchema);
