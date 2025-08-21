
const express=require('express')
const session=require('express-session')
const MongoStore = require("connect-mongo")
const path=require('path')
const env=require("dotenv").config();
const connectDB=require("./config/db.js")
const userRouter=require("./routes/userRouter")
const adminRouter=require("./routes/adminRouter")
const passport=require('./config/passport')
const flash = require('connect-flash');
const methodOverride = require('method-override');

 



const app=express();


app.use(methodOverride('_method'));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 3 * 24 * 60 * 60
    }),
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use((req,res,next)=>{
   res.set('cache-control','no-store')
   next()
})
app.use(flash());


app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname,"public")))



app.get('/', (req, res) => {
  const user = req.session.user || null; 
  res.render('home', { user });
});



app.use("/user",userRouter)
app.use("/admin",adminRouter)




app.listen(process.env.PORT || 7711, () => {
  console.log("Server listening on port", process.env.PORT || 7711);
});


 connectDB()
 .then(()=>{
    console.log("connection to database established");
   
 })
 .catch((err)=>{
    console.log("there is an error in connecting data base")
 })


   