const User = require("../../models/userSchema");
const bcrypt = require('bcrypt');
const validator = require('validator');
const nodemailer = require('nodemailer');
const env = require("dotenv").config();
const Product = require('../../models/productSchema');
const Category=require("../../models/categorySchema")
const subCategory=require('../../models/subcategorySchema')
const passport = require('../../config/passport');



  const testanythingGet= async (req,res)=>{

    let isLoggedIn=true
    let animals=["cat","dog","camel","lion"];
    const names="rahul"

    res.render("user/test",{animals,names,isLoggedIn})

  }
   const testanythingPost= async (req,res)=>{
   

    res.render("user/test",{message:"ejs starting"})
    
  }



     const loadHomepage = async (req, res) => {
  try {
    const user= req.session.user || null
    console.log(`the user name is ${user}`)
    
   
    let userDetails = null;
    if (user) {
      userDetails = await User.findById(user).lean();
     

     
      
    }
    const newArrivals = await Product.find({
      isDeleted: false,
      isListed: true
    })
      .populate('categoryId')
      .populate('subCategoryId')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    const premiumTrending = await Product.find({
      isDeleted: false,
      isListed: true,
      // $or:[
      //   {'offer.productOffer':{$gt:15}},
      //   {varientPrice:{$gt:1500}}
      // ]
    })
      .populate('categoryId')
      .populate('subCategoryId')
      .limit(8)
      .lean();


    

    return res.render('user/home', {
      newArrivals,
      premiumTrending,
      user:userDetails,
      isLandingPage: false,
    });
  } catch (error) {
    console.error('Error in getHome:', error);
    return res.redirect('/user/Page-404');
  }
};



const salePage = async (req, res) => {

  try {
         const user= req.session.user || null
    let userDetails = null;
    if (user) {
      userDetails = await User.findById(user).lean();
    }
    const {
      category,
      subCategory,
      size,
      sleeveType,
      fitType,
      sortBy,
      page = 1,
      search = ''
    } = req.query;

    const pageSize = 16;
    const skip = (page - 1) * pageSize;

   
    const categories = await Category.find({ isListed: true, isDeleted: false }).lean();

    let query = {
      isDeleted: false,
      isListed: true,
      'offer.productOffer': { $gt: 0 },
    };

    if (category) query.categoryId = { $in: Array.isArray(category) ? category : [category] };
    if (subCategory) query.subCategoryId = { $in: Array.isArray(subCategory) ? subCategory : [subCategory] };
    if (size) query['variants.size'] = { $in: Array.isArray(size) ? size : [size] };
    if (sleeveType) query.sleeveType = { $in: Array.isArray(sleeveType) ? sleeveType : [sleeveType] };
    if (fitType) query.fitType = { $in: Array.isArray(fitType) ? fitType : [fitType] };
    if (search && search.trim()) query.name = { $regex: search.trim(), $options: 'i' };

   
    const totalCount = await Product.countDocuments(query);

    
    let productsQuery = Product.find(query)
      .populate('categoryId')
      .populate('subCategoryId')
      .skip(skip)
      .limit(pageSize)
      .lean();

    if (sortBy === 'pricelowhigh') {
      productsQuery = productsQuery.sort({ 'variants.salePrice': 1 });
    } else if (sortBy === 'pricehighlow') {
      productsQuery = productsQuery.sort({ 'variants.salePrice': -1 });
    } else if (sortBy === 'newest') {
      productsQuery = productsQuery.sort({ createdAt: -1 });
    } else {
    
      productsQuery = productsQuery.sort({ _id: -1 });
    }

    const saleProducts = await productsQuery;
    const totalPages = Math.ceil(totalCount / pageSize);
    const currentPage = Number(page) || 1;

    
    const params = [];
    if (category) params.push(`category=${category}`);
    if (subCategory) params.push(`subCategory=${subCategory}`);
    if (size) params.push(`size=${size}`);
    if (sleeveType) params.push(`sleeveType=${sleeveType}`);
    if (fitType) params.push(`fitType=${fitType}`);
    if (sortBy) params.push(`sortBy=${sortBy}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    const paginationQuery = params.length ? `&${params.join('&')}` : '';

    res.render('user/sale', {
      categories,
      saleProducts,
      selectedCategories: Array.isArray(category) ? category : [category].filter(Boolean),
      selectedSubCategories: Array.isArray(subCategory) ? subCategory : [subCategory].filter(Boolean),
      selectedSizes: Array.isArray(size) ? size : [size].filter(Boolean),
      selectedSleeves: Array.isArray(sleeveType) ? sleeveType : [sleeveType].filter(Boolean),
      selectedFits: Array.isArray(fitType) ? fitType : [fitType].filter(Boolean),
      sortBy,
      currentPage,
      totalPages,
      paginationQuery,
      user:userDetails,
    
    });
  } catch (err) {
    console.error('Sale Page Error:', err);
    res.status(500).send('Server error');
  }
};


const PageNotFound = async (req, res) => {
  try {
    res.status(404).render("user/Page-404");
  } catch (error) {
    console.error("404 render error:", error);
    res.status(500).send("Something went wrong.");
  }
};

const loadSignup = async (req, res) => {
  try {
    res.render("user/signup", {
      error: [],
      formData: {}
    });
  } catch (error) {
    console.log("Signup page not loading:", error);
    res.status(500).send("Server error");
  }
};



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
      subject: "Verify you",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("error sending email", error);
    return false;
  }
}

const signup = async (req, res) => {

  try {
    const { fullName, mobile, email, password, confirmPassword } = req.body;
    const errors = [];

    if (validator.isEmpty(fullName)) errors.push('Full name is required');
    if (!validator.isEmail(email)) errors.push("A valid email is required");
    if (!validator.isStrongPassword(password, {
      minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1
    })) {
      errors.push("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol");
    }

    if (password !== confirmPassword) errors.push("Passwords do not match");

    if (errors.length > 0) {
      return res.render("user/signup", {
        error: errors,
        formData: { fullName, email, mobile }
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.render("user/signup", {
        error: ["Email is already in use"],
        formData: { fullName, email, mobile }
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) return res.json("email-error");

    req.session.userOtp = otp;
    req.session.userData = { fullName, phone: mobile, email, password };
    res.render("user/verify-otp", { email });

    console.log("OTP sent", otp);
     
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).send("Server Error");
  }
};

async function securePassword(password) {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log("Password hash error:", error);
    return null;
  }
}

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Entered OTP:", otp);

    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        fullName: user.fullName,
        email: user.email,
        mobile: user.phone,
        password: passwordHash
      });

      await saveUserData.save();
      req.session.user = saveUserData._id;

      res.json({ success: true, redirectUrl: "/user/login" });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP, please try again" });
    }
  } catch (error) {
    console.error("Error in verifying OTP:", error);
    res.status(500).json({ success: false, message: "Error occurred in verifying OTP" });
  }
};


const resendOtp = async (req, res) => {
  try {

   
    const { email } = req.session.userData;
    if (!email) {
      return res.status(400).json({ success: false, message: "email not found" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("resend otp", otp);
      res.status(200).json({ success: true, message: "otp resend successfully" });
    } else {
      res.status(500).json({ success: false, message: "failed to resend otp, please try again" });
    }
  } catch (error) {
    console.error("error sending otp", error);
    res.status(500).json({ success: false, message: "internal server error" });
  }
};


const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("user/login");
    } else {
      res.redirect("/user/home");
    }
  } catch (error) {
    res.redirect("/user/PageNotFound");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const finduser = await User.findOne({ email });

    if (!finduser) {
      return res.render("user/login", { message: "User not found" });
    }

    if (finduser.isBlocked) {
      return res.render("user/login", { message: "User blocked by admin" });
    }

    const PasswordMatch = await bcrypt.compare(password, finduser.password);

    if (!PasswordMatch) {
      return res.render("user/login", { message: "Incorrect Password" });
    }

    req.session.user = {
      _id: finduser._id,
      name: finduser.fullName
    };
    res.redirect("/user/home"); 

  } catch (error) {
    console.error("Login error:", error);
    res.render("user/login", { message: "Login failed, please try again later" });
  }
};


// Google OAuth initiation
const googleAuth = passport.authenticate('google', { 
  scope: ['profile', 'email'] 
});

// Google OAuth Callback
const googleAuthCallback = [
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // Check if user is blocked
      if (req.user.isBlocked) {
        req.logout((err) => {
          if (err) console.error('Logout error:', err);
        });
        return res.render("user/login", { message: "User blocked by admin" });
      }

      // Store user in session the SAME way as your regular login
      req.session.user = {
        _id: req.user._id,
        name: req.user.fullName
      };
      
      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/login');
        }
        console.log('Google login successful:', req.user.email);
        res.redirect('/user/home'); // Same redirect as regular login
      });
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect('/user/login');
    }
  }
];

const logout = async (req, res) => {
  try {
    if (req.session.user) {
      delete req.session.user;

      req.session.save((err) => {
        if (err) {
          console.log('Error saving session during logout:', err);
          return res.redirect('/pageNotFound');
        }
        return res.redirect('/user/login');
      });
    } else {
      return res.redirect('/user/login');
    }
  } catch (error) {
    console.log('Logout error:', error);
    return res.redirect('/pageNotFound');
  }
};

module.exports = {
  testanythingGet,
  testanythingPost,
  loadHomepage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,                
  loadLogin,
  PageNotFound,
  login,
  logout,
  salePage,
  googleAuth,
  googleAuthCallback,
 
};

