const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api/v1';
let authToken = null;
let userId = null;
let gradivoId = null;
let nakupId = null;

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
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function printHeader(title) {
    console.log(`\n${colors.cyan}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.cyan}${title}${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
}

function printSuccess(message) {
    console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function printError(message) {
    console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function printInfo(message) {
    console.log(`${colors.blue}ℹ ${message}${colors.reset}`);
}

async function setupAuthentication() {
    try {
        printInfo("Registracija in prijava...");

        const regResponse = await apiClient.post('/auth/register', {
            email: `test_sync_${Date.now()}@um.si`,
            password: 'TestPass123456',
            faks_id: 'FERI'
        });

        authToken = regResponse.data.access_token;
        userId = regResponse.data.uporabnik.id;

        printSuccess(`Prijavljen kot: ${regResponse.data.uporabnik.email}`);
        return true;

    } catch (error) {
        printError(`Napaka pri prijavi: ${error.response?.data?.napaka || error.message}`);
        return false;
    }
}

async function testSyncCheck() {
    try {
        printInfo("Preverjam sinhronizacijo podatkov...");

        const response = await apiClient.get('/sync/check', {
            params: {
                zadnjaSinhronizacija: new Date(Date.now() - 86400000).toISOString()
            }
        });

        printSuccess(`Sinhronizacija je uspešna`);
        console.log(`Skupaj gradiv: ${response.data.sinhronizacija.skupajGradiv}`);
        console.log(`Spremembe: ${response.data.sinhronizacija.spremembe}`);

        return response.data.sinhronizacija;

    } catch (error) {
        printError(`Napaka pri sinhronizaciji: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testPushSubscribe() {
    try {
        printInfo("Registriram push naročnino...");

        const mockSubscription = {
            endpoint: `https://fcm.googleapis.com/fcm/send/test_${Date.now()}`,
            expirationTime: null,
            keys: {
                p256dh: 'test_p256dh_key',
                auth: 'test_auth_key'
            }
        };

        const response = await apiClient.post('/sync/push/subscribe', {
            subscription: mockSubscription
        });

        printSuccess(`Naročnina je bila registrirana`);
        console.log(`ID naročnine: ${response.data.narocnina.id}`);

        return response.data.narocnina.id;

    } catch (error) {
        printError(`Napaka pri registraciji naročnine: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testGetSubscriptions() {
    try {
        printInfo("Preuzimam moje push naročnine...");

        const response = await apiClient.get('/sync/push/subscriptions');

        printSuccess(`Pridobil sem ${response.data.skupaj} naročnin`);
        console.log(JSON.stringify(response.data.narocnine, null, 2));

        return response.data.narocnine;

    } catch (error) {
        printError(`Napaka pri pridobivanju naročnin: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function prepareForReview() {
    try {
        printInfo("Pripravljam gradivo in nakup za testiranje ocene...");

        const materialsResponse = await apiClient.get('/materials');
        if (materialsResponse.data.gradiva.length === 0) {
            printError("Ni dostopnih gradiv");
            return false;
        }

        gradivoId = materialsResponse.data.gradiva[0].id;

        const checkoutResponse = await apiClient.post('/payments/checkout', {
            gradivoId: gradivoId
        });

        nakupId = checkoutResponse.data.sejo.nakupId;

        await apiClient.post('/payments/verify-manual', {
            nakupId: nakupId
        });

        printSuccess(`Gradivo je kupljeno - ID: ${gradivoId}, Nakup ID: ${nakupId}`);
        return true;

    } catch (error) {
        printError(`Napaka pri pripravi: ${error.message}`);
        return false;
    }
}

async function testAddReview() {
    try {
        if (!gradivoId) {
            printError("Ni gradivoId za oceno");
            return null;
        }

        printInfo(`Oddajam oceno za gradivo: ${gradivoId}...`);

        const response = await apiClient.post('/moderation/reviews', {
            gradivoId: gradivoId,
            ocena: 5,
            komentar: 'Odlično gradivo! Zelo koristno in jasno razloženo. Priporočam!'
        });

        printSuccess(`Ocena je bila uspešno oddana`);
        console.log(JSON.stringify(response.data.ocena, null, 2));

        return response.data.ocena.id;

    } catch (error) {
        printError(`Napaka pri oddaji ocene: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testGetReviews() {
    try {
        if (!gradivoId) {
            printError("Ni gradivoId");
            return null;
        }

        printInfo(`Preuzimam ocene za gradivo: ${gradivoId}...`);

        const response = await apiClient.get(`/moderation/reviews/${gradivoId}`);

        printSuccess(`Ocene za gradivo`);
        console.log(`Skupaj ocen: ${response.data.statistika.skupajOcen}`);
        console.log(`Povprečna ocena: ${response.data.statistika.povprecnaOcena}`);
        console.log(JSON.stringify(response.data.ocene, null, 2));

        return response.data.ocene;

    } catch (error) {
        printError(`Napaka pri pridobivanju ocen: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testAddReport() {
    try {
        if (!gradivoId) {
            printError("Ni gradivoId za prijavo");
            return null;
        }

        printInfo(`Oddajam prijavo za gradivo: ${gradivoId}...`);

        const response = await apiClient.post('/moderation/reports', {
            gradivoId: gradivoId,
            razlog: 'napacni_podatki',
            opis: 'Gradivo vsebuje napačne informacije o datumih'
        });

        printSuccess(`Prijava je bila uspešno oddana`);
        console.log(JSON.stringify(response.data.prijava, null, 2));

        return response.data.prijava.id;

    } catch (error) {
        printError(`Napaka pri oddaji prijave: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testGetUserReports() {
    try {
        printInfo("Preuzimam moje prijave...");

        const response = await apiClient.get('/moderation/reports/user');

        printSuccess(`Pridobil sem ${response.data.skupaj} prijav`);
        console.log(JSON.stringify(response.data.prijave, null, 2));

        return response.data.prijave;

    } catch (error) {
        printError(`Napaka pri pridobivanju prijav: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function runFullTest() {
    printHeader('🔄 TEST SINHRONIZACIJE IN MODERACIJE');

    printHeader('1. AVTENTIFIKACIJA');
    if (!await setupAuthentication()) {
        printError("Avtentifikacija neuspešna. Prekinjanje testov.");
        return;
    }

    printHeader('2. SINHRONIZACIJA PODATKOV');
    await testSyncCheck();

    printHeader('3. PUSH NAROČNINA');
    const subscriptionId = await testPushSubscribe();
    
    printHeader('4. PREGLED PUSH NAROČNIN');
    await testGetSubscriptions();

    printHeader('5. PRIPRAVA ZA OCENE IN PRIJAVE');
    if (!await prepareForReview()) {
        printError("Priprava neuspešna.");
        return;
    }

    printHeader('6. ODDAJA OCENE');
    const reviewId = await testAddReview();

    printHeader('7. PREGLED OCEN');
    await testGetReviews();

    printHeader('8. ODDAJA PRIJAVE');
    await testAddReport();

    printHeader('9. PREGLED MOJIH PRIJAV');
    await testGetUserReports();

    printHeader('✓ VSI TESTI ZAKLJUČENI!');
    console.log(`${colors.green}Sistem za sinhronizacijo in moderacijo je bil uspešno testiran!${colors.reset}\n`);
}

runFullTest().catch(error => {
    printError(`Kritična napaka: ${error.message}`);
    process.exit(1);
});
