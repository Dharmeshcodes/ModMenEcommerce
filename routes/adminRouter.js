const express=require('express');
const router=express.Router()
const customerController=require('../controllers/admin/customerController')
const adminController=require('../controllers/admin/adminController')
const categoryController=require('../controllers/admin/categoryController')
const subcategoryController=require('../controllers/admin/subcategoryController')
const productController=require('../controllers/admin/productController')
const {
  uploadProductImages,
  uploadCategoryImages,
  uploadUserImages,
   uploadSubcategoryImages,
} = require('../middlewares/cloudinaryUploads');

const {userAuth, adminAuth} =require("../middlewares/auth")


//admin

router.get("/login",adminController.loadAdminLogin)
router.post("/login",adminController.adminLogin)
router.get("/dashboard", adminAuth , adminController.loadAdminDashboard)
router.get("/logout",adminController.logout)

//customer
router.get("/customers",adminAuth,customerController.customerInfo)
router.get("/customerDetails/:id",adminAuth,customerController.customerDetails)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)


//categoy Admin
router.get("/category",adminAuth,categoryController.categoryInfo)
router.get("/addCategory", adminAuth,categoryController. getAddCategoryPage) 
router.get("/viewCategory/:id",adminAuth,categoryController.viewCategory)
router.get("/editCategory/:id", adminAuth, categoryController.loadEditCategory);

router.post("/editCategory/:id",adminAuth, uploadCategoryImages.single("categoryImage"),categoryController.updateCategory);

router.post('/addCategory', adminAuth, uploadCategoryImages.single('categoryImage'), categoryController.addCategory);
router.patch("/updateCategoryOffer",adminAuth, categoryController.updateCategoryOffer);
router.patch('/toggleListStatus',adminAuth, categoryController.toggleListStatus);
router.delete('/deleteCategoryOffer', adminAuth, categoryController.deleteCategoryOffer);
router.patch('/deleteCategory/:id', adminAuth, categoryController.softDeleteCategory);


//subcategory
router.get('/subcategory', adminAuth, subcategoryController.getSubcategory);
router.get('/addSubcategory', adminAuth, subcategoryController.getAddSubcategoryPage);
router.post('/addSubcategory', adminAuth, uploadSubcategoryImages.single('subcategoryImage'), subcategoryController.addSubcategory);
router.get('/editSubcategory/:id', adminAuth, subcategoryController.getEditSubcategoryPage);
router.post('/editSubcategory/:id', adminAuth, uploadSubcategoryImages.single('subcategoryImage'), subcategoryController.editSubcategory);
router.patch('/subcategory/toggleList/:id', adminAuth, subcategoryController.toggleListStatus);
router.post('/subcategory/offer/:id', adminAuth, subcategoryController.editOffer);
router.patch('/subcategory/delete/:id', adminAuth, subcategoryController.softDeleteSubcategory);

//produc



router.get("/adminProducts", adminAuth, productController.getProducts);
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploadProductImages.array("images", 4),productController.addProducts);
router.get("/updateProduct/:id",adminAuth, productController.getUpdateProductPage);
router.patch("/updateProduct/:id",adminAuth,uploadProductImages.array("images", 4),productController.updateProduct);

// router.patch("/product/toggleList/:id",adminAuth,productController.toggleListStatus)
router.patch("/product/toggleList/:id", adminAuth,productController.toggleListStatus)
router.delete('/deleteProduct/:id', adminAuth, productController.softDeleteProduct);

router.post('/product/:id/offer', adminAuth, productController.addOffer);
router.patch('/product/:productId/offer', adminAuth, productController.editOffer);
router.delete('/product/:productId/offer', adminAuth, productController.deleteOffer);




















router.get('/pageerror',(req, res) => res.render('admin/pageerror', { error: req.query.error || 'An unexpected error occurred' }))

module.exports =router