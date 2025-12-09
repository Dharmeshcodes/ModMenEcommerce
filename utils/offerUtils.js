function isOfferValid(offerObject, offerField) {
  if (!offerObject) return 0;

  const offerValue = offerObject[offerField] || 0;
  if (offerValue <= 0) return 0;

  if (!offerObject.startDate || !offerObject.validUntil) return 0;

  const today = new Date();
  const start = new Date(offerObject.startDate);
  const end = new Date(offerObject.validUntil);

  if (today < start || today > end) return 0;

  return offerValue;
}

function getSalePrice(variantPrice, categoryOffer, subcatOffer, productOffer) {
  const categoryVal = isOfferValid(categoryOffer, "offerPercentage");
  const subcatVal = isOfferValid(subcatOffer, "subcategoryOffer");
  const productVal = isOfferValid(productOffer, "productOffer");

  const bestOffer = Math.max(categoryVal, subcatVal, productVal, 0);

  let offerSource = null;
  if (bestOffer > 0) {
    if (productVal === bestOffer) offerSource = "product";
    else if (subcatVal === bestOffer) offerSource = "subcategory";
    else if (categoryVal === bestOffer) offerSource = "category";
  }

  const discount = (variantPrice * bestOffer) / 100;
  const salePrice = Math.max(Math.round(variantPrice - discount), 0);

  return { salePrice, bestOffer, offerSource };
}

module.exports = { getSalePrice };
