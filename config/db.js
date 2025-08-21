
const mongoose=require('mongoose');
 
 const connectDB=async()=>{
    await mongoose.connect("mongodb+srv://DharmeshThankan:3mRZRTtdwUmHITzh@modmen.ub3oq2c.mongodb.net/ModMen");
 };

 module.exports=connectDB;
