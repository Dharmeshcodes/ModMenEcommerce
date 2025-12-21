
const User = require('../../models/userSchema');
const HTTP_STATUS = require("../../constans/httpStatus");
const MESSAGES = require("../../constans/messages");
const { apiLogger, errorLogger } = require("../../config/logger");
const Order=require("../../models/orderSchema")
const Wallet=require("../../models/walletSchema")

const customerInfo = async (req, res) => {
  try {
    let { search, page, status } = req.query;
    search = search ? search.trim() : '';
    page = parseInt(page) || 1;
    const perPage = 6; 

    if (page < 1) page = 1;

    let query = { role: 'user' };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (status === 'active') {
      query.isBlocked = false;
    } else if (status === 'blocked') {
      query.isBlocked = true;
    }
    const userData = await User.find(query)
      .sort({ createdDate: -1 })
      .limit(perPage)
      .skip((page - 1) * perPage)
      .exec();

    const totalCustomers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalCustomers / perPage);
  
    if (page > totalPages && totalPages > 0) {
      page = totalPages;
    }

    res.render('admin/customers', {
      data: userData,
      totalPages,
      currentPage: page,
      search,
      status: status || '',
      totalCustomers, 
      perPage, 
    });
  } catch (error) {
    console.error('Error in customerInfo:', error);
    res.redirect('/admin/pageerror');
  }
};

const customerDetails = async (req, res) => {
  try {
    const userId = req.params.id;

    const customer = await User.findById(userId).lean();
    if (!customer) {
      return res.redirect('/admin/customers');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'all';

    const orderQuery = { userId };

    if (status !== 'all') {
      orderQuery.status = status;
    }

    const totalTransactions = await Order.countDocuments(orderQuery);

    const orders = await Order.find(orderQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    orders.forEach(order => {
      const items = order.orderedItems || [];
      order.firstProductName = items[0]?.productName || 'N/A';
      order.extraProductsCount = items.length > 1 ? items.length - 1 : 0;
    });

    const totalOrders = await Order.countDocuments({ userId });

    const wallet = await Wallet.findOne({ userId }).lean();
    const walletBalance = wallet ? wallet.balance : 0;

    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('admin/customerDetails', {
      customer,
      orders,
      totalOrders,
      walletBalance,
      currentPage: page,
      totalPages,
      totalTransactions,
      status
    });

  } catch (error) {
    errorLogger.error('Error loading customer details', { error });
    res.redirect('/admin/customers');
  }
};


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
