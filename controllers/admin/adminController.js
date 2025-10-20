const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const loadAdminLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.redirect("/admin/dashboard");
    }
    res.render("admin/login", { message: null }); 
  } catch (error) {
    console.error("There is an error in loading admin login:", error);
    res.status(500).send("Server error loading admin login");
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Admin login attempt:", req.body);

    const admin = await User.findOne({ email, role: "admin" });
    if (!admin) {
      return res.render("admin/login", { message: "Admin not found or invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.render("admin/login", { message: "Invalid password" });
    }

    req.session.admin =admin._id
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Admin login failed:", error);
    res.render("admin/login", { message: "Login failed, please try again later" });
  }
};
const loadAdminDashboard = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect("/admin/login");
    }
    
    const admin = await User.findOne({ _id: req.session.admin._id });
    res.render("admin/dashboard", { admin }); // Pass admin variable
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
    res.status(500).send("Server error");
  }
};


const logout = async (req, res) => {
  try {
    if (req.session.admin) {
      delete req.session.admin;

      req.session.save((err) => {
        if (err) {
          console.log('Error saving session during logout:', err);
          return res.redirect('/admin/pageerror');
        }
        return res.redirect('/admin/login');
      });
    } else {
      return res.redirect('/admin/login');
    }
  } catch (error) {
    console.log('Logout error:', error);
    return res.redirect('/admin/pageerror');
  }
};



module.exports = {
  loadAdminLogin,
  adminLogin,
  loadAdminDashboard,
  logout
};