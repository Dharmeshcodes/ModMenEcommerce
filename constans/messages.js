const MESSAGES = {
  COMMON: {
    SOMETHING_WENT_WRONG: "Something went wrong",
    INVALID_REQUEST: "Invalid request",
    UNAUTHORIZED: "Unauthorized access",
    NOT_FOUND: "Resource not found"
  },

  AUTH: {
    LOGIN_REQUIRED: "Login required",
    INVALID_CREDENTIALS: "Invalid email or password",
    LOGOUT_SUCCESS: "Logged out successfully"
  },

  ADDRESS: {
    ADD_SUCCESS: "Address added successfully",
    UPDATE_SUCCESS: "Address updated successfully",
    DELETE_SUCCESS: "Address removed successfully",
    VALIDATION_FAILED: "Please fill all required address fields"
  },

  ORDER: {
    NOT_FOUND: "Order not found",
    CANCELLED: "Order cancelled successfully",
    CANNOT_CANCEL: "Order cannot be cancelled at this stage"
  },

  COUPON: {
    INVALID: "Invalid coupon code",
    EXPIRED: "Coupon has expired",
    MIN_PURCHASE: "Minimum purchase amount not met"
  },

  WALLET: {
    INSUFFICIENT_BALANCE: "Insufficient wallet balance",
    CREDIT_SUCCESS: "Amount credited to wallet"
  }
};

module.exports = MESSAGES;
