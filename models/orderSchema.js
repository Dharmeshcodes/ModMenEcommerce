const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const orderSchema = new mongoose.Schema(
  {
    // orderId: {
    //   // type: String,
    //   // default: () => uuidv4(),
    //   // unique: true
    // },
    orderId: {
      type: String,
      default: () =>
        "MM" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000),
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
        category: { 
          type: String 
        },
        subCategory: {
           type: String 
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
        cancelledOn:{
          type :Number
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
      type: String,    
      required: true
    },

   appliedCoupon: {
      type: String,
      default: null
    },
    couponDiscount: {
      type: Number,
      default: 0
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "wallet", "razorpay"],
      default: "cod"
    },
    paymentSessionId: {
      type: String,
      default: null
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "failed",
        "completed",
        "captured_but_failed",
        "refunded"
      ],
      default: "pending"
    },
    razorpayOrderId: {
      type: String,
      default: null
    },
    razorpayPaymentId: {
      type: String,
      default: null
    },
    razorpaySignature: {
      type: String,
      default: null
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
    cancelledOn:{
      type:Date
    },
    cancellationReason: {
          type: String,
          default: ""
        },

    deliveredOn: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
