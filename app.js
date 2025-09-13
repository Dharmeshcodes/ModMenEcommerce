  const express = require('express');
  const session = require('express-session');
  const MongoStore = require("connect-mongo");
  const path = require('path');
  const env = require("dotenv").config();
  const connectDB = require("./config/db.js");
  const userRouter = require("./routes/userRouter");
  const adminRouter = require("./routes/adminRouter");
  const passport = require('./config/passport');
  const flash = require('connect-flash');
  const methodOverride = require('method-override');

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Correct method-override usage (no backslash)
  app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    return req.body._method;   // hidden input
  }
  if (req.query && '_method' in req.query) {
    return req.query._method;  // query string
  }
}));


  // Body parsers


  // Session configuration with Mongo store
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

  // Passport initialization
  app.use(passport.initialize());
  app.use(passport.session());

  // Disable cache
  app.use((req, res, next) => {
    res.set('cache-control', 'no-store');
    next();
  });

  // Flash messages middleware
  app.use(flash());
  app.use((req, res, next) => {
    res.locals.error_msg = req.flash('error_msg');
    res.locals.success_msg = req.flash('success_msg');
    next();
  });

  // Static assets folder
  app.use(express.static(path.join(__dirname, "public")));

  // Global request logger middleware
  app.use((req, res, next) => {
    console.log('Request:', req.method, req.url, req.body);
    next();
  });

  // View engine setup
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  // Routes
  app.use("/user", userRouter);
  app.use("/admin", adminRouter);

  // Global error handler middleware - place after all routes
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
    
  });

//   app.use((req, res, next) => {
//   console.log(`Incoming request: ${req.method} ${req.originalUrl}`);
//   next();
// });

  // Root route example
  app.get('/', (req, res) => {
    const user = req.session.user || null; 
    res.render('home', { user });
  });

  // Connect to DB and start server
  connectDB()
    .then(() => {
      console.log("connection to database established");

      app.listen(process.env.PORT || 7711, () => {
        console.log("Server listening on port", process.env.PORT || 7711);
      });
    })
    .catch((err) => {
      console.error("there is an error in connecting database", err);
    });
