
const User = require('../../models/userSchema');
const mongoose = require('mongoose');


const customerInfo = async (req, res) => {
  try {
    // Extract query parameters
    let { search, page, status } = req.query;
    search = search ? search.trim() : '';
    page = parseInt(page) || 1;
    const perPage = 6; // Renamed from limit to match EJS

    // Validate page number
    if (page < 1) page = 1;
    // Build query object
    let query = { role: 'user' };

    // Add search filter
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Add status filter
    if (status === 'active') {
      query.isBlocked = false;
    } else if (status === 'blocked') {
      query.isBlocked = true;
    }

    // Fetch users
    const userData = await User.find(query)
      .sort({ createdDate: -1 })
      .limit(perPage)
      .skip((page - 1) * perPage)
      .exec();

    const totalCustomers = await User.countDocuments(query); // Renamed from count to match EJS
    const totalPages = Math.ceil(totalCustomers / perPage);

    // Ensure page doesn't exceed totalPages
    if (page > totalPages && totalPages > 0) {
      page = totalPages;
    }

    res.render('admin/customers', {
      data: userData,
      totalPages,
      currentPage: page,
      search,
      status: status || '',
      totalCustomers, // Pass totalCustomers instead of count
      perPage, // Pass perPage explicitly
    });
  } catch (error) {
    console.error('Error in customerInfo:', error);
    res.redirect('/admin/pageerror');
  }
};
const customerDetails= async (req,res)=>{
  const customerId=req.params.id
  
  const customer= await User.findById(customerId)
  console.log("customer is :",customer)


  res.render("admin/customerDetails",{customer})
}


const customerBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.status(200).json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error blocking user' });
  }
};

const customerunBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.status(200).json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error unblocking user' });
  }
};

module.exports = {
  customerInfo,
  customerBlocked,
  customerunBlocked,
  customerDetails
};
