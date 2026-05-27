var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const subjectStore = require('../models/subjectStore');

const SECRET_KEY = process.env.SECRET_KEY;

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            napaka: "Žeton manjka",
            opis: "Prosimo, pošljite JWT žeton v Authorization zaglavju"
        });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({
                napaka: "Neveljaven ali potečen žeton",
                opis: err.message
            });
        }
        req.user = user;
        next();
    });
};

router.get('/', authenticateToken, async (req, res) => {
    try {
        const subjects = await subjectStore.getAllSubjects();
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ napaka: 'Napaka na strežniku.' });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        const universityId = req.user.university_id;

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ napaka: "Ime predmeta mora imeti vsaj 2 znaka." });
        }

        if (!universityId) {
            return res.status(400).json({ napaka: "Nimate nastavljene univerze." });
        }

        const obstoječiPredmeti = await subjectStore.getSubjectsByUniversity(universityId);
        const obstaja = obstoječiPredmeti.find(s => s.name.toLowerCase() === name.trim().toLowerCase());
        
        if (obstaja) {
            return res.status(400).json({ napaka: "Ta predmet na vaši univerzi že obstaja." });
        }

        const novPredmet = await subjectStore.createSubject(name.trim(), universityId);
        res.status(201).json(novPredmet);
    } catch (error) {
        res.status(500).json({ napaka: 'Napaka na strežniku.' });
    }
});

module.exports = router;