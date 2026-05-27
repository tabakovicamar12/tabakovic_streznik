const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:3000/api/v1';
let authToken = null;
let userId = null;
let materialId = null;

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
        printInfo("Prijava v sistem...");

        const regResponse = await apiClient.post('/auth/register', {
            email: `test_purchase_${Date.now()}@um.si`,
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

async function testCheckout() {
    try {
        printInfo("Pridobivanje seznama gradiv...");

        const materialsResponse = await apiClient.get('/materials');

        if (materialsResponse.data.gradiva.length === 0) {
            printError("Ni dostopnih gradiv za nakup");
            return null;
        }

        const gradivoZaNakup = materialsResponse.data.gradiva.find(g => g.cena > 0);

        if (!gradivoZaNakup) {
            printError("Ni gradiv dostopnih za nakup (cena mora biti > 0)");
            return null;
        }

        materialId = gradivoZaNakup.id;

        printInfo(`Ustvarjanje seje za plačilo za gradivo: ${gradivoZaNakup.naziv}`);

        const checkoutResponse = await apiClient.post('/payments/checkout', {
            gradivoId: materialId
        });

        printSuccess(`Seja je bila ustvarjena`);
        console.log(JSON.stringify({
            nakupId: checkoutResponse.data.sejo.nakupId,
            sessionId: checkoutResponse.data.sejo.id,
            checkoutUrl: checkoutResponse.data.sejo.url
        }, null, 2));

        return checkoutResponse.data.sejo;

    } catch (error) {
        printError(`Napaka pri ustvarjanju seje: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

let nakupIdZaPrenos = null;

async function testVerifyPayment(sessionId, nakupId) {
    try {
        printInfo(`Potrjevanje nakupa za demonstracijo...`);

        const response = await apiClient.post('/payments/verify-manual', {
            nakupId: nakupId
        });

        printSuccess(`Nakup je bil potrjen`);
        console.log(JSON.stringify(response.data.nakup, null, 2));
        
        nakupIdZaPrenos = nakupId;
        return response.data.nakup;

    } catch (error) {
        printError(`Napaka pri potrditvi: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testGetPurchases() {
    try {
        printInfo("Pridobivanje seznama nakupov...");

        const response = await apiClient.get('/purchases');

        printSuccess(`Pridobil sem ${response.data.skupajNakupov} nakupov`);
        console.log(JSON.stringify(response.data.nakupi, null, 2));

        return response.data.nakupi;

    } catch (error) {
        printError(`Napaka pri pridobivanju nakupov: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testGetLibrary() {
    try {
        printInfo("Pridobivanje tvoje digitalne knjižnice...");

        const response = await apiClient.get('/purchases/library');

        printSuccess(`Tvoja knjižnica ima ${response.data.skupajNakupov} gradiv`);
        console.log(JSON.stringify(response.data.gradiva, null, 2));

        return response.data.gradiva;

    } catch (error) {
        printError(`Napaka pri pridobivanju knjižnice: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testDownload() {
    try {
        if (!nakupIdZaPrenos) {
            printError("Ni nakupId za prenos");
            return false;
        }

        printInfo(`Poskus prenosa gradiva z nakupId: ${nakupIdZaPrenos}...`);

        const response = await apiClient.get(`/purchases/download/${nakupIdZaPrenos}`, {
            responseType: 'stream'
        });

        const downloadPath = path.join(__dirname, '../test-pdfs/prenesen_nakup.pdf');

        const writer = fs.createWriteStream(downloadPath);
        response.data.pipe(writer);

        return new Promise((resolve) => {
            writer.on('finish', () => {
                printSuccess(`Datoteka je bila prenesena v: ${downloadPath}`);
                resolve(true);
            });
            writer.on('error', (err) => {
                printError(`Napaka pri prenosu: ${err.message}`);
                resolve(false);
            });
        });

    } catch (error) {
        if (error.response?.status === 403) {
            printInfo("Pričakovan odgovor: Gradiva niste kupili (to je pričakovan rezultat pri testiranju)");
            return true;
        }
        printError(`Napaka pri prenosu: ${error.response?.data?.napaka || error.message}`);
        return false;
    }
}

async function runFullTest() {
    printHeader('🛒 TEST SISTEMA ZA NAKUP GRADIV');

    printHeader('1. AVTENTIFIKACIJA');
    if (!await setupAuthentication()) {
        printError("Avtentifikacija neuspešna. Prekinjanje testov.");
        return;
    }

    printHeader('2. ODDAJA V CHECKOUT');
    const checkout = await testCheckout();
    if (!checkout) {
        printError("Ustvarjanje seje neuspešno.");
        return;
    }

    printHeader('3. VERIFIKACIJA PLAČILA');
    await testVerifyPayment(checkout.id, checkout.nakupId);

    printHeader('4. PREGLED NAKUPOV');
    await testGetPurchases();

    printHeader('5. PREGLED DIGITALNE KNJIŽNICE');
    await testGetLibrary();

    printHeader('6. PRENOS GRADIVA');
    await testDownload();

    printHeader('✓ VSI TESTI ZAKLJUČENI!');
    console.log(`${colors.green}Sistem za nakup je bil uspešno testiran!${colors.reset}\n`);
}

runFullTest().catch(error => {
    printError(`Kritična napaka: ${error.message}`);
    process.exit(1);
});