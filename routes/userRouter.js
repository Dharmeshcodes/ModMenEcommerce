const express = require('express');
const router = express.Router();
const userController = require("../controllers/user/userController");
const productController=require("../controllers/user/productController")
const passport = require('passport');
const {userAuth, adminAuth} =require("../middlewares/auth")


router.get("/test",userController.testanythingGet);
router.post("/test",userController.testanythingPost)



router.get("/home", userController.loadHomepage);
router.get("/sale",userAuth, userController.salePage);
router.get("/product/:id",userAuth,productController.productDetails)



// Route: /signup
router.get("/signup", (req, res, next) => {
  console.log(" [GET] /signup route hit");
  next();
}, userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
router.get('/auth/google/callback',
  passport.authenticate('google', {
    successRedirect: '/user/home', 
    failureRedirect: '/login'
  })
);

router.get("/login", userController.loadLogin);
router.get("/Page-404", userController.PageNotFound);
router.post("/login", userController.login);

router.get("/logout",userController.logout)

module.exports = router;