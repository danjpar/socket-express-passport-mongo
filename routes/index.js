var express = require('express');
var passport = require('passport');
var Model = require('../models/account');
var router = express.Router();
var sanitize = require('mongo-sanitize');
var crypto = require('crypto');
var nodemailer = require('nodemailer');

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	res.redirect('/login')
}

router.all('*', (req,res,next) => {
	if (req.path === '/' || req.path === '/login' || req.path === '/register' || req.path === '/reset' || req.path === '/forgot') {
		return next();
	} else {
		ensureAuthenticated(req,res,next);
	}
});

router.get('/', (req, res) => {
	if (req.user) {
		Model.Account.findOne( {_id: req.user._id } )
		.exec(function(err, user) {
			if (user) {
				res.render('home', { title: 'DIY Racks', user : user, error : req.flash('error'), message : req.flash('msg') });
			} else {
				req.flash('error', 'Something went wrong.');
				res.render('home', { title: 'DIY Racks', user : req.user, error : req.flash('error'), message : req.flash('msg') });
			}
		});
	} else {
		res.render('index', { title: 'DIY Racks', error : req.flash('error'), message : req.flash('msg') });
	}
});

router.get('/register', (req, res) => {
	if (req.isAuthenticated()) {
		return res.redirect('/');
	} else {
		res.render('register', { user: req.user, error : req.flash('error'), message : req.flash('msg') });
	}
});

router.post('/register', (req, res, next) => {
	if (!/^[0-9a-zA-Z\-_]+$/.test(req.body.username)) {
		req.flash('error', 'Only alphanumeric, "-", and "_" characters allowed.');
		return res.redirect('/register');
	} else if (!/^[0-9a-zA-Z'. \-]+$/.test(req.body.name)) {
		req.flash('error', 'Only alphanumeric, spaces, ".", and "-" characters allowed.');
		return res.redirect('/register');
	}
	req.body = sanitize(req.body);
    req.body.email = req.body.email.toLowerCase();
	Model.People.findOne({email : req.body.email}, function (err, person) {
		if (person){
			Model.Account.findOne()
			.or([{ email : req.body.email }, { username: req.body.username }])
			.exec(function(err, doc) {
				if (doc) {
					if (doc.username == req.body.username) {
						return res.render('register', { info: req.body, error: 'Username is taken.' });
					} else if (doc.email == req.body.email) {
						req.flash('error', 'Email is already registered. Please login.');
						res.redirect('/login');
					}
				} else {
					var userInfo = new Model.Account({
						registered: Date.now(),
						username : req.body.username,
						email : req.body.email,
						name : req.body.name,
						role: person.role,
						manager: person.manager
					});
					if (req.body.password1 !== req.body.password2) {
						return res.render('register', { info: userInfo, error : 'Passwords do not match' });   
					} else if (req.body.password1.length < 8 || req.body.password1.length > 12) {
						return res.render('register', { info: userInfo, error : 'Password must be 8 to 12 characters'});
					}
					Model.Account.register(userInfo, req.body.password1, (err, account) => {
						if (err) {
							return res.render('register', { info: userInfo, error : err.message });
						} else {
							req.flash('msg', 'Registered!');
							res.redirect('/login');
						}
					});
				}
			});
		} else {
			res.render('register', { error : 'You are not authorized to register' });
		}
	});
});

router.get('/login', (req, res) => {
	if (req.isAuthenticated()) {
		return res.redirect('/');
	}
	res.render('login',  {user: req.user, error : req.flash('error'), message : req.flash('msg')});
});

router.post('/login', passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }), (req, res, next) => {
		req.session.save((err) => {
			if (err) {
					return next(err);
			} else {
				res.redirect('/');
			}
		});
});

router.get('/logout', (req, res, next) => {
		req.logout();
		req.session.save((err) => {
				if (err) {
						return next(err);
				}
				res.redirect('/');
		});
});

router.get('/forgot', (req, res) => {
	if (req.isAuthenticated()) {
		return res.redirect('/');
	}
	if (!req.query.id && !req.query.auth) {
		return res.render('password', { error : req.flash('error'), message : req.flash('msg')})
	} else {
		return res.render('password', { userId:req.query.id, auth:req.query.auth, error : req.flash('error'), message : req.flash('msg')})
	}
});

router.post('/forgot', (req, res) => {
	if (!req.body.email) {
		req.flash('error', 'Please enter email address.');
		return res.redirect('/forgot');
	} else {
		req.body = sanitize(req.body);
		req.body.email = req.body.email.toLowerCase();
		Model.Account.findOne({email: req.body.email})
		.exec(function(err, user) {
			if (!user) {
				req.flash('error', 'Please enter valid email address.');
				return res.redirect('/forgot');
			} else {
				user.resetToken = crypto.randomBytes(20).toString('hex');
				user.resetExpiry = Date.now() + 3600000;
				user.save();
				var transporter = nodemailer.createTransport({
					sendmail: true,
					args: ['-F', 'Rack Team App', '-f', ''] },
					{ to: user.email,
					subject: 'Password reset requested for '+user.name,
				});
				var textMsg = 'Hello '+user.name+'!\n\n'+
				'Thank you for using our DIY Rack Builder.\n\n\n\n'+
				'Please use the following url to change your password:\n\n'+
				'http://'+req.headers.host+'/forgot?id='+user._id+'&auth='+user.resetToken;
				transporter.sendMail({text: textMsg}, function (error, info) {
					if (error) {
						req.flash('error', 'Something went wrong. Please try again later.');
						return res.redirect('/');
					} else {
						req.flash('msg', 'Reset link sent!');
						return res.redirect('/');
					}
				});
			}
		});
	}
});

router.post('/reset', (req, res) => {
	if (!req.query.id && !req.query.auth) {
		return res.redirect('/forgot');
	}
	if (req.body.password1 !== req.body.password2) {
		req.flash('error', 'Passwords do not match');
		return res.redirect('/forgot?id='+req.query.id+'&auth='+req.query.auth);
	} else if (req.body.password1.length < 8 || req.body.password1.length > 12) {
		req.flash('error', 'Password must be 8 to 12 characters');
		return res.redirect('/forgot?id='+req.query.id+'&auth='+req.query.auth);
	}
	Model.Account.findOne({_id: req.query.id, resetToken: req.query.auth})
	.exec(function(err, user){
		if (!user) {
			req.flash('error', 'Something went wrong. Try again later.');
			return res.redirect('/login');
		} else if (user.resetExpiry < Date.now()) {
			req.flash('error', 'Password reset authorization has expired. Please try again.');
			return res.redirect('/login');
		}
		user.setPassword(req.body.password1, function(err) {
			if (!err) {
				user.save();
				req.flash('msg', 'Password Changed!');
			} else {
				req.flash('err', 'Something went wrong. Try again later.')
			}
			return res.redirect('/login');
		});
	});
});

router.get('/invite', (req, res) => {
    var superMaster = false;
    if (req.user.email == 'danielparkhurst@supermicro.com') {
        superMaster = true;
    }
    if (req.user.role.admin) {
        res.render('users/new', { user: req.user, SuperMaster: superMaster, error : req.flash('error'), message : req.flash('msg') });
    } else {
        req.flash('error', 'You are not authorized to invite users.');
        return res.redirect('/users/list');
    }
});

router.post('/invite', (req, res) => {
    var newRole = {};
    if (req.body.role == 3 && req.user.email != 'danielparkhurst@supermicro.com') {
        return res.render('users/new', { user: req.user, info: req.body, error : 'You are not authorized to add Gatekeepers.'});
    } else if (req.body.role > 1 && !req.user.role.super) {
        return res.render('users/new', { user: req.user, info: req.body, error : 'You are not authorized to add SuperManagers.'});
    } else {
        var newRole = {admin:false, super:false, master:false};
        if (req.body.role >= 1) {
            newRole.admin = true;
        }
        if (req.body.role >= 2) {
            newRole.super = true;
        }
        if (req.body.role >= 3) {
            newRole.master = true;
        }
    }
    req.body = sanitize(req.body);
    req.body.email = req.body.email.toLowerCase();
    if (req.user.role.admin) {
        Model.People.findOne({email : req.body.email})
        .exec(function(err, user) {
            if (!err) {
                function savePerson() {
                    var personInfo = new Model.People({
                        email: req.body.email,
                        invitor: req.user.id,
                        role: newRole
                    });
                    if (req.body.manager) {
                        Model.Account.findOne({_id:req.body.manager})
                        .lean()
                        .exec(function(err, doc) {
                            if (!doc) {
                                personInfo.manager = undefined;
                            } else {
                                personInfo.manager = req.body.manager;
                            }
                            personInfo.save(function(err, person) {
                                if (person) {
                                    req.flash('msg', 'New User Invited!');
                                    return res.redirect('/users/list');
                                } else {
                                    req.flash('msg', 'Something went wrong. Try again later.');
                                    return res.redirect('/users/list');
                                }
                            });
                        });
                    } else {
                        personInfo.save(function(err, person) {
                            if (person) {
                                req.flash('msg', 'New User Invited!');
                                return res.redirect('/users/list');
                            } else {
                                req.flash('msg', 'Something went wrong. Try again later.');
                                return res.redirect('/users/list');
                            }
                        });
                    }
                };
                if (!req.body.silent) {
                    var transporter = nodemailer.createTransport({
                        sendmail: true,
                        args: ['-F', 'Rack Team App', '-f', ''] },
                        { to: req.body.email,
                        subject: 'You have been invited to register',
                    });
                    var textMsg = 'Hello!\n\n'+
                        'You have been invited by '+req.user.name+' to use our app:\n\n'+
						'Please use the following url to register:\n\n'+
                        'http://'+req.headers.host+'/register';
                    transporter.sendMail({text: textMsg}, function (error, info) {
                        if (error) {
                            req.flash('error', 'Did you enter a valid email address?');
                            return res.redirect('/invite');
                        } else {
                            if (!user) {
                                savePerson();
                            } else {
                                req.flash('msg', 'Saved.');
                                return res.redirect('/users/list');
                            }
                        }
                    });
                } else {
                    if (!user) {
                        savePerson();
                    } else {
                        req.flash('msg', 'Saved.');
                        return res.redirect('/users/list');
                    }
                }
            } else {
                req.flash('error', 'Something went wrong. Try again later.');
                return res.redirect('/users/list');
            }
        })
    } else {
        req.flash('error', 'You are not authorized to add users.');
        return res.redirect('/users/list');
    }
});

router.get('/checkingStuff', (req, res, next) => {
	console.log(req.headers.host);
	res.redirect('/');
});

module.exports = router;