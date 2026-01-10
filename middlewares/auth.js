const User=require(('../models/userSchema'));



const userAuth = (req, res, next) => {
  console.log("user auth middleware hit");

  const isAjax =
    req.xhr || req.headers.accept?.includes('json');

  if (!req.session.user) {
    if (isAjax) {
      return res.status(401).json({
        success: false,
        redirect: '/user/login'
      });
    }
    return res.redirect('/user/login');
  }

  User.findById(req.session.user._id)
    .then(user => {
      if (user && !user.isBlocked) {
        return next();
      }

      if (isAjax) {
        return res.status(401).json({
          success: false,
          redirect: '/user/login'
        });
      }

      return res.redirect('/user/login');
    })
    .catch(error => {
      console.log('Error in user middleware', error);

      if (isAjax) {
        return res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }

      return res.status(500).send('Internal server error');
    });
};


const adminAuth = (req, res, next) => {
    if (req.session.admin) {
        User.findById(req.session.admin)
            .then(data => {
                if (data && data.role === 'admin') {
                    next();
                } else {
                   
                    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                        return res.status(401).json({ error_msg: 'Not authenticated', redirectUrl: '/admin/login' });
                    }
                    res.redirect('/admin/login');
                }
            })
            .catch(error => {
                console.log('Error in admin auth middleware', error);
                
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(500).json({ error_msg: 'Internal server error' });
                }
                res.status(500).send('Internal server error');
            });
    } else {
        
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error_msg: 'Not authenticated', redirectUrl: '/admin/login' });
        }
        res.redirect('/admin/login');
    }
};

module.exports = {
    userAuth,
    adminAuth
};
