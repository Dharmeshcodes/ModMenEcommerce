const Wallet = require("../models/walletSchema");

async function addMoneyToWallet(userId, amount, meta = {}) {
    if (amount <= 0) return;

    await Wallet.findOneAndUpdate(
        { userId },
        {
            $inc: { balance: amount },
            $push: {
                transactions: {
                    type: "credit",
                    amount,
                    description: meta.description || "Amount Added",
                    method: meta.method || "admin",
                    transactionId: meta.transactionId || null,
                    orderId: meta.orderId || null,
                    createdAt: new Date()
                }
            }
        },
        { upsert: true }
    );
}

async function deductMoneyFromWallet(userId, amount, meta = {}) {
    if (amount <= 0) return;

    await Wallet.findOneAndUpdate(
        { userId },
        {
            $inc: { balance: -amount },
            $push: {
                transactions: {
                    type: "debit",
                    amount,
                    description: meta.description || "Amount Deducted",
                    method: meta.method || "admin",
                    transactionId: meta.transactionId || null,
                    orderId: meta.orderId || null,
                    createdAt: new Date()
                }
            }
        }
    );
}


module.exports = {
    addMoneyToWallet,
    deductMoneyFromWallet
};
