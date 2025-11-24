const multer=require('multer');
const{CloudinaryStorage}=require('multer-storage-cloudinary');
const{cloudinary}=require('../config/cloudinary');
const getCloudinaryStorage=(folderName)=>new CloudinaryStorage({
    cloudinary:cloudinary,
    params:{
        folder:`MODMAN/${folderName}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
         transformation: [{ width: 800, height: 800, crop: 'limit' }],
  },
    
});
const uploadProductImages=multer({storage:getCloudinaryStorage('Products')});
const uploadUserImages=multer({storage:getCloudinaryStorage('User')});
const uploadCategoryImages=multer({storage:getCloudinaryStorage('Category')});
const uploadAdminImages=multer({storage:getCloudinaryStorage('Admins')});
const uploadSubcategoryImages=multer({storage:getCloudinaryStorage('subcategory')});

module.exports = {
  uploadProductImages,
  uploadCategoryImages,
  uploadUserImages,
  uploadAdminImages,
  uploadSubcategoryImages
};