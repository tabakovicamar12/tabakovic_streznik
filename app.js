require('dotenv').config();
require('./database/db');
const fs = require('fs');
const webpush = require('web-push');
var createError = require('http-errors');
var express = require('express');
const cors = require('cors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:test@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

var app = express();
app.use(cors());
var apiPrefix = '/api/v1';

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/uploads', (req, res, next) => {
    if (path.extname(req.path).toLowerCase() === '.pdf') {
        return res.status(403).json({ napaka: 'PDF datoteke so dostopne samo prek preverjenega prenosa.' });
    }
    next();
}, express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var materialsRouter = require('./routes/materials');
var paymentsRouter = require('./routes/payments');
var cartPaymentsRouter = require('./routes/cartPayments');
var purchaseRouter = require('./routes/purchase');
var subjectRouter = require('./routes/subject');
var syncRouter = require('./routes/sync');
var reviewsRouter = require('./routes/reviews');
var moderationRouter = require('./routes/moderation');
var universityRouter = require('./routes/university');

app.use('/users', usersRouter);
app.use(`${apiPrefix}/auth`, authRouter);
app.use(`${apiPrefix}/materials`, materialsRouter);
app.use(`${apiPrefix}/payments`, paymentsRouter);
app.use(`${apiPrefix}/cart-payments`, cartPaymentsRouter);
app.use(`${apiPrefix}/purchases`, purchaseRouter);
app.use(`${apiPrefix}/sync`, syncRouter);
app.use(`${apiPrefix}/moderation`, moderationRouter);
app.use(`${apiPrefix}/subject`, subjectRouter);
app.use(`${apiPrefix}/reviews`, reviewsRouter);
app.use(`${apiPrefix}/university`, universityRouter);

app.get(`${apiPrefix}/materials/public-key`, (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
        return res.status(500).json({ napaka: "VAPID ključ ni nastavljen v .env!" });
    }
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post(`${apiPrefix}/materials/subscribe`, (req, res) => {
    try {
        const subscription = req.body;
        const payload = JSON.stringify({
            title: 'Pozdravljeni!',
            body: 'Uspešno ste se naročili na obvestila.',
            icon: '/icons/icon-192x192.png'
        });

        webpush.sendNotification(subscription, payload)
            .catch(err => console.error(err));

        res.status(201).json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ napaka: "Napaka na strežniku" });
    }
});

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.use(function(req, res, next) {
    next(createError(404));
});

app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
        message: err.message,
        error: req.app.get('env') === 'development' ? err : {}
    });
});

module.exports = app;
