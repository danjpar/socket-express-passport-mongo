var socket_io = require('socket.io');
var io = socket_io();
var socketApi = {};
var cookieParser = require('cookie-parser');
var mongoose = require('mongoose');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var passportSocketIo = require('passport.socketio');
var sessionStore = new MongoStore({ mongooseConnection: mongoose.connection });

var User = require('./models/account').Account;

socketApi.io = io;

io.use(passportSocketIo.authorize({
    cookieParser: cookieParser,       // the same middleware you registrer in express
    key: 'connect.sid',       // the name of the cookie where express/connect stores its session_id
    secret: 'B6 Rack Team Solutions',    // the session_secret to parse the cookie
    store: sessionStore
}));

io.on('connection', function(socket){
    var reqUrl = socket.handshake.headers.referer.split('/view?id=');

    if (reqUrl.length > 1) {
        socket.join(reqUrl[1]);
    }
    if (socket.request.user.email == 'danielparkhurst@supermicro.com') {
        socket.on('msg', function(data) {
            socket.broadcast.emit('msg', data);
        });
    }
    socket.on('fetch', function(data) {
        if (data == 'Managers') {
            if (socket.request.user.role.admin) {
                User.find( { 'role.admin': true } )
                .select('name email')
                .lean()
                .exec(function(err, docs) {
                    if (docs) {
                        socket.emit('Managers', docs);
                    }
                });
            }
        } else if (data == 'SuperManagers') {
            if (socket.request.user.role.super) {
                User.find( { 'role.super': true } )
                .select('name email')
                .lean()
                .exec(function(err, docs) {
                    if (docs) {
                        socket.emit('Managers', docs);
                    }
                });
            }
        }
    });
});

module.exports = socketApi;