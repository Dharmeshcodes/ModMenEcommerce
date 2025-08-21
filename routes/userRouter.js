const express = require('express');
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require('passport');

// router.get("/home", userController.loadHomepage); 
// router.get("/signup", userController.loadSignup);
router.get("/home", (req, res, next) => {
  
  next();
}, userController.loadHomepage);

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
router.get("/PageNotFound", userController.PageNotFound);
router.post("/login", userController.login);
router.get("/home", (req, res) => {
  const user = req.session.user;
  res.render("home", { user });
});
router.get("/logout",userController.logout)

module.exports = router;