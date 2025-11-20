const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      default: () => uuidv4(),
      unique: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    orderedItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true
        },

        productName: {
          type: String,
          required: true
        },

        size: {
          type: String,
          required: true
        },

        color: {
          type: String,
          required: true
        },

        quantity: {
          type: Number,
          required: true
        },

        price: {
          type: Number,
          required: true
        },

        salePrice: {
          type: Number,   
          required: true
        },

        finalPrice: {
          type: Number,  
          required: true
        },

        status: {
          type: String,
          enum: [
            "pending",
            "confirmed",
            "shipped",
            "out_for_delivery",
            "delivered",
            "cancelled",
            "return_requested",
            "returned",
            "failed"
          ],
          default: "pending"
        },

        cancellationReason: {
          type: String,
          default: ""
        },

        returnReason: {
          type: String,
          default: ""
        },

        deliveredOn: {
          type: Date
        }
      }
    ],

    subTotal: {
      type: Number,     
      required: true
    },

    discountAmount: {
      type: Number,     
      default: 0
    },

    deliveryCharge: {
      type: Number,
      default: 0
    },

    payableAmount: {
      type: Number,     
      required: true
    },

    address: {
      type: String,     // saved as snapshot string
      required: true
    },

    appliedCoupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "wallet", "razorpay"],
      default: "cod"
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending"
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "return_requested",
        "returned",
        "failed"
      ],
      default: "pending"
    },

    invoiceDate: {
      type: Date,
      default: Date.now
    },

    createdOn: {
      type: Date,
      default: Date.now,
      required: true
    },

    updatedOn: {
      type: Date
    },

    deliveredOn: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
