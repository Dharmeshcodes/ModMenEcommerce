const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const env = require('dotenv').config();
const connectDB = require('./config/db.js');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const passport = require('./config/passport');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const { apiLogger, errorLogger } = require('./config/logger');


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    return req.body._method;
  }
  if (req.query && '_method' in req.query) {
    return req.query._method;
  }
}));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
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

app.use((req, res, next) => {
  res.set('cache-control', 'no-store');
  next();
});

app.use(flash());
app.use((req, res, next) => {
  res.locals.error_msg = req.flash('error_msg');
  res.locals.success_msg = req.flash('success_msg');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  apiLogger.info('Request: %s %s - Body: %o', req.method, req.url, req.body);
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/user', userRouter);
app.use('/admin', adminRouter);

app.use((err, req, res, next) => {
  errorLogger.error(`${err.stack} - Request: ${req.method} from ${req.originalUrl}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    }
  });
});



connectDB()
  .then(() => {
    apiLogger.info('Connection to database established');
    app.listen(process.env.PORT || 7711, () => {
      apiLogger.info('Server listening on port %s', process.env.PORT || 7711);
    });
  })
  .catch((err) => {
    errorLogger.error('There is an error connecting to the database: %o', err);
  });
