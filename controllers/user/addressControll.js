const User = require('../../models/userSchema');
const Address= require('../../models/adressSchema');
const bcrypt = require('bcrypt');
const validator = require('validator');
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const { apiLogger, errorLogger } = require('../../config/logger');

const getAddress=async (req, res) => {
  try {
    const user= req.session.user;
    let userData=null;
     userData=await User.findById(user._id);
   

    const page = parseInt(req.query.page) || 1;    
    const limit = 4;                                
    const skip = (page - 1) * limit;

    let addressDoc = await Address.findOne({userId:user._id });

    if (!addressDoc) {
      return res.render('user/address', {
        addresses: [],
        currentPage: page,
        totalPages: 0,
        user:userData
      });
    }

    const totalAddresses = addressDoc.address.length;
    const totalPages = Math.ceil(totalAddresses / limit);

    const paginatedAddresses = addressDoc.address.slice(skip, skip + limit);

    res.render('user/address', {
      addresses: paginatedAddresses,
      currentPage: page,
      totalPages: totalPages,
      user:userData
    });

  } catch (error) {
    console.log('Address Pagination Error:', error);
    res.status(500).send('Something went wrong');
  }
};

const getAddAddress=async (req, res, next) => {
  try {
    let userData=null;
    const user= req.session.user;
    console.log("bug finding 1",req.session.user)
    console.log("bug finding 2",user)
    if (!user) {
      req.flash('error_msg', 'You need to be logged in');
      return res.redirect('/user/login');
    }
     userData = await User.findById(user._id);
     console.log("bugfinding3",user)
  
    const userAddress = await Address.findOne({ userId: userData._id });
    const addresses = userAddress ? userAddress.address : [];
    console.log("the user is",user)
    res.render('user/addAddress', {
      user: userData,
      addresses: addresses,
      formData:req.body || null
    });
  } catch (error) {
    next(error);
  }
};

const postAddAddress = async (req, res, next) => {
  try {
    
    const user = req.session.user;
    if (!user) {
      req.flash('error_msg', 'You need to be logged in');
      return res.redirect('/user/login');
    }

    const userData = await User.findById(user._id);

    const { fullName, houseNo, landMark, district, state, city, pincode, phone } = req.body;
    
    let isDefault = req.body.isDefault === 'true';

    if (!fullName || !houseNo || !landMark || !district || !state || !city || !pincode) {
      req.flash('error_msg', ' error message from backend Full name, house number, landmark, district, state, city, and pincode are required');
      return res.render('user/addAddress', {
        user: userData,
        formData: req.body,
        error_msg: req.flash('error_msg')
      });
    }

    let userAddress = await Address.findOne({ userId: user._id });

    if (isDefault && userAddress) {
      userAddress.address.forEach(addr => (addr.isDefault = false));
      await userAddress.save();
    }

    if (!userAddress) {
      const newAddress = new Address({
        userId: user._id,
        address: [{ fullName, houseNo, landMark, district, state, city, pincode, phone, isDefault }]
      });
      await newAddress.save();

    } else if (userAddress.address.length === 0) {
      userAddress.address.push({
        fullName, houseNo, landMark, district, state, city, pincode, phone, isDefault: true
      });
      await userAddress.save();

    } else {
      userAddress.address.push({
        fullName, houseNo, landMark, district, state, city, pincode, phone, isDefault
      });
      await userAddress.save();
    }

    if (req.xhr || req.headers["content-type"] === "application/json") {
          return res.json({ success: true });
        }

        // If normal form submit → redirect
        req.flash('success_msg', 'Address added successfully');
        return res.redirect('/user/address');

  } catch (error) {
    next(error);
  }
};

const getUpdateAddress = async (req, res, next) => {
  try {
    const user = req.session.user;
    
    const { addressId } = req.params;
    const userData = await User.findById(user._id);
    const userAddress = await Address.findOne({ userId: user._id });

    if (!userAddress) {
      req.flash('error_msg', 'No address found');
      return res.redirect('/user/address');
    }

    const address = userAddress.address.id(addressId);
    if (!address) {
      req.flash('error_msg', 'Address not found');
      return res.redirect('/user/address');
    }

    res.render('user/updateAddress', {
      user: userData,
      address
    });
    
  } catch (err) {
    next(err);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const user = req.session.user;
    if (!user) {
      req.flash('error_msg', 'You need to be logged in');
      return res.redirect('/user/login');
    }

    const userData = await User.findById(user._id);
    const addressId = req.params.addressId;

    const { fullName, houseNo, landMark, district, state, city, pincode, phone } = req.body;
    let isDefault = req.body.isDefault === 'true';

    if (!fullName || !houseNo || !landMark || !district || !state || !city || !pincode) {
      req.flash('error_msg', 'Full name, house number, landmark, district, state, city, and pincode are required');
      return res.render('user/updateAddress', {
        user: userData,
        address: { ...req.body, _id: addressId },
        error_msg: req.flash('error_msg')
      });
    }

    const userAddress = await Address.findOne({ userId: user._id });
    if (!userAddress) {
      req.flash('error_msg', 'Address not found');
      return res.redirect('/user/address');
    }

    const index = userAddress.address.findIndex(a => a._id.toString() === addressId);
    if (index === -1) {
      req.flash('error_msg', 'Address not found');
      return res.redirect('/user/address');
    }

    if (isDefault) {
      userAddress.address.forEach(a => a.isDefault = false);
    }

    Object.assign(userAddress.address[index], {
      fullName,
      houseNo,
      landMark,
      district,
      state,
      city,
      pincode,
      phone,
      isDefault
    });

    await userAddress.save();

    req.flash('success_msg', 'Address updated successfully');
    res.redirect('/user/address');

  } catch (err) {
    next(err);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const addressId = req.params.addressId;
    const userAddress = await Address.findOne({ userId: user._id });

    if (!userAddress) {
      return res.status(404).json({ success: false, message: 'Address record not found' });
    }

    const index = userAddress.address.findIndex(a => a._id.toString() === addressId);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const wasDefault = userAddress.address[index].isDefault;

    userAddress.address.splice(index, 1);

    if (wasDefault && userAddress.address.length > 0) {
      userAddress.address[0].isDefault = true;
    }

    await userAddress.save();

    return res.json({
      success: true,
      message: 'Address deleted successfully'
    });

  } catch (error) {
    next(error);
  }
  
};

module.exports={
    getAddress,
    getAddAddress,
    postAddAddress,
    getUpdateAddress,
    updateAddress,
    deleteAddress,
};