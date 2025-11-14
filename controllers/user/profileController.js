const User = require('../../models/userSchema');
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

module.exports = {
  getForgotPasswordPage,
  postForgotPasswordPage,
  forgotpasswordVerifyOtp,
  getOtpPage,
  getResetpage,
  postNewPassword,
  forgotPasswordResendOtp
};
