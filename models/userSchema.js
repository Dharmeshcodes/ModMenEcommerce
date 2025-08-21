const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    required: false,
    unique:true,
    sparse:true,
    default:null
  },
  email: {     
    type: String,
    required: true,
    unique: true
  },
  googleId:{
    type:"string",
    unique:true
  },
  password: {
    type: String,
    required:false
  },
  role: {
    type: String,
    default: 'user'
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  createdDate: {
    type: Date,
    default: Date.now
  },
  updatedDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);
