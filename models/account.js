var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var passportLocalMongoose = require('passport-local-mongoose');

var People = new Schema({
    email: { type: String,
        unique: true,
        required: true
    },
    invitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    role: { type: Object }
});

var Account = new Schema({
    registered: { type: Date, required: true },
    username: { type: String,
        unique : true,
        required: true,
        minlength: [5, 'Username too short. Use 5-10 characters'],
        maxlength: [16, 'Username too long. Use 5-10 characters']
    },
    email: { type: String,
        unique : true,
        required: true
    },
    name: { type: String,
        required: true,
        minlength: [5, 'Name is too short. Use 5-16 characters'],
        maxlength: [16, 'Name is too long. Use 5-16 characters']
    },
    phone1: String,
    phone2: String,
    role: Object,
    title: String,
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    location: String,
    resetToken: String,
    resetExpiry: Date
});

Account.plugin(passportLocalMongoose);

Account.virtual('manages',{
    ref: 'Account',
    localField: '_id',
    foreignField: 'manager'
});
Account.set('toObject', { virtuals: true });
Account.set('toJSON', { virtuals: true });

module.exports = {
    Account: mongoose.model('Account', Account),
    People: mongoose.model('People', People)
};