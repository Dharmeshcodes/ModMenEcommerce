const mongoose = require('mongoose');
const { Schema } = mongoose;

const offerSchema = new Schema({
  subcategoryOffer: {
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

const subcategorySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: { 
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  offer: {
    type: offerSchema,
    default: null
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

module.exports = mongoose.model('Subcategory', subcategorySchema);
