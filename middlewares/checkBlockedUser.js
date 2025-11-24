const User = require('../models/userSchema');

const checkBlockedUser = async (req, res, next) => {
  try {
    const userId = req.session?.user?._id;

    if (!userId) {
      return next();
    }

    const user = await User.findById(userId);

    if (!user || user.isBlocked) {
      delete req.session.user;
      
      req.session.save((saveError) => {
        if (saveError) {
          console.log('session save error');
        }
        return res.redirect('/user/login?blocked=true');
      });
      
      return;
    }
  
    next();
    
  } catch (err) {
    console.log('blocked customer error');
    res.status(500).send('Internal server error');
  }
};

module.exports = checkBlockedUser;