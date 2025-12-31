// const redisClient = require("../config/redis");

// const reserveStock = async (cartItems) => {
//   for (let item of cartItems) {
//     const key = `stock_lock:${item.productId}:${item.size}:${item.color}`;

//     const existingLock = await redisClient.get(key);

//     if (existingLock) {
//       throw new Error("Stock temporarily unavailable");
//     }

//     await redisClient.setEx(
//       key,
//       900, 
//       item.quantity.toString()
//     );
//   }
// };

// const releaseStock = async (cartItems) => {
//   for (let item of cartItems) {
//     const key = `stock_lock:${item.productId}:${item.size}:${item.color}`;
//     await redisClient.del(key);
//   }
// };

// module.exports = {
//   reserveStock,
//   releaseStock
// };
