function determineBestOffer(productOffer, categoryOffer, subcategoryOffer) {
  return Math.max(productOffer || 0, categoryOffer || 0, subcategoryOffer || 0); 
}

function calculateBestPrice(regularPrice, productOffer = 0, categoryOffer = 0, subcategoryOffer = 0) {
  const bestOffer = determineBestOffer(productOffer, categoryOffer, subcategoryOffer);
  const discount = (regularPrice * bestOffer) / 100;
  const salePrice = Math.round(regularPrice - discount);

  return {
    salePrice,
    bestOffer
  };
}

module.exports = {
  determineBestOffer,
  calculateBestPrice
};
