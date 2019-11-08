// dependencies
var express = require('express');
var path = require('path');
//var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var flash = require('connect-flash');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// mongoose
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.connect('mongodb://localhost:27017/rackapp');

var sessionStore = new MongoStore({
    mongooseConnection: mongoose.connection,
    ttl: 60*60*9
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
    secret: 'SMCI Rack Integrations',
    store: sessionStore,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(flash());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', routes);
app.use('/users', users);

// passport config
var Account = require('./models/account').Account;
passport.use(new LocalStrategy(Account.authenticate()));
passport.serializeUser(function(user, done){
    done(null, user.id);
});
passport.deserializeUser(function(id, done){
    Account.findOne({_id: id})
    .populate({path:'manages', select:'_id'})
    .select('username name email role')
    .exec(function(err, user){
        var managesArray = [];
        for (var index = 0; index < user.manages.length; index++) {
            managesArray.push(user.manages[index]._id);
        }
        user.manages = managesArray;
        done(err, user);
    });
});

// handlebars helpers
var hbs = require('hbs');
hbs.registerHelper('formatDate', function(dateString) {
    return dateString.toLocaleDateString('en-US', { timezone:'PST', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'});
});
hbs.registerHelper('toUpperCase', function(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
});
hbs.registerHelper('countAll', function(objs, prop) {
    var uniqueArray = [];
    for (var index = 0; index < objs.length; index++) {
        var obj = objs[index];
        if (obj[prop]) {
            if (uniqueArray.indexOf(obj[prop]) < 0) {
                uniqueArray.push(obj[prop]);
            }
        }
    }
    return uniqueArray.length;
});
hbs.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;