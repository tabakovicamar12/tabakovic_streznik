var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const materialStore = require('../models/materialStore');
const cartPaymentStore = require('../models/cartPaymentStore');

const SECRET_KEY = process.env.SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const demoMode = process.env.NODE_ENV === 'development' && process.env.PAYMENTS_DEMO_MODE !== 'false';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ napaka: 'Za placilo se morate prijaviti.' });
    }

    jwt.verify(token, SECRET_KEY, async (error, user) => {
        if (error) {
            return res.status(403).json({ napaka: 'Prijava je potekla. Prijavite se ponovno.' });
        }

        try {
            const currentUser = await cartPaymentStore.getUserById(user.id);
            if (!currentUser) {
                return res.status(401).json({
                    napaka: 'Uporabniski racun ne obstaja vec. Odjavite se in se ponovno prijavite.'
                });
            }

            req.user = currentUser;
            next();
        } catch (databaseError) {
            res.status(500).json({ napaka: 'Uporabniskega racuna ni bilo mogoce preveriti.' });
        }
    });
}

async function getPayableMaterials(rawMaterialIds, user) {
    const materialIds = [...new Set(rawMaterialIds.map(Number))]
        .filter(Number.isInteger);

    if (materialIds.length === 0) {
        throw new Error('Kosarica je prazna.');
    }

    const materials = await Promise.all(materialIds.map(id => materialStore.getMaterialById(id)));
    if (materials.some(material => !material)) {
        throw new Error('Eno izmed gradiv ne obstaja vec.');
    }

    const completedMaterialIds = await cartPaymentStore.getCompletedMaterialIds(user.id, materialIds);
    const completed = new Set(completedMaterialIds);

    const skippedMaterials = [];
    const payableMaterials = materials.filter(material => {
        let reason = null;

        if (user.role === 'admin') reason = 'admin';
        else if (material.korisnikId === user.id) reason = 'own';
        else if (Number(material.cena) <= 0) reason = 'free';
        else if (completed.has(material.id)) reason = 'purchased';

        if (reason) {
            skippedMaterials.push({ id: material.id, reason });
            return false;
        }

        return true;
    });

    return { payableMaterials, skippedMaterials };
}

function getSkippedMessage(skippedMaterials) {
    const reasons = new Set(skippedMaterials.map(material => material.reason));

    if (reasons.has('purchased')) return 'Izbrano gradivo ste ze kupili. Odstranjeno je iz kosarice.';
    if (reasons.has('own')) return 'Izbrano gradivo ste nalozili sami, zato ga ne rabite placati.';
    if (reasons.has('free')) return 'Izbrano gradivo je brezplacno in ga ne rabite placati.';
    if (reasons.has('admin')) return 'Administrator ima dostop do vseh gradiv in jih ne rabi placati.';

    return 'V kosarici ni gradiv, ki bi jih bilo treba placati.';
}

function orderPayload(sessionId, materials, order) {
    return {
        sessionId,
        materialIds: materials.map(material => material.id),
        total: materials.reduce((sum, material) => sum + Number(material.cena), 0),
        nakupi: order
    };
}

router.get('/library', authenticateToken, async (req, res) => {
    try {
        const materialIds = await cartPaymentStore.getCompletedMaterialIdsByUser(req.user.id);
        res.json({ materialIds });
    } catch (error) {
        res.status(500).json({ napaka: 'Kupljenih gradiv ni bilo mogoce pridobiti.' });
    }
});

router.post('/checkout', authenticateToken, async (req, res) => {
    try {
        const { payableMaterials, skippedMaterials } = await getPayableMaterials(
            req.body.materialIds || [],
            req.user
        );

        if (payableMaterials.length === 0) {
            return res.status(400).json({
                napaka: getSkippedMessage(skippedMaterials),
                odstraniIzKosarice: skippedMaterials.map(material => material.id)
            });
        }

        if (demoMode) {
            const sessionId = `demo_cart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            const order = await cartPaymentStore.createPendingOrder(
                req.user.id,
                payableMaterials.map(material => material.id),
                sessionId
            );

            return res.json({
                sporocilo: 'Demo placilo je pripravljeno.',
                demo: true,
                narocilo: orderPayload(sessionId, payableMaterials, order),
                odstraniIzKosarice: skippedMaterials.map(material => material.id)
            });
        }

        if (!stripe) {
            return res.status(503).json({ napaka: 'Stripe ni konfiguriran na strezniku.' });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: payableMaterials.map(material => ({
                quantity: 1,
                price_data: {
                    currency: 'eur',
                    unit_amount: Math.round(Number(material.cena) * 100),
                    product_data: {
                        name: material.naziv,
                        description: material.opis || undefined
                    }
                }
            })),
            success_url: `${FRONTEND_URL}/cart.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/cart.html?payment=cancelled`
        });

        const order = await cartPaymentStore.createPendingOrder(
            req.user.id,
            payableMaterials.map(material => material.id),
            session.id
        );

        res.json({
            sporocilo: 'Stripe Checkout seja je ustvarjena.',
            demo: false,
            checkoutUrl: session.url,
            narocilo: orderPayload(session.id, payableMaterials, order),
            odstraniIzKosarice: skippedMaterials.map(material => material.id)
        });
    } catch (error) {
        const message = error.code === 'SQLITE_CONSTRAINT'
            ? 'Uporabniski racun ali gradivo ne obstaja vec. Osvezite stran in se ponovno prijavite.'
            : error.message;
        res.status(400).json({ napaka: message });
    }
});

router.post('/verify-manual', authenticateToken, async (req, res) => {
    try {
        if (!demoMode) {
            return res.status(404).json({ napaka: 'Demo placilo ni na voljo.' });
        }

        const sessionId = req.body.sessionId;
        const order = await cartPaymentStore.getOrderBySessionId(sessionId);

        if (!sessionId || order.length === 0 || order.some(purchase => purchase.buyer_id !== req.user.id)) {
            return res.status(404).json({ napaka: 'Narocilo ne obstaja.' });
        }

        const completedOrder = await cartPaymentStore.completeOrder(sessionId);
        res.json({
            sporocilo: 'Demo placilo je potrjeno.',
            narocilo: completedOrder
        });
    } catch (error) {
        res.status(500).json({ napaka: error.message });
    }
});

router.get('/confirmation/:sessionId', authenticateToken, async (req, res) => {
    try {
        const order = await cartPaymentStore.getOrderBySessionId(req.params.sessionId);
        if (order.length === 0 || order.some(purchase => purchase.buyer_id !== req.user.id)) {
            return res.status(404).json({ napaka: 'Narocilo ne obstaja.' });
        }

        if (order.every(purchase => purchase.status === cartPaymentStore.COMPLETED_STATUS)) {
            return res.json({ sporocilo: 'Placilo je ze potrjeno.', narocilo: order });
        }

        if (!stripe || req.params.sessionId.startsWith('demo_cart_')) {
            return res.status(400).json({ napaka: 'Placilo ni potrjeno.' });
        }

        const stripeSession = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        if (stripeSession.payment_status !== 'paid') {
            return res.status(400).json({ napaka: 'Placilo ni potrjeno.' });
        }

        const completedOrder = await cartPaymentStore.completeOrder(req.params.sessionId);
        res.json({ sporocilo: 'Placilo je uspesno potrjeno.', narocilo: completedOrder });
    } catch (error) {
        res.status(500).json({ napaka: error.message });
    }
});

module.exports = router;
