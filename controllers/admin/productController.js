const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Subcategory = require("../../models/subcategorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const mongoose = require("mongoose");
const { calculateBestPrice } = require("../../utils/offerUtils");

const getProducts = async (req, res) => {
  const limit = 6;
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
        { description: { $regex: searchQuery, $options: "i" } },
      ];
    }

    if (category.trim()) {
      filter.categoryId = new mongoose.Types.ObjectId(category);
    }

    if (subcategory.trim()) {
      filter.subcategory = new mongoose.Types.ObjectId(subcategory);
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

     filter.isDeleted=false

    const products = await Product.find(filter)
      .populate("categoryId", "name")
      .populate("subCategoryId", "name")
      .sort(sort)
      .skip(skip)
      .limit(limit);

      // let sum=0
      // products.forEach(product=>{

      //   sum=sum+product.varients.varientPrice
      //   console.log(sum)

      // })

    const categories = await Category.find({ isListed: true });

    const admin = req.session.admin
      ? {
          name: req.session.admin.name,
          email: req.session.admin.email,
          profileImage: req.session.admin.profileImage || "",
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
      error_msg: null,
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
      error_msg: "Server error: " + error.message,
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
      categoryId: "",
      subCategoryId: "",
      messages: req.flash(),
    });
  } catch (error) {
    console.error("Error in getProductAddPage:", error);
    res.redirect("/pageerror");
  }
};


function calculateVariantPrice(variantPrice, productOffer = 0, categoryOffer = 0, subcategoryOffer = 0) {
  const bestOffer = Math.max(productOffer || 0, categoryOffer || 0, subcategoryOffer || 0);
  const discount = (variantPrice * bestOffer) / 100;
  const salePrice = Math.max(Math.round(variantPrice - discount), 0);
  return { salePrice, bestOffer };
}

const addProducts = async (req, res) => { 
  try {
    const {
      name,
      description,
      categoryId,
      subCategoryId,
      color,
      tags,
      fitType,
      sleeveType,
      washCare,
      isListed,
    } = req.body;

  
    const offer = {
      productOffer: Number(req.body['offer.productOffer']) || 0,
      maxRedeem: Number(req.body['offer.maxRedeem']) || 0,
      startDate: req.body['offer.startDate'] ? new Date(req.body['offer.startDate']) : undefined,
      validUntil: req.body['offer.validUntil'] ? new Date(req.body['offer.validUntil']) : undefined,
    };

   

    if (!name || !description || !categoryId || !color || !fitType || !sleeveType) {
      req.flash(
        "error_msg",
        "Please fill all required fields (name, description, category, color, sleeveType, fitType)"
      );
      return res.redirect("/admin/addProducts");
    }

    const category = await Category.findById(categoryId);
    let subCategory = null;
    if (subCategoryId) {
      subCategory = await Subcategory.findById(subCategoryId);
    }

    const productOffer = offer.productOffer;
    const categoryOffer = Number(category?.offer?.offerPercentage) || 0;
    const subcategoryOffer = Number(subCategory?.offer?.offerPercentage) || 0;


    const bestOffer = Math.max(productOffer, categoryOffer, subcategoryOffer);
    let offerSource = "product";
    if (bestOffer === categoryOffer) offerSource = "category";
    else if (bestOffer === subcategoryOffer) offerSource = "subcategory";
    const displayOffer = bestOffer || 0;

    const productofferData = {
      productOffer,
      maxRedeem: offer.maxRedeem,
      startDate: offer.startDate,
      validUntil: offer.validUntil,
    };
    
    const sizes = ["S", "M", "L", "XL"];
    const variants = [];

    for (let size of sizes) {
      const price = Number(req.body.price?.[size]);
      const quantity = Number(req.body.qty?.[size]);

      if (!isNaN(price) && price > 0 && !isNaN(quantity) && quantity > 0) {
        const { salePrice } = calculateVariantPrice(
          price,
          productOffer,
          categoryOffer,
          subcategoryOffer
        );

        const sku = `${name.slice(0, 3).toUpperCase()}-${color.slice(0, 3).toUpperCase()}-${size}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        variants.push({
          size,
          variantPrice: price,
          salePrice,
          variantQuantity: quantity,
          sku,
          color,
        });
      }
    }

    if (variants.length === 0) {
      req.flash("error_msg", "At least one variant with valid price and quantity is required");
      return res.redirect("/admin/addProducts");
    }

    const newProduct = new Product({
      name: name.trim(),
      description: description.trim(),
      categoryId,
      subCategoryId: subCategoryId || undefined,
      color: color.trim(),
      offer: productofferData,
      displayOffer,
      offerSource,
      images: req.files.map((file, i) => ({
        url: file.path,
        thumbnail: file.path,
        isMain: i === 0,
      })),
      variants,
      tags: tags?.split(",").map(t => t.trim()),
      fitType: fitType?.trim(),
      sleeveType: sleeveType?.trim(),
      washCare: washCare?.trim(),
      ratings: { average: 0, count: 0 },
      isListed: isListed !== "false",
    });

    //console.log("SKUs for variants :", variants.map(v => v.sku));

    await newProduct.save();
    req.flash("success_msg", "Product added successfully!");
    return res.redirect("/admin/adminProducts");

  } catch (error) {
    console.error("Add product error:", error);
    req.flash("error_msg", "Something went wrong while adding the product. Please try again.");
    return res.redirect("/admin/addProducts");
  }
};


const getUpdateProductPage = async (req, res) => {
  const productId = req.params.id;
  try {
    const product = await Product.findById(productId).lean();
    if (!product) {
      req.flash("error_msg", "Product not found");
      return res.redirect("/admin/adminProducts");
    }
    const categories = await Category.find({ isListed: true }).lean();
    const subcategories = await Subcategory.find({ isListed: true }).lean();

    res.render("admin/updateProduct", {
      product,
      categories,
      subcategories,
      messages: req.flash(),
    });
  } catch (error) {
   
    req.flash("error_msg", "An error occurred loading the product.");
    res.redirect("/admin/adminProducts");
  }
};

const updateProduct = async (req, res) => {
  console.log("REQ.BODY:", req.body);
console.log("REQ.FILES:", req.files);

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
      sleeveType,
      washCare,
      isListed,
    } = req.body;

    const offer = {
      productOffer: Number(req.body['offer.productOffer']) || 0,
      maxRedeem: Number(req.body['offer.maxRedeem']) || 0,
      startDate: req.body['offer.startDate'] ? new Date(req.body['offer.startDate']) : undefined,
      validUntil: req.body['offer.validUntil'] ? new Date(req.body['offer.validUntil']) : undefined,
    };

    if (!name || !description || !categoryId || !color || !fitType || !sleeveType) {
      req.flash(
        'error_msg',
        'Please fill all required fields (name, description, category, color, sleeveType, fitType)'
      );
      return res.redirect(`/admin/updateProduct/${productId}`);
    }

    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error_msg', 'Product not found.');
      return res.redirect('/admin/adminProducts');
    }

    const category = await Category.findById(categoryId);
    let subCategory = null;
    if (subCategoryId) {
      subCategory = await Subcategory.findById(subCategoryId);
    }

    const productOffer = offer.productOffer;
    const categoryOffer = Number(category?.offer?.offerPercentage) || 0;
    const subcategoryOffer = Number(subCategory?.offer?.offerPercentage) || 0;

    const bestOffer = Math.max(productOffer, categoryOffer, subcategoryOffer);
    let offerSource = 'product';
    if (bestOffer === categoryOffer) offerSource = 'category';
    else if (bestOffer === subcategoryOffer) offerSource = 'subcategory';
    const displayOffer = bestOffer || 0;

    const productofferData = {
      productOffer,
      maxRedeem: offer.maxRedeem,
      startDate: offer.startDate,
      validUntil: offer.validUntil,
    };

    const sizes = ['S', 'M', 'L', 'XL'];
    const variants = [];

    for (let size of sizes) {
      const price = Number(req.body.price?.[size]);
      const quantity = Number(req.body.qty?.[size]);

      if (!isNaN(price) && price > 0 && !isNaN(quantity) && quantity > 0) {
        const { salePrice } = calculateVariantPrice(
          price,
          productOffer,
          categoryOffer,
          subcategoryOffer
        );

        const sku =
          product.variants.find((v) => v.size === size)?.sku ||
          `${name.slice(0, 3).toUpperCase()}-${color.slice(0, 3).toUpperCase()}-${size}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        variants.push({
          size,
          variantPrice: price,
          salePrice,
          variantQuantity: quantity,
          sku,
          color,
        });
      }
    }

    if (variants.length === 0) {
      req.flash('error_msg', 'At least one variant with valid price and quantity is required');
      return res.redirect(`/admin/updateProduct/${productId}`);
    }

    product.name = name.trim();
    product.description = description.trim();
    product.categoryId = categoryId;
    product.subCategoryId = subCategoryId || undefined;
    product.color = color.trim();
    product.offer = productofferData;
    product.displayOffer = displayOffer;
    product.offerSource = offerSource;

    
    if (req.files && req.files.length > 0) {
      product.images = req.files.map((file, i) => ({
        url: file.path,
        thumbnail: file.path,
        isMain: i === 0,
      }));
    }

    product.variants = variants;
    product.tags = tags?.split(',').map((t) => t.trim()) || [];
    product.fitType = fitType?.trim();
    product.sleeveType = sleeveType?.trim();
    product.washCare = washCare?.trim();
    product.isListed = isListed !== 'false';

    await product.save();
    
     return res.redirect('/admin/adminProducts');
    req.flash('success_msg', 'Product updated successfully!');
   
  } catch (error) {
    console.error('Update product error:', error);
    req.flash('error_msg', 'Something went wrong while updating the product. Please try again.');
    return res.redirect(`/admin/updateProduct/${req.params.id}`);
  }
};

const toggleListStatus= async(req,res)=>{
  try{
    

    const productId=req.params.id
 

    const {isListed}=req.body
    const product=await Product.findById(productId)

    if(!product){
     return res.status(404).json({message:'product not found'})
    }

    product.isListed=isListed
    await product.save()
    res.json({success:true,newstatus:product.isListed})
  }
  catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
 
}

const softDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isDeleted = true; 
    await product.save();
    console.log("produc deleted",product)
    res.json({ success: true, message: 'Product soft deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


 const addOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { offerPercentage, maxRedeem, startDate, validUntil } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!product.offer) {
      product.offer = {};
    }

    product.offer.productOffer = offerPercentage;
    product.offer.maxRedeem = maxRedeem;
    product.offer.startDate = new Date(startDate);
    product.offer.validUntil = new Date(validUntil);

    await product.save();

    res.json({ success: true, message: 'Offer added successfully', offer: product.offer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
const editOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const { offerPercentage, maxRedeem, startDate, validUntil } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!product.offer) {
      product.offer = {};
    }

    product.offer.productOffer = offerPercentage;
    product.offer.maxRedeem = maxRedeem;
    product.offer.startDate = new Date(startDate);
    product.offer.validUntil = new Date(validUntil);

    await product.save();

    res.json({ success: true, message: 'Offer updated successfully', offer: product.offer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteOffer = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.offer = undefined;
    await product.save();

    res.json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

 





module.exports = {
  getProductAddPage,
  getProducts,
  addProducts,
  getUpdateProductPage,
  updateProduct,
  toggleListStatus,
  softDeleteProduct,
  addOffer,
  editOffer,
  deleteOffer
};
