var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const userStore = require('../models/userStore');

const SECRET_KEY = process.env.SECRET_KEY;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1h';

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

router.post('/register', async (req, res) => {
    try {
        const { email, password, university_id } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                napaka: "Manjkajoči podatki",
                zahtevano: ["email", "password", "university_id"]
            });
        }

        if (!email.includes('@')) {
            return res.status(400).json({ 
                napaka: "Neveljaven email naslov"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                napaka: "Geslo mora imeti najmanj 6 znakov"
            });
        }

        const newUser = await userStore.createUser(email, password, university_id);

        if (newUser.error) {
            return res.status(409).json({ napaka: newUser.error });
        }

        const token = jwt.sign(
            { 
                id: newUser.id,
                email: newUser.email, 
                role: newUser.role,
                university_id: newUser.university_id
            }, 
            SECRET_KEY, 
            { expiresIn: JWT_EXPIRE }
        );

        res.status(201).json({
            sporocilo: "Registracija uspešna!",
            uporabnik: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role
            },
            access_token: token,
            token_type: "Bearer",
            expires_in: JWT_EXPIRE
        });

    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri registraciji", opis: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                napaka: "Manjkajoči podatki",
                zahtevano: ["email", "password"]
            });
        }

        const result = await userStore.verifyPassword(email, password);

        if (!result.valid) {
            return res.status(401).json({ 
                napaka: result.error || "Napačen email ali geslo"
            });
        }

        const user = result.user;
        const token = jwt.sign(
            { 
                id: user.id,
                email: user.email, 
                role: user.role,
                university_id: user.university_id
            }, 
            SECRET_KEY, 
            { expiresIn: JWT_EXPIRE }
        );

        res.json({
            sporocilo: "Prijava uspešna!",
            access_token: token,
            token_type: "Bearer",
            expires_in: JWT_EXPIRE,
            uporabnik: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri prijavi", opis: error.message });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await userStore.getUserById(req.user.id);

        if (!user) {
            return res.status(404).json({ napaka: "Uporabnik ne obstaja" });
        }

        res.json({
            uporabnik: {
                id: user.id,
                email: user.email,
                role: user.role,
                university_id: user.university_id,
                created_at: user.created_at
            }
        });

    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri pridobivanju profila", opis: error.message });
    }
});

router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                napaka: "Manjkajoči podatki",
                zahtevano: ["currentPassword", "newPassword"]
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                napaka: "Novo geslo mora imeti najmanj 6 znakov"
            });
        }

        const user = await userStore.getUserById(req.user.id);
        const result = await userStore.verifyPassword(user.email, currentPassword);

        if (!result.valid) {
            return res.status(401).json({ napaka: "Trenutno geslo je napačno" });
        }

        await userStore.updatePassword(req.user.id, newPassword);

        res.json({ sporocilo: "Geslo je bilo uspešno spremenjeno!" });

    } catch (error) {
        res.status(500).json({ napaka: "Napaka pri spremembi gesla", opis: error.message });
    }
});

module.exports = router;