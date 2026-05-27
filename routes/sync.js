var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const syncStore = require('../models/syncStore');
const pushStore = require('../models/pushStore');
const materialStore = require('../models/materialStore');

const SECRET_KEY = process.env.SECRET_KEY;

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            napaka: "Žeton manjka",
            opis: "Prosim pošlji JWT žeton v Authorization headerju"
        });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({
                napaka: "Neveljaven ali potekel žeton",
                opis: err.message
            });
        }
        req.user = user;
        next();
    });
};

router.get('/check', authenticateToken, (req, res) => {
    try {
        const { zadnjaSinhronizacija } = req.query;

        const vseGradiva = materialStore.getAllMaterials();
        
        let spremembe = [];
        
        if (zadnjaSinhronizacija) {
            const datumMeje = new Date(zadnjaSinhronizacija);
            spremembe = vseGradiva.filter(gradivo => {
                const datumAzuriranja = new Date(gradivo.datumAzuriranja || gradivo.datumNaloga);
                return datumAzuriranja > datumMeje;
            });
        } else {
            spremembe = vseGradiva;
        }

        const posodobitev = syncStore.updateSync(req.user.id, {
            skupajGradiv: vseGradiva.length,
            spremembe: spremembe.length
        });

        res.json({
            sporocilo: "Podatki so sinhronizirani",
            sinhronizacija: {
                zadnjaSinhronizacija: posodobitev.zadnjaSinhronizacija,
                skupajGradiv: vseGradiva.length,
                spremembe: spremembe.length,
                gradiva: spremembe.slice(0, 50)
            }
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri sinhronizaciji",
            opis: error.message
        });
    }
});

router.post('/push/subscribe', authenticateToken, (req, res) => {
    try {
        const { subscription } = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                napaka: "Neveljavna push naročnina",
                zahtevano: ["subscription.endpoint", "subscription.keys"]
            });
        }

        const nova = pushStore.subscribe(req.user.id, subscription);

        res.status(201).json({
            sporocilo: "Naročnina je bila uspešno registrirana",
            narocnina: {
                id: nova.id,
                datumRogistracije: nova.datumRogistracije
            }
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri registraciji naročnine",
            opis: error.message
        });
    }
});

router.post('/push/unsubscribe', authenticateToken, (req, res) => {
    try {
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({
                napaka: "Manjka ID naročnine"
            });
        }

        const rezultat = pushStore.unsubscribe(subscriptionId);

        if (!rezultat) {
            return res.status(404).json({
                napaka: "Naročnina ne obstaja"
            });
        }

        res.json({
            sporocilo: "Naročnina je bila preklicana"
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri prekličanju naročnine",
            opis: error.message
        });
    }
});

router.get('/push/subscriptions', authenticateToken, (req, res) => {
    try {
        const narocnine = pushStore.getSubscriptionsByUserId(req.user.id);

        res.json({
            sporocilo: "Tvoje push naročnine",
            skupaj: narocnine.length,
            narocnine: narocnine
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri pridobivanju naročnin",
            opis: error.message
        });
    }
});

module.exports = router;
