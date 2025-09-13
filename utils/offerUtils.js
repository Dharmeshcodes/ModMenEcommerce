function determineBestOffer(productOffer, categoryOffer, subcategoryOffer) {
  return Math.max(productOffer || 0, categoryOffer || 0, subcategoryOffer || 0); 
}

function calculateBestPrice(regularPrice, productOffer = 0, categoryOffer = 0, subcategoryOffer = 0) {
  const bestOffer = determineBestOffer(productOffer, categoryOffer, subcategoryOffer);
  const discount = (regularPrice * bestOffer) / 100;
  const salePrice = Math.max(Math.round(regularPrice - discount), 0); 
  
  return {
    salePrice,
    bestOffer,
  };
}

module.exports = {
  calculateBestPrice,
  determineBestOffer
}