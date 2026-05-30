var express = require('express');
var router = express.Router();
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const materialStore = require('../models/materialStore');
const cartPaymentAccess = require('../models/cartPaymentAccess');

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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = materialStore.UPLOADS_DIR;
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Samo PDF datoteke in slike so dovoljene!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }
});

const uploadConfig = upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'slika', maxCount: 1 }
]);

router.get('/public-key', (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
        return res.status(500).json({ napaka: "VAPID ključ ni nastavljen v .env datoteki!" });
    }
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                napaka: "Iskalni tekst mora biti najmanj 2 znaka"
            });
        }

        const rezultati = await materialStore.searchMaterials(q);

        res.json({
            iskalnik_tekst: q,
            stevilo_rezultatov: rezultati.length,
            rezultati: rezultati
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri iskanju",
            opis: error.message
        });
    }
});

router.get('/statistics', async (req, res) => {
    try {
        const stats = await materialStore.getStatistics();
        res.json({
            sporocilo: "Statistika gradiva",
            ...stats
        });
    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri pridobivanju statistike",
            opis: error.message
        });
    }
});

router.get('/report', authenticateToken, async (req, res) => {
    try {
        const csv = await materialStore.generateCSVReport();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="gradiva-porocilo.csv"');
        res.send(csv);
    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri generiranju porocila",
            opis: error.message
        });
    }
});

router.post('/upload', authenticateToken, (req, res) => {
    uploadConfig(req, res, async function (err) {
        if (err) {
            return res.status(400).json({
                napaka: "Napaka pri nalaganju",
                opis: err.message,
                polje: err.field
            });
        }

        try {
            const { naziv } = req.body;
            const pdfFile = req.files['pdf'] ? req.files['pdf'][0] : null;
            const slikaFile = req.files['slika'] ? req.files['slika'][0] : null;

            if (!naziv || !pdfFile) {
                if (pdfFile) fs.unlinkSync(pdfFile.path);
                if (slikaFile) fs.unlinkSync(slikaFile.path);
                return res.status(400).json({ napaka: "Manjkajoči podatki (naziv ali PDF)" });
            }

            const novoGradivo = await materialStore.createMaterial(
                {
                    ...req.body,
                    korisnikId: req.user.id,
                    slikaPath: slikaFile ? slikaFile.filename : null
                },
                pdfFile.path,
                pdfFile.originalname
            );

            res.status(201).json(novoGradivo);
        } catch (error) {
            res.status(500).json({ napaka: error.message });
        }
    });
});

router.get('/', async (req, res) => {
    try {
        const query = req.query;
        let gradiva;

        if (query.iskanje) {
            gradiva = await materialStore.searchMaterials(query.iskanje);
        } else {
            gradiva = await materialStore.getAllMaterials({
                predmet: query.predmet,
                profesor: query.profesor,
                minOcena: query.minOcena,
                sortPo: query.sortPo
            });
        }

        res.json({
            skupno: gradiva.length,
            gradiva: gradiva
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri pridobivanju gradiva",
            opis: error.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const gradivo = await materialStore.getMaterialById(req.params.id);

        if (!gradivo) {
            return res.status(404).json({ napaka: "Gradivo ni najdeno" });
        }

        await materialStore.incrementViewCount(req.params.id);
        res.json({ gradivo: gradivo });

    } catch (error) {
        res.status(500).json({ napaka: "Napaka na strežniku", opis: error.message });
    }
});

router.get('/:id/download', authenticateToken, async (req, res) => {
    try {
        const gradivo = await materialStore.getMaterialById(req.params.id);

        if (!gradivo) {
            return res.status(404).json({ napaka: "Gradivo ni najdeno" });
        }

        if (!await cartPaymentAccess.canDownload(req.user, gradivo)) {
            return res.status(403).json({ napaka: "Gradivo morate pred prenosom kupiti" });
        }

        const filePath = cartPaymentAccess.resolveMaterialFile(gradivo.pdfPath);
        if (!filePath) {
            return res.status(404).json({
                napaka: "Gradivo ali datoteka ni najdena"
            });
        }

        await materialStore.incrementViewCount(req.params.id);
        res.download(filePath, `${gradivo.naziv}.pdf`, (err) => {
            if (err) console.error('Napaka pri prenosu:', err);
        });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri prenosu datoteke",
            opis: error.message
        });
    }
});

router.put('/:id', authenticateToken, uploadConfig, async (req, res) => {
    try {
        const materialId = req.params.id;
        const gradivo = await materialStore.getMaterialById(materialId);

        if (!gradivo) {
            return res.status(404).json({ napaka: "Gradivo ni najdeno" });
        }

        if (gradivo.korisnikId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                napaka: "Nimate dovoljenja za urejanje tega gradiva",
                opis: "Urejate lahko samo gradiva, ki ste jih sami naložili."
            });
        }

        const updateData = {
            ...req.body,
            slikaPath: req.files['slika'] ? req.files['slika'][0].filename : gradivo.slikaPath,
            pdfPath: req.files['pdf'] ? req.files['pdf'][0].filename : gradivo.pdfPath
        };

        const result = await materialStore.updateMaterial(materialId, updateData);

        res.json({
            sporocilo: "Gradivo uspešno posodobljeno v bazi podatkov!",
            gradivo: result
        });

    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri posodabljanju", opis: error.message });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const gradivo = await materialStore.getMaterialById(req.params.id);

        if (!gradivo) {
            return res.status(404).json({ napaka: "Gradivo ni najdeno" });
        }

        if (gradivo.korisnikId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                napaka: "Nimate dovoljenja za brisanje tega gradiva",
                opis: "Brišete lahko samo gradiva, ki ste jih sami naložili."
            });
        }

        const izbrisano = await materialStore.deleteMaterial(req.params.id);

        if (!izbrisano) {
            return res.status(500).json({ napaka: "Napaka pri brisanju gradiva" });
        }

        res.json({ sporocilo: "Gradivo je uspešno izbrisano!" });

    } catch (error) {
        res.status(500).json({
            napaka: "Napaka pri brisanju gradiva",
            opis: error.message
        });
    }
});

const webpush = require('web-push');

router.post('/subscribe', (req, res) => {
    try {
        const subscription = req.body;

        const payload = JSON.stringify({
            title: 'Pozdravljeni!',
            body: 'Uspešno ste se naročili na obvestila o gradivu.',
            icon: '/icons/icon-192x192.png'
        });

        webpush.sendNotification(subscription, payload)
            .catch(err => console.error("Napaka pri pošiljanju obvestila:", err));

        res.status(201).json({
            sporocilo: 'Naročnina prejeta in testno obvestilo poslano!',
            status: 'success'
        });

    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri shranjevanju" });
    }
});

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'FILE_TOO_LARGE') {
            return res.status(413).json({
                napaka: "Datoteka je prevelika. Največja velikost: 50MB"
            });
        }
        return res.status(400).json({
            napaka: "Napaka pri nalaganju datoteke",
            opis: error.message
        });
    } else if (error) {
        return res.status(400).json({
            napaka: error.message || "Napaka pri obdelavi zahtevka"
        });
    }
    next();
});

module.exports = router;
