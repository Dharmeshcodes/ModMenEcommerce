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
const passport = require('passport');
const { userAuth, adminAuth } = require('../middlewares/auth');
const checkBlockedUser = require('../middlewares/checkBlockedUser');
const validateCartMiddleware=require("../middlewares/validateCartMiddleware")

const { uploadUserImages}=require('../middlewares/cloudinaryUploads')

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
router.get('/change-password',userAuth,profileController.getchangePassword);
router.post('/change-password', userAuth,profileController.changePassword)
router.post('/profile-image',userAuth,uploadUserImages.single('profileImage'),profileController.uploadProfileImage
);

router.get('/address',userAuth,addressController.getAddress);
router.get('/addAddress',userAuth,addressController.getAddAddress);
router.post('/addAddress',userAuth,addressController.postAddAddress);
router.get('/updateAddress/:addressId',userAuth,addressController.getUpdateAddress);
router.patch('/updateAddress/:addressId', userAuth,addressController.updateAddress);
router.delete('/deleteAddress/:addressId', userAuth,addressController.deleteAddress);

router.post("/addToCart",userAuth,cartController.addToCart)
router.get("/cart",userAuth,cartController.getCartPage)
router.post("/incresecartqty",userAuth,cartController.increseQuantity)
router.post("/decreasecartqty", userAuth, cartController.decreaseQuantity);
router.post("/removecartitem", userAuth, cartController.removeCartItem);
router.post("/emptycart", userAuth, cartController.emptyCart);

router.get("/checkout-address",userAuth,validateCartMiddleware,checkoutControllers.getCheckoutPage)
router.get("/checkoutPayment", userAuth, validateCartMiddleware,checkoutControllers.loadPaymentPage);
router.get("/order-review", userAuth,validateCartMiddleware, checkoutControllers.loadOrderReviewPage);


router.post("/confirmOrder", userAuth,validateCartMiddleware, orderController.confirmOrder);
router.get("/orderSuccess/:orderId", userAuth, orderController.loadOrderSuccess);
router.get("/order",userAuth,checkBlockedUser,orderController.getUserOrders)
router.get("/order/:orderId", userAuth, checkBlockedUser,orderController.getOrderDetails);
router.post("/cancel-order/:orderId", userAuth,checkBlockedUser,orderController.cancelOrder)
router.post('/cancelItem/:orderId/:itemId', orderController.cancelSingleItem);
router.post('/order/:orderId/return-item/:itemId', orderController.returnSingleItem);
router.post('/order/:orderId/return-order', orderController.returnEntireOrder);
router.get('/order/:orderId/invoice',userAuth,orderController.generateInvoice)

router.get("/online-payment/:orderId",userAuth,orderController.loadOnlinePaymentPage)
router.post("/verify-payment",userAuth,orderController.verifyRazorpayPayment);
router.get("/orderFailed/:orderId",userAuth, orderController.getOrderFailedPage);
router.get("/retry-payment/:orderId",userAuth, orderController.retryPayment);





router.post("/wishlist/add",userAuth, wishlistController.addToWishlist);
router.get("/wishlist",userAuth, wishlistController.getWishlist)
router.get('/wishlist/remove',userAuth, wishlistController.removeFromWishlist)
router.post("/wishlist/emptyWishlist/:userId", userAuth, wishlistController.emptyWishlist);



















module.exports = router;