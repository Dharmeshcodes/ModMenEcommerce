const User = require("../../models/userSchema");
const bcrypt = require('bcrypt');
const validator = require('validator');
const nodemailer = require('nodemailer');
const env = require("dotenv").config();


const loadHomepage = async (req, res) => {
  try {
    console.log("Loading homepage for path:", req.path);
    const featuredProducts = [{ name: "Shirt", price: 999 }, { name: "Pant", price: 1499 }];
    let userData = null;

    if (req.session.user) {
      console.log("Session user:", req.session.user);
      userData = await User.findOne({ _id: req.session.user._id });
      console.log("Fetched userData:", userData);
    } else {
      console.log("No session user found");
    }

    res.render("home", { featuredProducts, user: userData }); 
  } catch (error) {
    console.log("Error in homepage rendering:", error);
    res.status(500).send("Server error");
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
  console.log("Signup route hit:", req.body);
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

    console.log("otp recieved ")
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



const logout = async (req, res) => {
  try {
    req.session.destroy(function (error) {
      if (error) {
        console.error("session not destroyed", error);
        res.status(500).send("failed to logout");
      } else {
        res.clearCookie('connect.sid');
        res.redirect("/user/home"); 
      }
    });
  } catch (error) {
    console.error("logout error", error);
    res.status(500).send("Server error during logout");
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
  logout
};
