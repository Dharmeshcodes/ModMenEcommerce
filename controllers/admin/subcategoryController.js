const Subcategory = require('../../models/subcategorySchema');
const Category = require('../../models/categorySchema');
const { getSalePrice } = require('../../utils/offerUtils');
const Product=require("../../models/productSchema")
const HTTP_STATUS = require("../../constans/httpStatus");
const MESSAGES = require("../../constans/messages");
const { apiLogger, errorLogger } = require("../../config/logger");

async function getSubcategory(req, res) {
  try {
    const search = req.query.search || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;

    const filter = search
      ? { $and: [{ name: { $regex: search, $options: 'i' } }, { isDeleted: false }] }
      : { isDeleted: false };

    const total = await Subcategory.countDocuments(filter);

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.min(page, totalPages || 1);

    const subcategories = await Subcategory.find(filter)
      .populate('category')
      .skip((currentPage - 1) * limit)
      .limit(limit)
      .sort({ _id: -1 })
      .lean();

    res.render('admin/subcategory', {
      subcategories,
      search,
      currentPage,
      totalPages,
    });
  } catch (err) {
    errorLogger.error('Error fetching subcategory list', { error: err });
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.COMMON.SOMETHING_WENT_WRONG);
  }
}

async function getAddSubcategoryPage(req, res) {
  try {
    const categories = await Category.find().lean();
    res.render('admin/addSubcategory', {
      categories,
      messages: req.flash(),
      formData: {},
    });
  } catch (err) {
    errorLogger.error('Error loading add subcategory page', { error: err });
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.COMMON.SOMETHING_WENT_WRONG);
  }
}


async function addSubcategory(req, res) {
  const { name, categoryId, isListed, offer: offerData = {} } = req.body;
  let formData = { name, categoryId, isListed: isListed === 'true', offer: offerData };

  try {
    if (!name || !categoryId) {
      req.flash('error_msg', 'Subcategory name and category are required.');
      const categories = await Category.find().lean();
      return res.render('admin/addSubcategory', { categories, messages: req.flash(), formData });
    }

    let offer;
    if (offerData.subcategoryOffer || offerData.maxRedeem || offerData.startDate || offerData.validUntil) {
      const offerPerc = parseFloat(offerData.subcategoryOffer);
      const maxR = parseInt(offerData.maxRedeem, 10) || 0;
      if (isNaN(offerPerc) || offerPerc < 1 || offerPerc > 100) {
        req.flash('error_msg', 'Offer percentage must be between 1 and 100.');
        const categories = await Category.find().lean();
        return res.render('admin/addSubcategory', { categories, messages: req.flash(), formData });
      }
      if (maxR < 0) {
        req.flash('error_msg', 'Max Redeem cannot be negative.');
        const categories = await Category.find().lean();
        return res.render('admin/addSubcategory', { categories, messages: req.flash(), formData });
      }
      if (!offerData.startDate || !offerData.validUntil || new Date(offerData.startDate) > new Date(offerData.validUntil)) {
        req.flash('error_msg', 'Invalid start date or valid until date.');
        const categories = await Category.find().lean();
        return res.render('admin/addSubcategory', { categories, messages: req.flash(), formData });
      }
      offer = {
        subcategoryOffer: offerPerc,
        maxRedeem: maxR,
        startDate: new Date(offerData.startDate),
        validUntil: new Date(offerData.validUntil),
      };
    }

    const subcat = new Subcategory({
      name: name.trim(),
      category: categoryId,
      offer,
      isListed: isListed === 'true',
    });

    if (req.file && req.file.path) {
      subcat.image = req.file.path;
    }

    await subcat.save();

    await Category.findByIdAndUpdate(categoryId, {
      $push: { subcategories: subcat._id },
    });

    req.flash('success_msg', 'Subcategory added successfully.');
    res.redirect('/admin/subcategory');
  } catch (err) {
     errorLogger.error('Error adding subcategory', { error: err });
    req.flash('error_msg', 'Failed to add subcategory.');
    const categories = await Category.find().lean();
    res.render('admin/addSubcategory', { categories, messages: req.flash(), formData });
  }
}

async function getEditSubcategoryPage(req, res) {
  try {
    const subcategory = await Subcategory.findById(req.params.id).populate('category').lean();
    const categories = await Category.find().lean();

    if (!subcategory) {
      req.flash('error_msg', MESSAGES.COMMON.NOT_FOUND);
      return res.redirect('/admin/subcategory');
    }

    res.render('admin/editSubcategory', {
      subcategory,
      categories,
      messages: req.flash(),
      formData: subcategory,
    });
  } catch (err) {
     errorLogger.error('Error loading edit subcategory page', { error: err })
    req.flash('error_msg', 'Error loading subcategory');
    res.redirect('/admin/subcategory');
  }
}

async function editSubcategory(req, res) {
  const { name, categoryId, isListed, offer: offerData = {} } = req.body;

  try {
    const subcat = await Subcategory.findById(req.params.id);
    if (!subcat) {
      req.flash('error_msg', 'Subcategory not found');
      return res.redirect('/admin/subcategory');
    }

    subcat.name = name.trim();
    subcat.category = categoryId;
    subcat.isListed = isListed === 'true';

    if (offerData.subcategoryOffer || offerData.maxRedeem || offerData.startDate || offerData.validUntil) {
      const offerPerc = parseFloat(offerData.subcategoryOffer);
      const maxR = parseInt(offerData.maxRedeem, 10) || 0;
      if (isNaN(offerPerc) || offerPerc < 1 || offerPerc > 100) {
        req.flash('error_msg', 'Offer percentage must be between 1 and 100.');
        return res.redirect(`/admin/editSubcategory/${req.params.id}`);
      }
      if (maxR < 0) {
        req.flash('error_msg', 'Max Redeem cannot be negative.');
        return res.redirect(`/admin/editSubcategory/${req.params.id}`);
      }
      if (!offerData.startDate || !offerData.validUntil || new Date(offerData.startDate) > new Date(offerData.validUntil)) {
        req.flash('error_msg', 'Invalid start date or valid until date.');
        return res.redirect(`/admin/editSubcategory/${req.params.id}`);
      }
      subcat.offer = {
        subcategoryOffer: offerPerc,
        maxRedeem: maxR,
        startDate: new Date(offerData.startDate),
        validUntil: new Date(offerData.validUntil),
      };
    } else {
      subcat.offer = undefined;
    }

    if (req.file && req.file.path) {
      subcat.image = req.file.path;
    }

    await subcat.save();

    req.flash('success_msg', 'Subcategory updated successfully');
    res.redirect('/admin/subcategory');
  } catch (err) {
    errorLogger.error('Error updating subcategory', { error: err });
    req.flash('error_msg', MESSAGES.COMMON.SOMETHING_WENT_WRONG);
    res.redirect(`/admin/editSubcategory/${req.params.id}`);
  }
}

async function toggleListStatus(req, res) {
  try {
    const subcat = await Subcategory.findById(req.params.id);
    if (!subcat) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Subcategory not found' });
    }

    subcat.isListed = !subcat.isListed;
    await subcat.save();

    res.json({ success: true, isListed: subcat.isListed, message: `Subcategory is now ${subcat.isListed ? 'listed' : 'unlisted'}` });
  } catch (err) {
    errorLogger.error('Error toggling subcategory list status', { error: err });
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, error: MESSAGES.COMMON.SOMETHING_WENT_WRONG })
  }
}
async function editOffer(req, res) {
  try {
    const subcategoryId = req.params.id;

    const { offerPercentage, maxRedeem, startDate, validUntil } = req.body;

    if (!offerPercentage || isNaN(offerPercentage) || offerPercentage < 1 || offerPercentage > 100) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Offer percentage must be between 1 and 100.'
      });
    }

    const maxR = parseInt(maxRedeem, 10);
    if (isNaN(maxR) || maxR < 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Max redeem must be 0 or a positive number.'
      });
    }

    if (!startDate || !validUntil || new Date(startDate) > new Date(validUntil)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid start date or valid until date.'
      });
    }

    const subcat = await Subcategory.findById(subcategoryId);
    if (!subcat) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Subcategory not found.'
      });
    }

    subcat.offer = {
      subcategoryOffer: parseFloat(offerPercentage),
      maxRedeem: maxR,
      startDate: new Date(startDate),
      validUntil: new Date(validUntil),
    };

    await subcat.save();

    const products = await Product.find({ subCategoryId: subcategoryId });

    for (const product of products) {
      const category = await Category.findById(product.categoryId);

      if (!Array.isArray(product.variants)) continue;

      let bestOffer = 0;
      let offerSource = null;

      for (const variant of product.variants) {
        const offerData = getSalePrice(
          variant.variantPrice,
          category ? category.offer : null,
          subcat.offer,
          product.offer
        );

        variant.salePrice = offerData.salePrice;

        if (offerData.bestOffer > bestOffer) {
          bestOffer = offerData.bestOffer;
          offerSource = offerData.offerSource;
        }
      }

      product.displayOffer = bestOffer;
      product.offerSource = offerSource;

      await product.save();
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Offer updated successfully'
    });

  } catch (error) {
    console.log("catch block hit");
    errorLogger.error('Error updating subcategory offer', { error });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG
    });
  }
}


async function softDeleteSubcategory(req, res) {
  try {
    const subcategoryId = req.params.id;

    const result = await Subcategory.findByIdAndUpdate(subcategoryId, { isDeleted: true });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Subcategory not found.' });
    }

    return res.json({ success: true, message: 'Subcategory deleted successfully.' });
  } catch (error) {
    errorLogger.error('Error soft deleting subcategory', { error });
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.COMMON.SOMETHING_WENT_WRONG });
  }
}
async function deleteSubcategoryOffer(req, res) {
  try {
    const subcategoryId = req.params.id;

    const subcat = await Subcategory.findById(subcategoryId);
    if (!subcat) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Subcategory not found'
      });
    }

    subcat.offer = undefined;
    await subcat.save();

    const products = await Product.find({ subCategoryId: subcategoryId });

    for (const product of products) {
      const category = await Category.findById(product.categoryId);

      if (!Array.isArray(product.variants)) continue;

      let bestOffer = 0;
      let offerSource = null;

      for (const variant of product.variants) {
        const offerData = getSalePrice(
          variant.variantPrice,
          category ? category.offer : null,
          null,                 // subcategory offer removed
          product.offer
        );

        variant.salePrice = offerData.salePrice;

        if (offerData.bestOffer > bestOffer) {
          bestOffer = offerData.bestOffer;
          offerSource = offerData.offerSource;
        }
      }

      product.displayOffer = bestOffer;
      product.offerSource = offerSource;

      await product.save();
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Subcategory offer removed successfully'
    });

  } catch (error) {
    errorLogger.error('Error deleting subcategory offer', { error });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG
    });
  }
}


module.exports = {
  getSubcategory,
  getAddSubcategoryPage,
  addSubcategory,
  getEditSubcategoryPage,
  editSubcategory,
  toggleListStatus,
  softDeleteSubcategory,
  editOffer,
  deleteSubcategoryOffer
};
