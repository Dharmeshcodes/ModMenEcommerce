const Product=require("../../models/productSchema")
const Category=require("../../models/categorySchema")
const subCategory=require('../../models/subcategorySchema')
const User = require("../../models/userSchema");


const productDetails = async (req, res) => {
  try {

    
      const user= req.session.user || null
        let userDetails = null;
        if (user) {
          userDetails = await User.findById(user._id).lean();
        }
    

    const id = req.params.id;
    const product = await Product.findOne({
  _id: id,
  isDeleted: false,
  isListed: true
}).lean();
if(!product)
     return res.redirect('/user/sale')



    const variant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
    

  
    alsoLikeProducts = await Product.find({
  categoryId: product.categoryId,
  _id: { $ne: id },
  isDeleted: false,
  isListed: true
}).limit(4).lean();
//console.log("also like product",alsoLikeProducts)


    // dummy  change after 8 th week  or 9th week

    const dummyReviews = [
      {
        author: 'Samantha B.',
        rating: 5,
        content: 'Absolutely love it! This keeps me snug in cold weather. And the shade is really nice.',
        date: 'August 23, 2025',
      },
      {
        author: 'Alex M.',
        rating: 4,
        content: 'Nice shirt but runs a bit small for me.',
        date: 'August 21, 2025',
      },
      {
        author: 'Dillon K.',
        rating: 5,
        content: 'Perfect fit, great for work or the weekend!',
        date: 'August 18, 2025',
      },
      {
        author: 'Olivia W.',
        rating: 4,
        content: 'Good fabric and colour, but sleeves slightly long.',
        date: 'August 6, 2025',
      },
      {
        author: 'Liam N.',
        rating: 5,
        content: 'Excellent quality. The price was worth it.',
        date: 'August 3, 2025',
      },
      {
        author: 'Ana S.',
        rating: 4,
        content: 'Lovely shirt for work meetings. Recommended!',
        date: 'August 2, 2025',
      }
    ];
    
    res.render("user/product-detail", {
      product,
      alsoLikeProducts,
      dummyReviews,
      user:userDetails,
      variant
    });

  } catch (error) {
    console.error("Error in product detail page:", error);
    res.status(500).send("there is an error in product detail page");
  }
}

module.exports = {
  productDetails
};