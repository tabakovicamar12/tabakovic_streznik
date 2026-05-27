var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const materialStore = require('../models/materialStore');
const purchaseStore = require('../models/purchaseStore');

let stripe;
try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_default');
} catch (error) {
    console.error('Napaka pri inicijalizaciji Stripe:', error.message);
}

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

router.post('/checkout', authenticateToken, async (req, res) => {
    /*try {
        const { gradivoId } = req.body;

        if (!gradivoId) {
            return res.status(400).json({
                napaka: "Manjka ID gradiva",
                zahtevano: ["gradivoId"]
            });
        }

        const gradivo = materialStore.getMaterialById(gradivoId);

        if (!gradivo) {
            return res.status(404).json({
                napaka: "Gradivo ne obstaja"
            });
        }

        if (gradivo.cena <= 0) {
            return res.status(400).json({
                napaka: "To gradivo ni na voljo za nakup"
            });
        }

        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        //const checkoutUrl = `https://checkout.stripe.com/pay/${sessionId}`;

        const nakup = purchaseStore.createPurchase(
            req.user.id,
            gradivoId,
            gradivo.cena,
            sessionId
        );

        res.json({
            sporocilo: "Sejo za plačilo sem ustvaril",
            sejo: {
                id: sessionId,
                url: checkoutUrl,
                nakupId: nakup.id
            }
        });

    } catch (error) {
        console.error('Napaka pri kreiranju seje:', error);
        res.status(500).json({
            napaka: "Napaka pri kreiranju seje za plačilo",
            opis: error.message
        });
    }*/
});

router.get('/potrditev/:sessionId', async (req, res) => {
    /*try {
        const { sessionId } = req.params;

        const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

        if (stripeSession.payment_status === 'paid') {
            const nakup = purchaseStore.getPurchaseBySessionId(sessionId);

            if (nakup) {
                purchaseStore.updatePurchaseStatus(nakup.id, 'potrjeno');

                return res.json({
                    sporocilo: "Plačilo je bilo uspešno",
                    nakup: purchaseStore.getPurchaseById(nakup.id)
                });
            }
        }

        res.status(400).json({
            napaka: "Plačilo ni bilo potrjeno"
        });

    } catch (error) {
        console.error('Napaka pri preverki plačila:', error);
        res.status(500).json({
            napaka: "Napaka pri preverki stanja plačila",
            opis: error.message
        });
    }*/
});

router.post('/verify-manual', authenticateToken, (req, res) => {
    try {
        const { nakupId } = req.body;

        if (!nakupId) {
            return res.status(400).json({
                napaka: "Manjka ID nakupa"
            });
        }

        const nakup = purchaseStore.getPurchaseById(nakupId);

        if (!nakup) {
            return res.status(404).json({
                napaka: "Nakup ne obstaja"
            });
        }

        if (nakup.uporabnikId !== req.user.id && process.env.NODE_ENV !== 'development') {
            return res.status(403).json({
                napaka: "Nemaš dostopa do tega nakupa"
            });
        }

        const potvrjeniNakup = purchaseStore.updatePurchaseStatus(nakupId, 'potrjeno');

        res.json({
            sporocilo: "Nakup je bil ročno potrjen",
            nakup: potvrjeniNakup
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri ročni potrditi",
            opis: error.message
        });
    }
});

module.exports = router;
