const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const addressController=require('../controllers/user/addressControll');
const productController = require('../controllers/user/productController');
const profileController = require('../controllers/user/profileController');
const cartController = require('../controllers/user/cartController');
const checkoutControllers=require("../controllers/user/checkoutControllers")
const orderController=require("../controllers/user/orderController")
const wishlistController=require("../controllers/user/wishlistController")
const couponController=require("../controllers/user/couponController")
const razorpayController=require("../controllers/user/razorpayController")
const passport = require('passport');
const { userAuth, adminAuth } = require('../middlewares/auth');
const checkBlockedUser = require('../middlewares/checkBlockedUser');
const validateCartMiddleware=require("../middlewares/validateCartMiddleware")
const walletController=require("../controllers/user/walletController")
const reviewController=require("../controllers/user/reviewController")

const { uploadUserImages}=require('../middlewares/cloudinaryUploads')

router.get('/home', checkBlockedUser,userController.loadHomepage);
router.get('/sale',checkBlockedUser, userController.salePage);
router.get('/product/:id',checkBlockedUser, productController.productDetails);

// Route: /signup
router.get('/signup', userController.loadSignup);
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get("/referral-code", userAuth, userController.getReferralCodePage);
router.post("/generate-referral",userAuth,userController.createReferralCode);

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
router.get('/change-password',userAuth,profileController.getchangePassword);
router.post('/change-password', userAuth,profileController.changePassword)
router.post('/profile-image',userAuth,uploadUserImages.single('profileImage'),profileController.uploadProfileImage);
router.get("/contact",checkBlockedUser,profileController.loadContactPage)
router.get("/about",checkBlockedUser,profileController.loadAboutPage)

router.get('/address',userAuth,checkBlockedUser,addressController.getAddress);
router.get('/addAddress',userAuth,checkBlockedUser,addressController.getAddAddress);
router.post('/addAddress',userAuth,checkBlockedUser,addressController.postAddAddress);
router.get('/updateAddress/:addressId',userAuth,checkBlockedUser,addressController.getUpdateAddress);
router.patch('/updateAddress/:addressId', userAuth,checkBlockedUser,addressController.updateAddress);
router.delete('/deleteAddress/:addressId', userAuth,checkBlockedUser,addressController.deleteAddress);

router.post("/addToCart",userAuth,checkBlockedUser,cartController.addToCart)
router.get("/cart",userAuth,checkBlockedUser,cartController.getCartPage)
router.post("/incresecartqty",userAuth,checkBlockedUser,cartController.increseQuantity)
router.post("/decreasecartqty", userAuth,checkBlockedUser,cartController.decreaseQuantity);
router.post("/removecartitem", userAuth,checkBlockedUser, cartController.removeCartItem);
router.post("/emptycart", userAuth,checkBlockedUser, cartController.emptyCart);

router.get("/checkout-address",userAuth,validateCartMiddleware,checkoutControllers.getCheckoutPage)
router.get("/checkoutPayment", userAuth, validateCartMiddleware,checkoutControllers.loadPaymentPage);
router.get("/order-review", userAuth,validateCartMiddleware, checkoutControllers.loadOrderReviewPage);

router.post("/confirmOrder", userAuth,validateCartMiddleware,orderController.confirmOrder);
router.get("/orderSuccess/:orderId", userAuth, orderController.loadOrderSuccess);
router.get("/order",userAuth,checkBlockedUser,orderController.getUserOrders)
router.get("/order/:orderId", userAuth, checkBlockedUser,orderController.getOrderDetails);
router.post("/cancel-order/:orderId", userAuth,orderController.cancelOrder)
router.post('/cancelItem/:orderId/:itemId',orderController.cancelSingleItem);
router.post('/order/:orderId/return-item/:itemId', orderController.returnSingleItem);
router.post('/order/:orderId/return-order', orderController.returnEntireOrder);
router.get('/order/:orderId/invoice',userAuth,orderController.generateInvoice)

router.get("/online-payment/:orderId",userAuth,razorpayController.loadOnlinePaymentPage)
router.post("/verify-payment",userAuth,razorpayController.verifyRazorpayPayment);
router.get("/orderFailed/:orderId",userAuth, razorpayController.getOrderFailedPage);
router.get("/retry-payment/:orderId",userAuth, razorpayController.retryPayment);

router.post("/wishlist/toggle",userAuth,checkBlockedUser,wishlistController.toggleWishlist);

router.get("/wishlist",userAuth, checkBlockedUser,wishlistController.getWishlist)
router.get('/wishlist/remove',userAuth,checkBlockedUser, wishlistController.removeFromWishlist)
router.post("/wishlist/emptyWishlist/:userId", userAuth, wishlistController.emptyWishlist);

router.get("/wallet",userAuth,checkBlockedUser,walletController.getWalletPage)
router.post("/wallet/create-order",checkBlockedUser,walletController.createWalletOrder);
router.post("/wallet/verify-payment",walletController.verifyWalletPayment)

router.get("/coupon", userAuth, checkBlockedUser,couponController.loadUserCoupons);
router.post("/apply-coupon", userAuth,checkBlockedUser, couponController.applyCoupon);
router.post("/cancel-coupon", userAuth,checkBlockedUser, couponController.cancelCoupon);
router.get("/available-coupons", userAuth, couponController.availableCoupons);

router.post("/review/add",userAuth,reviewController.addReview);
router.delete("/review/:reviewId",reviewController.deleteReview);



module.exports = router;