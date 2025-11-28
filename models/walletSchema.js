const mongoose = require('mongoose');
const Schema=mongoose


const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["credit", "debit"],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        default: ""
    },
    method: {
        type: String,
        enum: ["razorpay", "order_refund", "order_cancel", "wallet_payment", "admin"],
        default: "admin"
    },
    orderId: {
        type: String,
        default: null
    },
    transactionId: {
    type: String,
    default: null
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        unique: true,
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [transactionSchema]
}, { timestamps: true });

module.exports = mongoose.model("Wallet", walletSchema);
