const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE_URL = 'http://localhost:3000/api/v1';
let authToken = null;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

apiClient.interceptors.request.use((config) => {
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
});

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

let testsPassed = 0;
let testsFailed = 0;

function printHeader(title) {
    console.log(`\n${colors.cyan}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.cyan}${title}${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
}

function pass(msg) {
    console.log(`${colors.green}✓ ${msg}${colors.reset}`);
    testsPassed++;
}

function fail(msg) {
    console.log(`${colors.red}✗ ${msg}${colors.reset}`);
    testsFailed++;
}

async function test(name, fn) {
    try {
        await fn();
        pass(name);
    } catch (error) {
        fail(`${name}: ${error.message}`);
    }
}

async function runAllTests() {
    console.log(`\n${colors.cyan}AVTENTIFIKACIJA${colors.reset}`);
    await test('Registracija', async () => {
        const res = await apiClient.post('/auth/register', {
            email: `final_test_${Date.now()}@um.si`,
            password: 'TestPass123456',
            faks_id: 'FERI'
        });
        authToken = res.data.access_token;
        if (!authToken) throw new Error('No token');
    });

    await test('Priseganje s klientom', async () => {
        const res = await apiClient.get('/auth/profile');
        if (!res.data.uporabnik) throw new Error('No user');
    });

    console.log(`\n${colors.cyan}DIGITALNA TRŽNICA${colors.reset}`);
    await test('Pregled svih gradiv', async () => {
        const res = await apiClient.get('/materials');
        if (!res.data.gradiva) throw new Error('No materials');
    });

    await test('Pretraga gradiv', async () => {
        const res = await apiClient.get('/materials/search', {
            params: { q: 'test' }
        });
        if (!res.data.rezultati) throw new Error('No results');
    });

    await test('Statistika gradiv', async () => {
        const res = await apiClient.get('/materials/statistics');
        if (!res.data.sporocilo) throw new Error('No statistics');
    });

    console.log(`\n${colors.cyan}SISTEM PLAČILA I NAKUPA${colors.reset}`);
    let sessionId, nakupId;
    
    await test('Kreiranje checkout seje', async () => {
        const materials = await apiClient.get('/materials');
        const grad = materials.data.gradiva.find(g => g.cena > 0);
        const res = await apiClient.post('/payments/checkout', {
            gradivoId: grad.id
        });
        sessionId = res.data.sejo.id;
        nakupId = res.data.sejo.nakupId;
        if (!sessionId) throw new Error('No session');
    });

    await test('Ročna potrditev nakupa', async () => {
        const res = await apiClient.post('/payments/verify-manual', {
            nakupId: nakupId
        });
        if (res.data.nakup.status !== 'potrjeno') throw new Error('Not confirmed');
    });

    await test('Pregled digitalne knjižnice', async () => {
        const res = await apiClient.get('/purchases/library');
        if (res.data.skupajNakupov < 1) throw new Error('No purchases');
    });

    // 4. Sinhronizacija i Push
    console.log(`\n${colors.cyan}SINHRONIZACIJA I PWA${colors.reset}`);
    await test('Preverjanje sinhronizacije', async () => {
        const res = await apiClient.get('/sync/check', {
            params: {
                zadnjaSinhronizacija: new Date(Date.now() - 86400000).toISOString()
            }
        });
        if (!res.data.sinhronizacija) throw new Error('No sync data');
    });

    await test('Registracija push naročnine', async () => {
        const res = await apiClient.post('/sync/push/subscribe', {
            subscription: {
                endpoint: `https://fcm.test/fcm_${Date.now()}`,
                keys: { p256dh: 'test', auth: 'test' }
            }
        });
        if (!res.data.narocnina) throw new Error('No subscription');
    });

    await test('Pregled push naročnin', async () => {
        const res = await apiClient.get('/sync/push/subscriptions');
        if (!Array.isArray(res.data.narocnine)) throw new Error('No subscriptions list');
    });

    // 5. Ocene i Prijave
    console.log(`\n${colors.cyan}NADZOR KAKOVOSTI${colors.reset}`);
    let reviewId;
    
    await test('Oddaja ocene', async () => {
        const materials = await apiClient.get('/materials');
        const grad = materials.data.gradiva[0];
        const res = await apiClient.post('/moderation/reviews', {
            gradivoId: grad.id,
            ocena: 5,
            komentar: 'Test ocene'
        });
        reviewId = res.data.ocena.id;
        if (!reviewId) throw new Error('No review');
    });

    await test('Pregled ocen za gradivo', async () => {
        const materials = await apiClient.get('/materials');
        const grad = materials.data.gradiva[0];
        const res = await apiClient.get(`/moderation/reviews/${grad.id}`);
        if (!res.data.ocene) throw new Error('No reviews');
    });

    await test('Oddaja prijave', async () => {
        const materials = await apiClient.get('/materials');
        const grad = materials.data.gradiva[0];
        const res = await apiClient.post('/moderation/reports', {
            gradivoId: grad.id,
            razlog: 'napacni_podatki',
            opis: 'Test prijave'
        });
        if (!res.data.prijava.id) throw new Error('No report');
    });

    await test('Pregled mojih prijav', async () => {
        const res = await apiClient.get('/moderation/reports/user');
        if (!Array.isArray(res.data.prijave)) throw new Error('No reports list');
    });

    printHeader('📊 REZULTATI TESTIRANJA');
    console.log(`${colors.green}✓ Uspešni testi: ${testsPassed}${colors.reset}`);
    console.log(`${colors.red}✗ Neuspešni testi: ${testsFailed}${colors.reset}`);
    console.log(`${'='.repeat(70)}`);
}

runAllTests().catch(err => {
    console.error(`${colors.red}KRITIČNA NAPAKA: ${err.message}${colors.reset}`);
    process.exit(1);
});
