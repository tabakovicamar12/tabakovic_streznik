var express = require('express');
var router = express.Router();
const reviewStore = require('../models/reviewStore');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.SECRET_KEY;

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ napaka: "Žeton manjka" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ napaka: "Neveljaven žeton" });
        req.user = user;
        next();
    });
};

router.get('/material/:materialId', async (req, res) => {
    try {
        const podaci = await reviewStore.getReviewsWithStats(req.params.materialId);
        res.json(podaci);
    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri pridobivanju recenzij", opis: error.message });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { materialId, rating, comment } = req.body;
        const userId = req.user.id;

        if (!materialId || !rating) {
            return res.status(400).json({ napaka: "Manjkajoči podatki" });
        }

        const rezultat = await reviewStore.createReview(userId, materialId, parseInt(rating), comment);
        
        if (rezultat.error) {
            return res.status(400).json({ napaka: rezultat.error });
        }

        res.status(201).json(rezultat);
    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri ustvarjanju recenzije", opis: error.message });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const review = await reviewStore.getReviewById(req.params.id);
        if (!review) return res.status(404).json({ napaka: "Recenzija ni najdena" });

        if (review.user_id !== req.user.id) {
            return res.status(403).json({ napaka: "Nimate dovoljenja za urejanje" });
        }

        const { rating, comment } = req.body;
        const rezultat = await reviewStore.updateReview(req.params.id, parseInt(rating), comment);
        
        if (rezultat.error) return res.status(400).json({ napaka: rezultat.error });
        res.json(rezultat);
    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri posodabljanju", opis: error.message });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const review = await reviewStore.getReviewById(req.params.id);
        if (!review) return res.status(404).json({ napaka: "Recenzija ni najdena" });

        if (review.user_id !== req.user.id) {
            return res.status(403).json({ napaka: "Nimate dovoljenja za brisanje" });
        }

        await reviewStore.deleteReview(req.params.id);
        res.json({ sporocilo: "Recenzija uspešno izbrisana" });
    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri brisanju", opis: error.message });
    }
});

module.exports = router;