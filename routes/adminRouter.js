const express=require('express');
const router=express.Router()
const customerController=require('../controllers/admin/customerController')
const adminController=require('../controllers/admin/adminController')
const categoryController=require('../controllers/admin/categoryController')
const subcategoryController=require('../controllers/admin/subcategoryController')
//const categoryUpload = require('../config/multer');
const productController=require('../controllers/admin/productController')
const {
  uploadProductImages,
  uploadCategoryImages,
  uploadUserImages,
   uploadSubcategoryImages,
} = require('../middlewares/cloudinaryUploads');

const {userAuth, adminAuth} =require("../middlewares/auth")


//people

router.get("/login",adminController.loadAdminLogin)
router.post("/login",adminController.adminLogin)
router.get("/dashboard", adminAuth , adminController.loadAdminDashboard)
router.get("/logout",adminController.logout)
router.get("/customers",adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)

//categoy Admin
router.get("/category",adminAuth,categoryController.categoryInfo)
router.get("/addCategory", adminAuth,categoryController. getAddCategoryPage) 
router.get("/viewCategory/:id",adminAuth,categoryController.viewCategory)
router.get("/editCategory/:id", adminAuth, categoryController.loadEditCategory);
router.patch("/editCategory/:id",adminAuth, uploadCategoryImages.single("categoryImage"),categoryController.updateCategory);
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

//product

router.get("/addProducts", adminAuth, productController.getProductAddPage);

router.get("/adminProducts", adminAuth, productController.getProducts);

router.post(
  "/addProducts",adminAuth,uploadProductImages.array("images", 3),productController.addProducts);
router.get("/updateProduct/:id", productController.getUpdateProductPage);
router.post("/updateProduct/:id", productController.postUpdateProduct);







router.get('/pageerror',(req, res) => res.render('admin/pageerror', { error: req.query.error || 'An unexpected error occurred' }))

module.exports =router