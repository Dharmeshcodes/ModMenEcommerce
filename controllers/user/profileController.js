const User = require('../../models/userSchema');
const Address= require('../../models/adressSchema');
const bcrypt = require('bcrypt');
const validator = require('validator');
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const { apiLogger, errorLogger } = require('../../config/logger');

async function securePassword(password) {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    errorLogger.error('Error hashing password: %o', error);
    return null;
  }
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      auth: {
        user: process.env.nodemailer_email,
        pass: process.env.gpassword
      }
    });

    const info = await transporter.sendMail({
      from: process.env.nodemailer_email,
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`
    });

    return info.accepted.length > 0;
  } catch (error) {
    errorLogger.error('Error sending email: %o', error);
    return false;
  }
}

const getForgotPasswordPage = (req, res) => {
  res.render('user/forgot-password', { step: 'forgot', userEmail: null, error_msg: null, success_msg: null });
};

const postForgotPasswordPage = async (req, res) => {
  try {
    const { email } = req.body;
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error_msg: 'Invalid email format' });
    }
    const userDetails = await User.findOne({ email });
    if (!userDetails) {
      return res.status(404).json({ error_msg: 'User not found for the given email' });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ error_msg: 'Failed to send OTP email' });
    }

    req.session.userOtp = otp;
    req.session.email = email;
    req.session.resetAllowed = false;

    apiLogger.info('OTP sent successfully: %o', otp);

    res.json({ success_msg: 'OTP sent to your email', otpEmail: email });
  } catch (error) {
    errorLogger.error('Error in postForgotPasswordPage: %o', error);
    res.status(500).json({ error_msg: 'Something went wrong, please try again.' });
  }
};

const getOtpPage = (req, res) => {
  if (!req.session.email) {
    return res.redirect('/user/forgot-password');
  }
  res.render('user/forgot-password', {
    step: 'otp',
    otpEmail: req.session.email,
    error_msg: null,
    success_msg: null
  });
};

const forgotpasswordVerifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!req.session.userOtp || !req.session.email) {
      return res.status(400).json({ error_msg: 'Session expired or invalid' });
    }
    if (otp === req.session.userOtp) {
      req.session.resetAllowed = true;
      apiLogger.info('OTP verified successfully for email: %s', req.session.email);
      res.json({ success_msg: 'OTP verified successfully' });
    } else {
      res.status(400).json({ error_msg: 'Invalid OTP, please try again' });
    }
  } catch (error) {
    errorLogger.error('Error in forgotpasswordVerifyOtp: %o', error);
    res.status(500).json({ error_msg: 'Error verifying OTP' });
  }
};

const getResetpage = (req, res) => {
  if (!req.session.resetAllowed || !req.session.email) {
    return res.redirect('/user/forgot-password');
  }
  res.render('user/forgot-password', {
    step: 'reset',
    otpEmail: req.session.email,
    error_msg: null,
    success_msg: null
  });
};

const postNewPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    if (!req.session.email || !req.session.resetAllowed) {
      return res.status(403).json({ error_msg: 'Unauthorized or session expired' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error_msg: 'Passwords do not match' });
    }

    const passwordHash = await securePassword(newPassword);
    if (!passwordHash) {
      return res.status(500).json({ error_msg: 'Error processing password' });
    }

    const updateResult = await User.updateOne({ email: req.session.email }, { $set: { password: passwordHash } });
    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ error_msg: 'Failed to update password' });
    }

    apiLogger.info('Password updated successfully for %s', req.session.email);

    req.session.destroy((err) => {
      if (err) errorLogger.error('Error destroying session: %o', err);
    });

    res.json({ success_msg: 'Password reset successful. Please log in.' });
  } catch (error) {
    errorLogger.error('Error in postNewPassword: %o', error);
    res.status(500).json({ error_msg: 'Error resetting password, please try again' });
  }
};

const forgotPasswordResendOtp = async (req, res) => {
  try {
    const { email } = req.session;
    if (!email) {
      return res.status(400).json({ error_msg: 'Session expired or invalid' });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ error_msg: 'Failed to resend OTP' });
    }

    req.session.userOtp = otp;
    apiLogger.info('Resent OTP successfully: %o', otp);

    res.json({ success_msg: 'OTP resent successfully' });
  } catch (error) {
    errorLogger.error('Error in forgotPasswordResendOtp: %o', error);
    res.status(500).json({ error_msg: 'Failed to resend OTP' });
  }
};

const getprofilePage=async (req,res)=>{
  try{
    let userData=null;
    const user=req.session.user;
     userData=await User.findById(user._id);

     res.render('user/profile',{user:userData});
  }
  
  catch(error){
    errorLogger.error('there is an error in profilepage');
  }

};
const getUpdateProfile= async(req,res)=>{
  let userData=null;
  let user= req.session.user;
  userData=await User.findById(user._id);

  res.render('user/updateProfile',{user:userData});
};
const updateProfile = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      req.flash('error_msg', 'You must be logged in');
      return res.redirect('/user/updateProfile');
    }

    const { fullName, mobile } = req.body;

    // Validation
    if (!fullName || !fullName.trim()) {
      req.flash('error_msg', 'Full name is required');
      return res.redirect('/user/updateProfile');
    }
    if (!mobile || !mobile.trim()) {
      req.flash('error_msg', 'Phone number is required');
      return res.redirect('/user/updateProfile');
    }

    if (!/^\d{10}$/.test(mobile.trim())) {
      req.flash('error_msg', 'Phone number must be 10 digits');
      return res.redirect('/user/updateProfile');
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
      },
      { new: true }
    );

    req.session.user = updatedUser;

    req.flash('success_msg', 'Profile updated successfully');
    return res.redirect('/user/updateProfile');

  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Something went wrong');
    return res.redirect('/user/updateProfile');
  }
};
const updateEmail = async (req, res) => {
  try {
    const user = req.session.user;
    const userDetails = await User.findById(user._id);

    if (userDetails.googleId) {
      req.flash('error_msg', 'Email cannot be changed for Google accounts');
      return res.redirect('/user/updateProfile');
    }

    const newEmail = req.body.email;

    if (!newEmail || !newEmail.trim()) {
      req.flash('error_msg', 'Email is required');
      return res.redirect('/user/updateProfile');
    }

    const existEmail = await User.findOne({ email: newEmail });
    if (existEmail) {
      req.flash('error_msg', 'This email is already in use');
      return res.redirect('/user/updateProfile');
    }

    const otp = generateOtp();
    req.session.emailOTP = otp;
    req.session.newEmail = newEmail;

    console.log('OTP for verification is:', otp);

    const sent = await sendVerificationEmail(newEmail, otp);
    if (!sent) {
      req.flash('error_msg', 'Failed to send OTP. Try again later');
      return res.redirect('/user/updateProfile');
    }

    req.flash('success_msg', 'OTP sent to your new email');
    req.session.save(() => {
      return res.redirect('/user/verify-email-otp');
    });

  } catch (error) {
    console.log('Error updating email:', error);
    req.flash('error_msg', 'Something went wrong');
    return res.redirect('/user/updateProfile');
  }
};

const renderEmailOtpPage = (req, res) => {
  try {
    if (!req.session.emailOTP || !req.session.newEmail) {
      req.flash('error_msg', 'Invalid access, please try again');
      return res.redirect('/user/updateProfile');
    }

    return res.render('user/verify-email-otp', {
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });

  } catch (error) {
    console.log('Error rendering verify email otp:', error);
    req.flash('error_msg', 'Something went wrong');
    return res.redirect('/user/updateProfile');
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.emailOTP) {
      return res.status(400).json({ success: false, message: 'Session expired. Try again.' });
    }

    if (otp != req.session.emailOTP) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    const updated = await User.findByIdAndUpdate(
      req.session.user._id,
      { email: req.session.newEmail },
      { new: true }
    );

          req.session.user.email = updated.email;
      req.session.emailOTP = null;
      req.session.newEmail = null;

    return res.json({ success: true, message: 'Email updated successfully!' });

  } catch (error) {
    console.log('OTP verify error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Try again.' });
  }
};

const resendEmailOtp = async (req, res) => {
  try {
    if (!req.session.newemail) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    req.session.emailOTP = otp;

    const sent = await sendVerificationEmail(req.session.newemail, otp);
    if (!sent) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Try again.' });
    }

    return res.json({ success: true, message: 'New OTP has been sent to your email' });
  } catch (error) {
    console.log('Resend OTP error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Try again.' });
  }
};

const getchangePassword = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findById(user._id);
    res.render("user/change-password", { user: userData });
  } catch (error) {
    console.log("There is an error in fetching change password");
    return res.status(500).json({ success: false, message: 'Something went wrong. Try again.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { currentPassword, newPassword } = req.body;

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    const hashedPassword = await securePassword(newPassword);
    if (!hashedPassword) return res.status(500).json({ success: false, message: 'Password hashing failed' });

    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });

  } catch (error) {
    errorLogger.error('Change Password Error: %o', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
const uploadProfileImage=async (req,res)=>{
  try{
    const user=req.session.user
    const userId=user._id

    if(!req.file){
      return res.status(400).json({message:"no file uploaded"})
    }
    const updatedUser=await User.findByIdAndUpdate(userId,
      {profileImage:req.file.path},
      {new:true}
    )
     res.status(200).json({
      message: 'Profile image updated successfully',
      profileImage: updatedUser.profileImage
    });
  }
  catch(error){
    console.error('Error updating profile image:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
const loadContactPage = async (req, res) => {
  try {
    const userId = req.session.user?._id || null;
    let userData = null;

    if (userId) {
      userData = await User.findById(userId);
    }

    return res.render("user/contact", {
      user: userData
    });
  } catch (error) {
    console.log("Contact page error:", error);
    return res.redirect("/user/Page-404");
  }
};

const loadAboutPage = async (req, res) => {
  try {
    const user = req.session.user || null;
    let userData = null;

    if (user && user._id) {
      userData = await User.findById(user._id);
    }

    return res.render("user/about", {
      user: userData
    });
  } catch (error) {
    return res.redirect("/user/Page-404");
  }
};

module.exports = {
  getForgotPasswordPage,
  postForgotPasswordPage,
  forgotpasswordVerifyOtp,
  getOtpPage,
  getResetpage,
  postNewPassword,
  forgotPasswordResendOtp,
  getprofilePage,
  getUpdateProfile,
  updateProfile,
  updateEmail,
  renderEmailOtpPage,
  verifyEmailOtp,
  resendEmailOtp,
  getchangePassword,
  changePassword,
  uploadProfileImage,
  loadContactPage,
  loadAboutPage
};
