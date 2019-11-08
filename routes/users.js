var express = require('express');
var router = express.Router();
var Model = require('../models/account');
var sanitize = require('mongo-sanitize');

router.get('/', function(req, res, next) {
    res.redirect('/users/list');
});

router.get('/list', (req, res) => {
    Model.Account.find()
    .populate({path:'manager', select:'name'})
    .lean()
    .exec(function(err, docs) {
        if(docs) {
            return res.render('users/list', { user: req.user, users: docs, error : req.flash('error'), message : req.flash('msg')});
        } else {
            req.flash('error', 'Something went wrong. Try again later.')
            return res.render('users/list', { user: req.user, users: false, error : req.flash('error'), message : req.flash('msg')});
        }
    });
});

router.get('/invites', (req, res) => {
    Model.People.find()
    .populate({path:'invitor', select:'name'})
    .populate({path:'manager', select:'name'})
    .lean()
    .exec(function(err, docs) {
        if(docs) {
            return res.render('users/invites', { user: req.user, users: docs, error : req.flash('error'), message : req.flash('msg')});
        } else {
            req.flash('error', 'Something went wrong. Try again later.')
            return res.render('users/invites', { user: req.user, users: false, error : req.flash('error'), message : req.flash('msg')});
        }
    });
});

router.get('/view', (req, res) => {
//if (req.user.role.admin || req.query.id == req.user.id || req.query.id == req.user.manager) {
    if (!req.query.id || !/^[0-9a-zA-Z]+$/.test(req.query.id)) {
        req.flash('error', 'Select a user to view.');
        return res.redirect('/users/list');
    }
    var canEdit = false;
    var isMe = false;
    if (req.query.id == req.user.id) {
        canEdit = true;
        isMe = true;
    } else if (req.user.role.master) {
        canEdit = true;
    }
    Model.Account.findOne({_id: req.query.id})
    .populate({path:'manages', select:'name'})
    .populate({path:'manager', select:'name'})
    .exec(function (err, doc) {
        if (err) {
            req.flash('error', 'Something went wrong. Try again later.');
            return res.redirect('/users/list');
        }
        if (doc) {
            if (canEdit) {
                return res.render('users/edit', { user: req.user, userinfo: doc, isMe: isMe, error : req.flash('error'), message : req.flash('msg') });
            } else {
                return res.render('users/view', { user: req.user, userinfo: doc, isMe: isMe, error : req.flash('error'), message : req.flash('msg') });
            }
        } else {
            req.flash('error', 'User does not exist.');
            return res.redirect('/users/list');
        }
    });
});

router.post('/edit', (req, res) => {
    if (!/^[0-9a-zA-Z'. \-]+$/.test(req.body.name)) {
        req.flash('error', 'Name can only have alphanumeric, spaces, ".", and "-" characters.');
        return res.redirect('/users/view?id='+req.query.id);
    }
    if (req.body.manager && req.user.role.super) {
        if (req.body.manager == 'undefined') {
            Model.Account.findByIdAndUpdate(req.query.id, {manager : undefined}, {runValidators:true})
            .exec(function (err, doc) {
                if (err) {
                    req.flash('error', err.message);
                    return res.redirect('/users/view?id='+req.query.id);
                }
                if (doc) {
                    req.flash('msg', 'Saved!');
                    return res.redirect('/users/view?id='+req.query.id);
                }
            });
        } else if (req.body.manager == req.query.id) {
            req.flash('error', 'Users cannot manage themselves!');
            return res.redirect('/users/view?id='+req.query.id);
        } else {
            Model.Account.findOne({_id: req.body.manager})
            .exec(function(err, manager){
                if (manager) {
                    Model.Account.findByIdAndUpdate(req.query.id, {manager : manager._id}, {runValidators:true})
                    .exec(function (err, doc) {
                        if (err) {
                            req.flash('error', err.message);
                            return res.redirect('/users/view?id='+req.query.id);
                        }
                        if (doc) {
                            req.flash('msg', 'Saved!');
                            return res.redirect('/users/view?id='+req.query.id);
                        }
                    });
                } else {
                    req.flash('error', 'Manager does not exist.');
                    return res.redirect('/users/list');
                }
            });
        }
    } else if (req.user.role.super && req.body.role >= 0) {
        var newRole = {admin: false, super: false, master: false};
        if (req.body.role >= 1) {
            newRole.admin = true;
        }
        if (req.body.role >= 2) {
            newRole.super = true;
        }
        if (req.user.email == 'danielparkhurst@supermicro.com' && req.body.role == 3) {
            newRole.master = true;
        }
        Model.Account.findOne( { _id: req.query.id } )
        .exec(function (err, user) {
            if (err) {
                req.flash('error', err.message);
                return res.redirect('/users/view?id='+req.query.id);
            }
            if (user) {
                if (user.email != 'danielparkhurst@supermicro.com') {
                    user.role = newRole;
                    user.save(function(error) {
                        if (!error) {
                            req.flash('msg', 'Saved!');
                        } else {
                            req.flash('err', 'Something went wrong. Try again later.')
                        }
                        res.redirect('/users/view?id='+req.query.id);
                    });
                } else {
                    req.flash('error', 'Invalid operation');
                    res.redirect('/users/view?id='+req.query.id);
                }
            }
        });
    } else if (!req.user.role.master && req.query.id != req.user.id) {
        req.flash('error', 'You are not authorized to edit other user profiles.');
        return res.redirect('/users/view?id='+req.query.id);
    } else if (req.body.userinfo == 'Save') {
        req.body = sanitize(req.body);
        Model.Account.findOne( { _id: req.query.id } )
        .exec(function (err, user) {
            if (err) {
                req.flash('error', err.message);
                return res.redirect('/users/view?id='+req.query.id);
            }
            if (user) {
                user.name = req.body.name;
                user.phone1 = req.body.phone1;
                user.phone2 = req.body.phone2;
                user.location = req.body.location;
                user.save(function(error) {
                    if (!error) {
                        req.flash('msg', 'Saved!');
                    } else {
                        req.flash('err', 'Something went wrong. Try again later.')
                    }
                    res.redirect('/users/view?id='+req.query.id);
                });
            }
        });
    } else if (req.body.password == 'Save') {
        if (req.query.id != req.user.id) {
            req.flash('error', 'You are not authorized to change other user passwords.');
            return res.redirect('/users/view?id='+req.query.id);
        }
        if (req.body.password1 !== req.body.password2) {
            req.flash('error', 'Passwords do not match');
            return res.redirect('/users/view?id='+req.query.id);
        }
        if (req.body.password1.length < 8 || req.body.password1.length > 12) {
            req.flash('error', 'Password must be 8 to 12 characters');
            return res.redirect('/users/view?id='+req.query.id);
        }
        Model.Account.findOne({_id: req.query.id})
        .exec(function(err, user){
            if (!user) {
                req.flash('error', 'Something went wrong. Try again later.');
                return res.redirect('/users/view?id='+req.query.id);
            }
            user.setPassword(req.body.password1, function(err) {
                if (!err) {
                    user.save(function(error) {
                        if (!error) {
                            req.flash('msg', 'Password Changed!');
                        } else {
                            req.flash('err', 'Something went wrong. Try again later.')
                        }
                        res.redirect('/users/view?id='+req.query.id);
                    });
                } else {
                    req.flash('err', 'Something went wrong. Try again later.')
                }
                res.redirect('/users/view?id='+req.query.id);
            });
        });
    }
});

module.exports = router;