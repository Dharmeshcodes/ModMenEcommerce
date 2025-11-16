const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const addressController=require('../controllers/user/addressControll');
const productController = require('../controllers/user/productController');
const profileController = require('../controllers/user/profileController');
const passport = require('passport');
const { userAuth, adminAuth } = require('../middlewares/auth');
const checkBlockedUser = require('../middlewares/checkBlockedUser');

router.get('/home', checkBlockedUser,userController.loadHomepage);
router.get('/sale', userAuth, checkBlockedUser, userController.salePage);
router.get('/product/:id', userAuth, checkBlockedUser, productController.productDetails);

// Route: /signup
router.get('/signup', userController.loadSignup);
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);

router.get('/auth/google', userController.googleAuth);
router.get('/auth/google/callback', ...userController.googleAuthCallback);

router.get('/login', userController.loadLogin);
router.get('/Page-404', userController.PageNotFound);
router.post('/login', userController.login);
router.get('/logout',userController.logout);

router.get('/forgot-password', profileController.getForgotPasswordPage);
router.post('/forgot-password', profileController.postForgotPasswordPage);
router.post('/forgot-password/verify-otp',  profileController.forgotpasswordVerifyOtp);
router.get('/forgot-password/reset', profileController.getResetpage);
router.post('/forgot-password/reset',profileController.postNewPassword);
router.post('/forgot-password/resend-otp', profileController.forgotPasswordResendOtp);
router.get('/forgot-password/otp', profileController.getOtpPage);
router.get('/profile',userAuth,profileController.getprofilePage);
router.get('/updateProfile', userAuth, profileController.getUpdateProfile);
router.patch('/updateProfile', userAuth, profileController.updateProfile);
router.patch('/updateEmail', userAuth, profileController.updateEmail);
router.get('/verify-email-otp', userAuth, profileController.renderEmailOtpPage);
router.patch('/verify-email-otp', userAuth, profileController.verifyEmailOtp);
router.get('/resend-email-otp',userAuth,profileController.resendEmailOtp);

router.get('/address',userAuth,addressController.getAddress);
router.get('/addAddress',userAuth,addressController.getAddAddress);
router.post('/addAddress',userAuth,addressController.postAddAddress);
router.get('/updateAddress/:addressId',userAuth,addressController.getUpdateAddress);
router.patch('/updateAddress/:addressId', userAuth,addressController.updateAddress);
router.delete('/deleteAddress/:addressId', userAuth,addressController.deleteAddress);

// router.get('/test',userController.test)

module.exports = router;