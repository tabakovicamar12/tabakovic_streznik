var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
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

router.get('/library', authenticateToken, (req, res) => {
    try {
        const nakupi = purchaseStore.getPurchasesByUserId(req.user.id);

        if (nakupi.length === 0) {
            return res.json({
                sporocilo: "Tvoja digitalna knjižnica je prazna",
                skupajNakupov: 0,
                gradiva: []
            });
        }

        const gradivaTemp = nakupi.map(nakup => {
            const gradivo = materialStore.getMaterialById(nakup.gradivoId);
            return {
                nakupId: nakup.id,
                gradivo: gradivo ? {
                    id: gradivo.id,
                    naziv: gradivo.naziv,
                    opis: gradivo.opis,
                    predmet: gradivo.predmet,
                    profesor: gradivo.profesor,
                    tip: gradivo.tip,
                    cena: gradivo.cena,
                    ocena: gradivo.ocena,
                    tagovi: gradivo.tagovi
                } : null,
                datumNakupa: nakup.datumNakupa,
                datumPotrditve: nakup.datumPotrditve,
                status: nakup.status
            };
        });

        res.json({
            sporocilo: "Tvoja digitalna knjižnica",
            skupajNakupov: gradivaTemp.length,
            gradiva: gradivaTemp
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri pridobivanju knjižnice",
            opis: error.message
        });
    }
});

router.get('/download/:nakupId', authenticateToken, (req, res) => {
    try {
        const { nakupId } = req.params;

        const nakup = purchaseStore.getPurchaseById(nakupId);

        if (!nakup) {
            return res.status(404).json({
                napaka: "Nakup ne obstaja"
            });
        }

        if (nakup.uporabnikId !== req.user.id) {
            return res.status(403).json({
                napaka: "Nemaš dostopa do tega gradiva"
            });
        }

        if (nakup.status !== 'potrjeno') {
            return res.status(400).json({
                napaka: "Gradivo ni plačano ali je nakup preklican"
            });
        }

        const gradivo = materialStore.getMaterialById(nakup.gradivoId);

        if (!gradivo) {
            return res.status(404).json({
                napaka: "Gradivo ne obstaja več"
            });
        }

        const pdfPath = path.join(__dirname, `../uploads/materials/${gradivo.id}.pdf`);

        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({
                napaka: "Datoteka PDF ne obstaja"
            });
        }

        purchaseStore.recordDownload(nakupId);

        const fileName = `${gradivo.naziv.replace(/\s+/g, '_')}.pdf`;
        
        res.download(pdfPath, fileName, (err) => {
            if (err) {
                console.error('Napaka pri prenosu:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        napaka: "Napaka pri prenosu datoteke",
                        opis: err.message
                    });
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri prenosu gradiva",
            opis: error.message
        });
    }
});

router.get('/', authenticateToken, (req, res) => {
    try {
        const nakupi = purchaseStore.getPurchasesByUserId(req.user.id);

        res.json({
            sporocilo: "Tvoji nakupi",
            skupajNakupov: nakupi.length,
            nakupi: nakupi
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri pridobivanju nakupov",
            opis: error.message
        });
    }
});

module.exports = router;
