const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const validator = require('validator');
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const subCategory = require('../../models/subcategorySchema');
const passport = require('../../config/passport');
const { apiLogger, errorLogger } = require('../../config/logger');

const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user ? await User.findById(req.session.user._id).lean() : null;
    
    const newArrivals = await Product.find({
      isDeleted: false,
      isListed: true,
    })
      .populate({ 
        path: 'categoryId', 
        match: { isListed: true, isDeleted: false } 
      })
      .populate({ 
        path: 'subCategoryId', 
        match: { isListed: true, isDeleted: false } 
      })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
   
    const filteredNewArrivals = newArrivals.filter(
      p => p.categoryId && p.subCategoryId
    );
  
    const premiumTrending = await Product.find({
      isDeleted: false,
      isListed: true,
      'variants.variantPrice':{$gt:1500}
    })
      .populate({ 
        path: 'categoryId', 
        match: { isListed: true, isDeleted: false } 
      })
      .populate({ 
        path: 'subCategoryId', 
        match: { isListed: true, isDeleted: false } 
      })
      .limit(12)
      .lean();

    const filteredPremiumTrending = premiumTrending.filter(
      p => p.categoryId && p.subCategoryId
    );

    return res.render('user/home', {
      newArrivals: filteredNewArrivals,
      premiumTrending: filteredPremiumTrending,
      user: user,
      isLandingPage: false,
    });
  } catch (error) {
    console.log('Error loading homepage:', error);
    return res.redirect('/user/Page-404');
  }
};

const salePage = async (req, res) => {
  try {
    const user = req.session.user || null;
    let userDetails = null;
    if (user && user._id) {
      userDetails = await User.findById(user._id).lean();
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
    };

    if (category) query.categoryId = { $in: Array.isArray(category) ? category : [category] };
    if (subCategory) query.subCategoryId = { $in: Array.isArray(subCategory) ? subCategory : [subCategory] };
    if (size) query['variants.size'] = { $in: Array.isArray(size) ? size : [size] };
    if (sleeveType) query.sleeveType = { $in: Array.isArray(sleeveType) ? sleeveType : [sleeveType] };
    if (fitType) query.fitType = { $in: Array.isArray(fitType) ? fitType : [fitType] };
    if (search && search.trim()) query.name = { $regex: search.trim(), $options: 'i' };

    const totalCount = await Product.countDocuments(query);

    let productsQuery = Product.find(query)
      .populate({ path: 'categoryId', match: { isListed: true, isDeleted: false } })
      .populate({ path: 'subCategoryId', match: { isListed: true, isDeleted: false } })
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

    let saleProducts = await productsQuery;
    
    saleProducts = saleProducts.filter(
      product => product.categoryId && product.subCategoryId
    );
   
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
      user: userDetails,
      search: search
    });
  } catch (err) {
    errorLogger.error('Sale Page Error: %o', err);
    res.status(500).send('Server error');
  }
};

const PageNotFound = async (req, res) => {
  try {
    res.status(404).render('user/Page-404');
  } catch (error) {
    errorLogger.error('404 render error: %o', error);
    res.status(500).send('Something went wrong.');
  }
};

const loadSignup = async (req, res) => {
  try {
    res.render('user/signup', {
      error: [],
      formData: {}
    });
  } catch (error) {
    errorLogger.error('Signup page not loading: %o', error);
    res.status(500).send('Server error');
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
      subject: 'Verify you',
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`
    });
    return info.accepted.length > 0;
  } catch (error) {
    errorLogger.error('error sending email: %o', error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { fullName, mobile, email, password, confirmPassword } = req.body;
    const errors = [];
    if (validator.isEmpty(fullName)) errors.push('Full name is required');
    if (!validator.isEmail(email)) errors.push('A valid email is required');
    if (!validator.isStrongPassword(password, {
      minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1
    })) {
      errors.push('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol');
    }
    if (password !== confirmPassword) errors.push('Passwords do not match');
    if (errors.length > 0) {
      return res.render('user/signup', {
        error: errors,
        formData: { fullName, email, mobile }
      });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.render('user/signup', {
        error: ['Email is already in use'],
        formData: { fullName, email, mobile }
      });
    }
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) return res.json('email-error');
    req.session.userOtp = otp;
    req.session.userData = { fullName, phone: mobile, email, password };
    res.render('user/verify-otp', { email });
    apiLogger.info('the otp is : %o', otp);
  }
  catch (error) {
    errorLogger.error('Signup error: %o', error);
    res.status(500).send('Server Error');
  }
};

async function securePassword(password) {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    errorLogger.error('Password hash error: %o', error);
    return null;
  }
}

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
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
      delete req.session.userOtp;
      delete req.session.userData;
      res.status(200).json({ success: true, redirectUrl: '/user/login' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP, please try again' });
    }
  } catch (error) {
    errorLogger.error('Error in verifying OTP: %o', error);
    res.status(500).json({ success: false, message: 'Error occurred in verifying OTP' });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res.status(400).json({ success: false, message: 'email not found' });
    }
    const otp = generateOtp();
    req.session.userOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      apiLogger.info('resend otp: %o', otp);
      res.status(200).json({ success: true, message: 'otp resend successfully' });
    } else {
      res.status(500).json({ success: false, message: 'failed to resend otp, please try again' });
    }
  } catch (error) {
    errorLogger.error('error sending otp: %o', error);
    res.status(500).json({ success: false, message: 'internal server error' });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      const blocked = req.query.blocked === 'true';
      return res.render('user/login', {
        message: blocked ? 'Your account has been blocked by the administrator' : ''
      });
    } else {
      res.redirect('/user/home');
    }
  } catch (error) {
    errorLogger.error('Error in loadLogin: %o', error);
    res.redirect('/user/PageNotFound');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const finduser = await User.findOne({ email });
    if (!finduser) {
      return res.render('user/login', { message: 'User not found' });
    }
    if (finduser.isBlocked) {
      return res.render('user/login', { message: 'User blocked by admin' });
    }
    const PasswordMatch = await bcrypt.compare(password, finduser.password);
    if (!PasswordMatch) {
      return res.render('user/login', { message: 'Incorrect Password' });
    }
    req.session.user = {
      _id: finduser._id,
      name: finduser.fullName
    };
    res.redirect('/user/home');
  } catch (error) {
    errorLogger.error('Login error: %o', error);
    res.render('user/login', { message: 'Login failed, please try again later' });
  }
};

const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email']
});

const googleAuthCallback = [
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      if (req.user.isBlocked) {
        req.logout((err) => {
          if (err) errorLogger.error('Logout error: %o', err);
        });
        return res.render('user/login', { message: 'User blocked by admin' });
      }
      req.session.user = {
        _id: req.user._id,
        name: req.user.fullName
      };
      req.session.save((err) => {
        if (err) {
          errorLogger.error('Session save error: %o', err);
          return res.redirect('/login');
        }
        apiLogger.info('Google login successful: %s', req.user.email);
        res.redirect('/user/home');
      });
    } catch (error) {
      errorLogger.error('Google callback error: %o', error);
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
          errorLogger.error('Error saving session during logout: %o', err);
          return res.redirect('/pageNotFound');
        }
        return res.redirect('/user/login');
      });
    } else {
      return res.redirect('/user/login');
    }
  } catch (error) {
    errorLogger.error('Logout error: %o', error);
    return res.redirect('/pageNotFound');
  }
};

module.exports = {
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
