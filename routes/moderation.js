var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const reviewStore = require('../models/reviewStore');
const reportStore = require('../models/reportStore');
const purchaseStore = require('../models/purchaseStore');
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

router.post('/reviews', authenticateToken, (req, res) => {
    try {
        const { gradivoId, ocena, komentar } = req.body;

        if (!gradivoId || !ocena) {
            return res.status(400).json({
                napaka: "Manjkajoči podatki",
                zahtevano: ["gradivoId", "ocena"]
            });
        }

        if (ocena < 1 || ocena > 5) {
            return res.status(400).json({
                napaka: "Ocena mora biti med 1 in 5"
            });
        }

        const gradivo = materialStore.getMaterialById(gradivoId);
        if (!gradivo) {
            return res.status(404).json({
                napaka: "Gradivo ne obstaja"
            });
        }

        const nakupi = purchaseStore.getPurchasesByUserId(req.user.id);
        const imaKupljeno = nakupi.some(n => n.gradivoId === gradivoId);

        if (!imaKupljeno) {
            return res.status(403).json({
                napaka: "Lahko ocenjaš le gradiva, ki si jih kupil"
            });
        }

        const nova = reviewStore.createReview(
            req.user.id,
            gradivoId,
            ocena,
            komentar || ""
        );

        if (!nova) {
            return res.status(409).json({
                napaka: "To gradivo si že ocenil"
            });
        }

        res.status(201).json({
            sporocilo: "Ocena je bila uspešno oddana",
            ocena: nova
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri oddaji ocene",
            opis: error.message
        });
    }
});

router.get('/reviews/:gradivoId', (req, res) => {
    try {
        const { gradivoId } = req.params;

        const gradivo = materialStore.getMaterialById(gradivoId);
        if (!gradivo) {
            return res.status(404).json({
                napaka: "Gradivo ne obstaja"
            });
        }

        const ocene = reviewStore.getReviewsByMaterialId(gradivoId);

        const povprecnaOcena = ocene.length > 0
            ? (ocene.reduce((sum, r) => sum + r.ocena, 0) / ocene.length).toFixed(2)
            : 0;

        res.json({
            sporocilo: "Ocene za gradivo",
            gradivo: {
                id: gradivo.id,
                naziv: gradivo.naziv
            },
            statistika: {
                skupajOcen: ocene.length,
                povprecnaOcena: povprecnaOcena
            },
            ocene: ocene
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri pridobivanju ocen",
            opis: error.message
        });
    }
});

router.put('/reviews/:reviewId', authenticateToken, (req, res) => {
    try {
        const { reviewId } = req.params;
        const { ocena, komentar } = req.body;

        if (!ocena) {
            return res.status(400).json({
                napaka: "Manjka ocena"
            });
        }

        if (ocena < 1 || ocena > 5) {
            return res.status(400).json({
                napaka: "Ocena mora biti med 1 in 5"
            });
        }

        const ocene = reviewStore.getReviewsByUserId(req.user.id);
        const lastnaOcena = ocene.find(o => o.id === reviewId);

        if (!lastnaOcena) {
            return res.status(403).json({
                napaka: "Ne moreš ažurirati to oceno"
            });
        }

        const azurirana = reviewStore.updateReview(reviewId, ocena, komentar || "");

        res.json({
            sporocilo: "Ocena je bila uspešno ažurirana",
            ocena: azurirana
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri ažuriranju ocene",
            opis: error.message
        });
    }
});

router.delete('/reviews/:reviewId', authenticateToken, (req, res) => {
    try {
        const { reviewId } = req.params;

        const ocene = reviewStore.getReviewsByUserId(req.user.id);
        const lastnaOcena = ocene.find(o => o.id === reviewId);

        if (!lastnaOcena) {
            return res.status(403).json({
                napaka: "Ne moreš izbrisati to oceno"
            });
        }

        reviewStore.deleteReview(reviewId);

        res.json({
            sporocilo: "Ocena je bila uspešno izbrisana"
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri brisanju ocene",
            opis: error.message
        });
    }
});

router.post('/reports', authenticateToken, (req, res) => {
    try {
        const { gradivoId, razlog, opis } = req.body;

        if (!gradivoId || !razlog) {
            return res.status(400).json({
                napaka: "Manjkajoči podatki",
                zahtevano: ["gradivoId", "razlog"]
            });
        }

        const veljaviRazlogi = ['avtorske_pravice', 'spamozni', 'neustrezna_vsebina', 'napacni_podatki'];
        if (!veljaviRazlogi.includes(razlog)) {
            return res.status(400).json({
                napaka: "Neveljaven razlog",
                veljaviRazlogi: veljaviRazlogi
            });
        }

        const gradivo = materialStore.getMaterialById(gradivoId);
        if (!gradivo) {
            return res.status(404).json({
                napaka: "Gradivo ne obstaja"
            });
        }

        const nova = reportStore.createReport(
            req.user.id,
            gradivoId,
            razlog,
            opis || ""
        );

        res.status(201).json({
            sporocilo: "Prijava je bila uspešno oddana",
            prijava: nova
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri oddaji prijave",
            opis: error.message
        });
    }
});

router.get('/reports/user', authenticateToken, (req, res) => {
    try {
        const prijave = reportStore.getReportsByUserId(req.user.id);

        res.json({
            sporocilo: "Tvoje prijave",
            skupaj: prijave.length,
            prijave: prijave
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri pridobivanju prijav",
            opis: error.message
        });
    }
});

module.exports = router;
