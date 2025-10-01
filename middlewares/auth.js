const User=require(("../models/userSchema"))

const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user._id)  
      .then(data => {
        if (data && !data.isBlocked) {
          next();
        } else {
          res.redirect("/login");
        }
      })
      .catch(error => {
        console.log("Error in user middleware", error);
        res.status(500).send("Internal server error");
      });
  } else {
    res.redirect("/login");
  }
};



const adminAuth = (req, res, next) => {
    if (req.session.admin) {
        User.findById(req.session.admin)
            .then(data => {
                if (data && data.role === "admin") {
                    next();
                } else {
                   
                    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                        return res.status(401).json({ error_msg: "Not authenticated", redirectUrl: "/admin/login" });
                    }
                    res.redirect("/admin/login");
                }
            })
            .catch(error => {
                console.log("Error in admin auth middleware", error);
                
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(500).json({ error_msg: "Internal server error" });
                }
                res.status(500).send("Internal server error");
            });
    } else {
        
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error_msg: "Not authenticated", redirectUrl: "/admin/login" });
        }
        res.redirect("/admin/login");
    }
};

module.exports = {
    userAuth,
    adminAuth
};

