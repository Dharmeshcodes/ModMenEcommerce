const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const Razorpay = require("razorpay");
const { addMoneyToWallet } = require("../../utils/walletUtils")

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const search = (req.query.search || "").trim();
    const filterType = req.query.type || "all";

    const user=await User.findById(userId)

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.session.user._id,
        balance: 0,
        transactions: []
      });
    }

    let transactions = wallet.transactions || [];

    if (filterType !== "all") {
      transactions = transactions.filter(t => t.type === filterType);
    }

    if (search) {
      const s = search.toLowerCase();
      transactions = transactions.filter(t =>
        (t.transactionId || "").toLowerCase().includes(s) ||
        (t.description || "").toLowerCase().includes(s)
      );
    }

    transactions = transactions.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    const perPage = 10;
    const total = transactions.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const start = (page - 1) * perPage;
    const end = start + perPage;

    const paginated = transactions.slice(start, end);

    wallet = wallet.toObject();
    wallet.transactions = paginated;

    return res.render("user/wallet", {
      user,
      wallet,
      currentPage: page,
      totalPages,
      search,
      filterType,
      razorpayKey: process.env.RAZORPAY_KEY_ID

    });

  } catch (error) {
    console.log("Wallet load error:", error);
    return res.redirect("/500");
  }
};

const createWalletOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        const order = await razorpayInstance.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: "wallet_" + Date.now()
        });

        return res.json({
            success: true,
            orderId: order.id,
            amount: order.amount
        });

    } catch (error) {
        console.log("Wallet order error:", error);
        return res.json({ success: false, message: "Failed to create order" });
    }
};

const verifyWalletPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, amount } = req.body;
    const userId = req.session.user._id;

    await addMoneyToWallet(userId, amount, {
      description: "Wallet Recharge",
      method: "razorpay",
      transactionId: razorpay_payment_id
    });

    return res.json({ success: true });

  } catch (error) {
    console.log("Verify wallet payment error:", error);
    return res.json({ success: false, message: "Payment verification failed" });
  }
};


module.exports = {
    getWalletPage,
    createWalletOrder,
    verifyWalletPayment
};
