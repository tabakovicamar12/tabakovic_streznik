var express = require('express');
var router = express.Router();
const universityStore = require('../models/universityStore');

router.get('/', async (req, res) => {
    try {
        const universities = await universityStore.getAllUniversities();
        res.json({ universities });
    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri pridobivanju univerz",
            opis: error.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const university = await universityStore.getUniversityById(req.params.id);
        if (!university) {
            return res.status(404).json({ napaka: "Univerza ni najdena" });
        }
        res.json({ university });
    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri pridobivanju univerze",
            opis: error.message
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ napaka: "Ime univerze je obvezno" });
        }

        const result = await universityStore.createUniversity(name.trim());
        if (result.error) {
            return res.status(409).json({ napaka: result.error });
        }

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri ustvarjanju univerze",
            opis: error.message
        });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ napaka: "Ime univerze ne more biti prazno" });
        }

        const university = await universityStore.getUniversityById(req.params.id);
        if (!university) {
            return res.status(404).json({ napaka: "Univerza ni najdena" });
        }

        const updated = await universityStore.updateUniversity(req.params.id, { name: name.trim() });
        res.json(updated);
    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri posodabljanju univerze",
            opis: error.message
        });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const university = await universityStore.getUniversityById(req.params.id);
        if (!university) {
            return res.status(404).json({ napaka: "Univerza ni najdena" });
        }

        await universityStore.deleteUniversity(req.params.id);
        res.json({ sporocilo: "Univerza uspešno izbrisana" });
    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri brisanju univerze",
            opis: error.message
        });
    }
});

module.exports = router;