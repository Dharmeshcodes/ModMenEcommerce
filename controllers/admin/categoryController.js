    const Category = require('../../models/categorySchema');

    const categoryInfo = async (req, res) => {
      try {
        const { search, page, sort } = req.query;
        const limit = 4;
        const currentPage = parseInt(page) || 1;
        const skip = (currentPage - 1) * limit;

        let query = { isDeleted: false };
        if (search && search.trim()) {
          query.name = { $regex: search.trim(), $options: 'i' };
        }

        let sortOption = { addedDate: -1 };
        if (sort === 'price-high') {
          sortOption = { 'offer.offerPercentage': -1 };
        } else if (sort === 'price-low') {
          sortOption = { 'offer.offerPercentage': 1 };
        } else if (sort === 'first-added') {
          sortOption = { addedDate: 1 };
        }

        const categoryData = await Category.find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .populate('subcategories')
          .lean();

        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

            res.render('admin/category', {
            categoryData,
            currentPage,
            totalPages,
            totalCategories,
            search: search || '',
            sort: sort || 'latest',
            messages: {
              error_msg: req.flash('error_msg')[0] || null,
              success_msg: req.flash('success_msg') || null
            }
          });
      } catch (error) {
        console.error('Error in categoryInfo:', error);
        res.redirect('/admin/pageerror');
      }
    };

    const getAddCategoryPage = async (req, res) => {
      try {
        res.render('admin/addCategory', {
          messages: req.flash(),
          formData: {}
        });
      } catch (error) {
        console.error('Error loading add category page:', error);
        req.flash('error_msg', 'Failed to load category add page');
        res.redirect('/admin/category');
      }
    };

    const addCategory = async (req, res) => {
      try {
        const { name, description, offer = {}, isListed } = req.body;

        const existingCategory = await Category.findOne({ name: name.trim() });
        if (existingCategory) {
      req.flash('error_msg', 'Category already exists');
      return res.render('admin/addCategory', {
        messages: { error_msg: 'Category already exists' },
        formData: req.body 
      });
    }

        let imageUrl = '';
        if (req.file) {
          imageUrl = req.file.path;
        }

        const offerParsed = {
          offerPercentage: Number(offer.offerPercentage) || 0,
          maxRedeem: Number(offer.maxRedeem) || 0,
          startDate: offer.startDate ? new Date(offer.startDate) : undefined,
          validUntil: offer.validUntil ? new Date(offer.validUntil) : undefined,
        };

        const newCategory = new Category({
          name: name.trim(),
          description: description || '',
          offer: offerParsed,
          isListed: isListed === 'true' || isListed === true,
          image: imageUrl
        });

        await newCategory.save();
        req.flash('success_msg', 'Category added successfully');
        return res.redirect('/admin/category');

      } catch (error) {
        console.error('Error in addCategory:', error);
        req.flash('error_msg', 'Server error saving new category');
        return res.redirect('/admin/category');
      }
    };

    const viewCategory = async (req, res) => {
      try {
        const categoryId = req.params.id;
        const category = await Category.findOne({ _id: categoryId, isDeleted: false })
          .populate('subcategories')
          .lean();

        if (!category) {
          return res.status(404).render('admin/Page-404', { messages: 'Category not found' });
        }

        category.subcategories = Array.isArray(category.subcategories) ? category.subcategories : [];
        category.offer = category.offer || {
          offerPercentage: 0,
          maxRedeem: 0,
          startDate: null,
          validUntil: null
        };

        return res.render('admin/viewCategory', { category });
      } catch (error) {
        console.error('Error in viewCategory:', error);
        return res.status(500).send('Server error in viewCategory');
      }
    };
const loadEditCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId).populate('subcategories').lean();

    if (!category) {
      req.flash('error_msg', 'Category not found');
      return res.redirect('/admin/category');
    }

    res.render('admin/editCategory', { category, messages: req.flash() });
  } catch (error) {
    console.error('Edit category load error:', error);
    req.flash('error_msg', 'Server error while loading category');
    res.redirect('/admin/category');
  }
};

const updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const {
      name,
      description,
      offer = {},
      isListed,
    } = req.body;
    const image = req.file ? req.file.path : null;
    
    const existingCategory = await Category.findOne({ name: name.trim(), _id: { $ne: categoryId } });
    if (existingCategory) {
      const category = await Category.findById(categoryId).populate('subcategories').lean();
      req.flash('error_msg', 'Category already exists');
      return res.render('admin/editCategory', {
        category,
        messages: { error_msg: 'Category already exists' },
        formData: req.body,
      });
    }

    const offerParsed = {
      offerPercentage: Number(offer.offerPercentage) || 0,
      maxRedeem: Number(offer.maxRedeem) || 0,
      startDate: offer.startDate ? new Date(offer.startDate) : undefined,
      validUntil: offer.validUntil ? new Date(offer.validUntil) : undefined,
    };

    const updatedFields = {
      name,
      description,
      offer: offerParsed,
      isListed: isListed === 'true' || isListed === true,
    };

    if (image) {
      updatedFields.image = image;
    }

    await Category.findByIdAndUpdate(categoryId, updatedFields);

    req.flash('success_msg', 'Category updated successfully');
    res.redirect('/admin/category');
  } catch (error) {
    console.error('Error updating category:', error);

    const category = await Category.findById(req.params.id).populate('subcategories').lean();

    req.flash('error_msg', 'Server error while updating category');
    res.render('admin/editCategory', { category, messages: req.flash() });
  }
};

module.exports = {
  loadEditCategory,
  updateCategory,
};

    const updateCategoryOffer = async (req, res) => {
      try {
        const { categoryId, offer, maxRedeemable, startDate, validUntil } = req.body;

        if (!categoryId || offer === undefined || !startDate || !validUntil) {
          return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const category = await Category.findById(categoryId);
        if (!category) {
          return res.status(404).json({ success: false, message: 'Category not found' });
        }

        category.offer = {
          offerPercentage: Number(offer),
          maxRedeem: Number(maxRedeemable) || 0,
          startDate: new Date(startDate),
          validUntil: new Date(validUntil),
        };

        await category.save();

        res.status(200).json({
          success: true,
          message: 'Offer updated successfully',
          data: category
        });

      } catch (error) {
        console.error('Offer update error:', error);
        res.status(500).json({ success: false, message: 'Server error while updating offer' });
      }
    };

    const deleteCategoryOffer = async (req, res) => {
      try {
        const { categoryId } = req.body;
        const category = await Category.findById(categoryId);

        if (!category) {
          return res.status(404).json({ success: false, message: 'Category not found' });
        }

        category.offer = undefined;

        await category.save();
        res.status(200).json({ success: true, message: 'Category offer deleted successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error while deleting the offer' });
      }
    };

    const toggleListStatus = async (req, res) => {
      try {
        const { categoryId, isListed } = req.body;
        const cat = await Category.findById(categoryId);
        if (!cat) {
          return res.status(404).json({ success: false, message: 'Category not found' });
        }

        cat.isListed = isListed;
        await cat.save();

        res.json({ success: true, isListed: cat.isListed, message: `Category is now ${cat.isListed ? 'listed' : 'unlisted'}` });
      } catch (error) {
        console.error('Error toggling category listing:', error);
        res.status(500).json({ success: false, message: 'Server error while toggle list status' });
      }
    };

    const softDeleteCategory = async (req, res) => {
      try {
        const categoryId = req.params.id;
        await Category.findByIdAndUpdate(categoryId, { isDeleted: true });
        res.json({ success: true, message: 'Category deleted (soft) successfully.' });
      } catch (err) {
        res.json({ success: false, message: 'Server error: Unable to delete.' });
      }
    };

    module.exports = {
      categoryInfo,
      getAddCategoryPage,
      addCategory,
      viewCategory,
      updateCategory,
      loadEditCategory,
      updateCategoryOffer,
      toggleListStatus,
      deleteCategoryOffer,
      softDeleteCategory
    };
