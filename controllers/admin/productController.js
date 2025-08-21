
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Subcategory = require("../../models/subcategorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require('path');
const sharp = require("sharp"); 
const mongoose = require("mongoose");
const { determineBestOffer, calculateBestPrice } = require("../../utils/offerUtils");



const getProducts = async (req, res) => {
  const limit = 10;
  try {
    const page = Number.parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const searchQuery = req.query.search || "";
    const category = req.query.category || "";
    const subcategory = req.query.subcategory || "";
    const priceRange = req.query.priceRange || "";
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder || "desc";
    const isActiveFilter = req.query.isActive || "";

    let minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : undefined;
    let maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined;

    const filter = {};

    if (searchQuery.trim()) {
      filter.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } }
      ];
    }

    if (category.trim()) {
      filter.categoryId = new mongoose.Types.ObjectId(category);
    }

    if (subcategory.trim()) {
      filter.subcategory = new mongoose.Types.ObjectId(subcategory);
    }

    if (isActiveFilter === "true") {
      filter.isDeleted = false;
    } else if (isActiveFilter === "false") {
      filter.isDeleted = true;
    }

    if (priceRange && !minPrice && !maxPrice) {
      const [min, max] = priceRange.split("-");
      minPrice = min ? parseFloat(min) : undefined;
      maxPrice = max ? parseFloat(max) : undefined;
    }

    if (!isNaN(minPrice) && !isNaN(maxPrice)) {
      filter["variants.variantPrice"] = { $gte: minPrice, $lte: maxPrice };
    } else if (!isNaN(minPrice)) {
      filter["variants.variantPrice"] = { $gte: minPrice };
    } else if (!isNaN(maxPrice)) {
      filter["variants.variantPrice"] = { $lte: maxPrice };
    }

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(filter)
      .populate("categoryId", "name")
      .populate("subcategory", "name")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const categories = await Category.find({ isListed: true });

    const admin = req.session.admin
      ? {
          name: req.session.admin.name,
          email: req.session.admin.email,
          profileImage: req.session.admin.profileImage || ""
        }
      : {};

    res.render("admin/adminProducts", {
      admin,
      products,
      categories,
      currentPage: page,
      totalPages,
      totalProducts,
      searchQuery,
      category,
      subcategory,
      limit,
      priceRange,
      minPrice: isNaN(minPrice) ? "" : minPrice,
      maxPrice: isNaN(maxPrice) ? "" : maxPrice,
      sortBy,
      sortOrder,
      isActiveFilter,
      query: req.query,
      error_msg: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).render("admin/adminProducts", {
      admin: req.session.admin || {},
      products: [],
      categories: [],
      currentPage: 1,
      totalPages: 0,
      totalProducts: 0,
      searchQuery: req.query.search || "",
      category: req.query.category || "",
      subcategory: req.query.subcategory || "",
      priceRange: req.query.priceRange || "",
      minPrice: req.query.minPrice || "",
      maxPrice: req.query.maxPrice || "",
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
      isActiveFilter: req.query.isActive || "",
      query: req.query,
      limit,
      error_msg: "Server error: " + error.message
    });
  }
};


const getProductAddPage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true }).lean();
    const subcategories = await Subcategory.find({ isListed: true }).lean();
    res.render("admin/addProducts", {
      categories,
      subcategories,
      categoryId: '',
      subCategoryId: '',
      messages: req.flash()
    });
  } catch (error) {
    console.error("Error in getProductAddPage:", error);
    res.redirect("/pageerror");
  }
};



const addProducts = async (req, res) => {
  try {
    const {
      name,
      description,
      categoryId,
      subCategoryId,
      color,
      offer,
      tags,
      fitType,
      washCare,
      isListed
    } = req.body;

    if (!name || !description || !categoryId || !color) {
      return res.status(400).json({
        error_msg: "Please fill all required fields (name, description, category, color)"
      });
    }

    const existingProduct = await Product.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") }
    });
    if (existingProduct) {
      return res.status(409).json({
        error_msg: "Product with the same name already exists"
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        error_msg: "Selected category not found"
      });
    }

    let subCategory = null;
    if (subCategoryId) {
      subCategory = await Subcategory.findById(subCategoryId);
      console.log("Submitted subCategoryId:", subCategoryId);
      if (!subCategory || String(subCategory.categoryId) !== String(category._id)) {
        return res.status(404).json({
          error_msg: "Selected subcategory not found for this category"
        });
      }
    }

    if (!req.files || req.files.length < 3) {
      return res.status(400).json({
        error_msg: "Please upload exactly 3 product images (1 main + 2 additional)"
      });
    }

    const images = req.files.map((file, index) => ({
      url: file.path,
      thumbnail: file.path,
      isMain: index === 0
    }));

    const productOffer = Number(offer) || 0;
    const categoryOffer = category.categoryOffer || 0;
    const subcategoryOffer = subCategory && subCategory.subcategoryOffer ? subCategory.subcategoryOffer : 0;
    const bestOffer = determineBestOffer(productOffer, categoryOffer, subcategoryOffer);

    const variants = [];
    const sizes = ["S", "M", "L", "XL"];

    const variantPrices = Array.isArray(req.body.variantPrice)
      ? req.body.variantPrice.map(p => Number(p)).filter(p => !isNaN(p) && p > 0)
      : [req.body.variantPrice].filter(Boolean).map(p => Number(p)).filter(p => !isNaN(p) && p > 0);

    const variantQuantities = Array.isArray(req.body.variantQuantity)
      ? req.body.variantQuantity.map(q => Number(q)).filter(q => !isNaN(q) && q > 0)
      : [req.body.variantQuantity].filter(Boolean).map(q => Number(q)).filter(q => !isNaN(q) && q > 0);

    if (variantPrices.length === 0 || variantQuantities.length === 0) {
      return res.status(400).json({
        error_msg: "At least one variant with valid price and quantity is required"
      });
    }
    if (variantPrices.length !== variantQuantities.length) {
      return res.status(400).json({
        error_msg: "Number of prices and quantities must match"
      });
    }

    const baseSku = name.slice(0, 3).toUpperCase() + Date.now().toString().slice(-4);

    for (let i = 0; i < variantPrices.length; i++) {
      const price = variantPrices[i];
      const quantity = variantQuantities[i];
      const size = sizes[i] || `SIZE_${i + 1}`;
      const { salePrice } = calculateBestPrice(price, productOffer, categoryOffer, subcategoryOffer);
      const sku = `${baseSku}-${size}-${color.toUpperCase().slice(0, 3)}`;

      variants.push({
        size,
        variantPrice: price,
        salePrice,
        variantQuantity: quantity,
        sku
      });
    }

    const tagArray = tags
      ? typeof tags === "string"
        ? tags.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0)
        : Array.isArray(tags) ? tags.map(tag => tag.trim()).filter(tag => tag.length > 0) : []
      : [];

    const newProduct = new Product({
      name: name.trim(),
      description: description.trim(),
      categoryId: new mongoose.Types.ObjectId(categoryId),
      subcategory: subCategoryId ? new mongoose.Types.ObjectId(subCategoryId) : undefined,
      color: color.trim(),
      offer: productOffer,
      displayOffer: bestOffer,
      offerSource:
        bestOffer === productOffer
          ? "product"
          : bestOffer === categoryOffer
          ? "category"
          : "subcategory",
      images,
      variants,
      tags: tagArray,
      fitType: fitType ? fitType.trim() : undefined,
      washCare: washCare ? washCare.trim() : undefined,
      ratings: { average: 0, count: 0 },
      isListed: isListed !== "false",
    });

    await newProduct.save();
        req.flash("success_msg", "Product added successfully!");
        return res.redirect("/admin/products");


  } catch (error) {
    console.error("PRODUCT CONTROLLER: Error in addProduct:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error_msg: "Validation error: " + messages.join(", ")
      });
    }
    return res.status(500).json({
      error_msg: "Something went wrong while adding the product. Please try again."
    });
  }
};

let getUpdateProductPage= async(req,res)=>{
    try{
        const productId=req.params.id;
        const product=await Product.findById(productId)
        .populate("categoryId")
        .populate("subcategory")
        .lean()

        if(!product){
            req.flas("error_msg","product not found")
            res.redirect("/admin/adminp\Products")
        }
        const category=await Category.find({isListed:true}).lean();
        const subcategory=await Subcategory.find({isListed:true}).lean()

        res.render("admin/updateProduct",{
            product,
            category,
            subcategory,
            message:req.flash()
        })
    }catch (err) {
    console.error("Error in getUpdateProductPage:", err);
    req.flash("error_msg", "Something went wrong");
    res.redirect("/admin/Adminroducts");
}
}

const postUpdateProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const {
      name,
      description,
      categoryId,
      subCategoryId,
      color,
      tags,
      fitType,
      washCare,
      isListed,
      variantQuantity,
      variantPrice
    } = req.body;

    let product = await Product.findById(productId);
    if (!product) {
      req.flash("error_msg", "product not found");
      return res.redirect("/admin/adminProducts");
    }

    product.name = name.trim();
    product.description = description.trim();
    product.categoryId = categoryId;
    product.subcategory = subCategoryId;
    product.color = color;
    product.isListed = isListed === "true";
    product.FitType = fitType ? fitType.trim() : product.FitType;
    product.washCare = washCare ? washCare.trim() : product.washCare;
    product.tags = tags
      ? typeof tags === "string"
        ? tags.split(",").map((t) => t.trim())
        : tags
      : [];

    product.variants = [];

    let quantities = Array.isArray(variantQuantity) ? variantQuantity : [variantQuantity];
    let prices = Array.isArray(variantPrice) ? variantPrice : [variantPrice];
    const sizes = ["S", "M", "L", "XL"];

    for (let i = 0; i < quantities.length && i < prices.length; i++) {
      const qty = Number(quantities[i]);
      const price = Number(prices[i]);

      if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
        product.variants.push({
          size: sizes[i] || `Size${i + 1}`,
          variantPrice: price,
          salePrice: calculateBestPrice(price, categoryOffer, subcategoryOffer, product.offer),
          variantQuantity: qty,
          sku: product.variants[i]?.sku || `${product.name.slice(0, 3).toUpperCase()}-${sizes[i]}-${color.slice(0, 3).toUpperCase()}`,
        });
      }
    }

    await product.save();

    req.flash("success_msg", "Product updated successfully!");
    res.redirect("/admin/adminProducts");

  } catch (err) {
    console.error("Error in postUpdateProduct:", err);
    req.flash("error_msg", "Unable to update the product. Please try again.");
    res.redirect(`/admin/updateProduct/${req.params.id}`);
  }
};








module.exports = {
    getProductAddPage,
    getProducts,
    addProducts,
    getUpdateProductPage,
     postUpdateProduct


    
};