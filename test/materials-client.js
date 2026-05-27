const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE_URL = 'http://localhost:3000/api/v1';
let authToken = null;
let userId = null;

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

function createDummyPDF(fileName) {
    const testDir = path.join(__dirname, '../test-pdfs');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    const filePath = path.join(testDir, fileName);

    const pdfContent = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n' +
        '<< /Type /Catalog /Pages 2 0 R >>\n' +
        'endobj\n' +
        '2 0 obj\n' +
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n' +
        'endobj\n' +
        '3 0 obj\n' +
        '<< /Type /Page /Parent 2 0 R /Resources << >>> >>\n' +
        'endobj\n' +
        'xref\n' +
        '0 4\n' +
        '0000000000 65535 f\n' +
        '0000000009 00000 n\n' +
        '0000000056 00000 n\n' +
        '0000000115 00000 n\n' +
        'trailer\n' +
        '<< /Size 4 /Root 1 0 R >>\n' +
        'startxref\n' +
        '198\n' +
        '%%EOF'
    );

    fs.writeFileSync(filePath, pdfContent);
    return filePath;
}

async function setupAuthentication() {
    try {
        printInfo("Prijava v sistem...");

        const regResponse = await apiClient.post('/auth/register', {
            email: `test_gradiva_${Date.now()}@um.si`,
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

async function testCreateMaterial() {
    try {
        printInfo("Ustvarjam novo gradivo s PDF-om...");

        const pdfPath = createDummyPDF('test-gradivo.pdf');

        const formData = new FormData();
        formData.append('naziv', 'Zapiski');
        formData.append('opis', 'Opis knjige');
        formData.append('predmet', 'Programiranje');
        formData.append('profesor', 'Test test');
        formData.append('tip', 'Zapiski');
        formData.append('cena', '200');
        formData.append('oznake', 'programiranje, algoritmi, podatkovne strukture');
        formData.append('stStrani', '45');
        formData.append('jezikGradiva', 'Slovenščina');
        formData.append('pdf', fs.createReadStream(pdfPath));

        const response = await axios.post(
            `${API_BASE_URL}/materials/upload`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        printSuccess(`Gradivo ustvarjeno z ID: ${response.data.gradivo.id}`);
        return response.data.gradivo.id;

    } catch (error) {
        printError(`Napaka pri ustvarjanju gradiva: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testGetAllMaterials() {
    try {
        printInfo("Pridobivam vsa gradiva...");

        const response = await apiClient.get('/materials');

        printSuccess(`Najdeno ${response.data.skupno} gradiv`);

        if (response.data.gradiva.length > 0) {
            console.log(`\nPrvo gradivo:`);
            console.log(JSON.stringify(response.data.gradiva[0], null, 2));
        }

        return response.data.gradiva;

    } catch (error) {
        printError(`Napaka pri pridobivanju gradiv: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testFilterMaterials() {
    try {
        printInfo("Filtriram gradiva po predmetu...");

        const response = await apiClient.get('/materials', {
            params: {
                predmet: 'Organizacija',
                dostopno: 'true'
            }
        });

        printSuccess(`Najdeno ${response.data.skupno} gradiv s filtri`);

        return response.data.gradiva;

    } catch (error) {
        printError(`Napaka pri filtriranju: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testSearchMaterials() {
    try {
        printInfo("Iščem gradiva...");

        const response = await apiClient.get('/materials/search', {
            params: {
                q: 'organizacija'
            }
        });

        printSuccess(`Najdenih rezultatov: ${response.data.stevilo_rezultatov}`);

        return response.data.rezultati;

    } catch (error) {
        printError(`Napaka pri iskanju: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testGetMaterialById(id) {
    try {
        printInfo(`Pridobivam gradivo z ID: ${id}...`);

        const response = await apiClient.get(`/materials/${id}`);

        printSuccess(`Gradivo pridobljeno`);
        console.log(JSON.stringify(response.data.gradivo, null, 2));

        return response.data.gradivo;

    } catch (error) {
        printError(`Napaka pri pridobivanju gradiva: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testUpdateMaterial(id) {
    try {
        printInfo(`Posodabljam gradivo z ID: ${id}...`);

        const response = await apiClient.put(`/materials/${id}`, {
            naziv: 'Organizacijski zapiski - Posodobljena različica',
            cena: 250,
            dostopno: true,
            oznake: 'organizacija, menedžment, strukture, posodobljeno'
        });

        printSuccess(`Gradivo posodobljeno`);
        console.log(`Nova cena: ${response.data.gradivo.cena}`);

        return response.data.gradivo;

    } catch (error) {
        printError(`Napaka pri posodabljanju: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testGetStatistics() {
    try {
        printInfo("Pridobivam statistiko gradiv...");

        const response = await apiClient.get('/materials/statistics');

        printSuccess(`Statistika pridobljena`);
        console.log(JSON.stringify(response.data, null, 2));

        return response.data;

    } catch (error) {
        printError(`Napaka pri pridobivanju statistike: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function testGenerateCSVReport() {
    try {
        printInfo("Generiram CSV poročilo...");

        const response = await apiClient.get('/materials/report', {
            responseType: 'text'
        });

        printSuccess(`CSV poročilo generirano`);

        const reportPath = path.join(__dirname, '../test-pdfs/gradiva-porocilo.csv');
        fs.writeFileSync(reportPath, response.data);

        console.log(`Poročilo shranjeno v: ${reportPath}`);
        console.log(`\nPrve vrstice CSV-ja:`);
        console.log(response.data.split('\n').slice(0, 3).join('\n'));

        return response.data;

    } catch (error) {
        printError(`Napaka pri generiranju poročila: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function runFullTest() {
    printHeader('🎓 DIGITALNA TRŽNICA - CELOTEN TEST');

    printHeader('1. AVTENTIKACIJA');
    if (!await setupAuthentication()) {
        printError("Avtentikacija neuspešna. Prekinjam teste.");
        return;
    }

    printHeader('2. USTVARJANJE GRADIV');
    const materialId1 = await testCreateMaterial();
    if (!materialId1) {
        printError("Ustvarjanje gradiva neuspešno.");
        return;
    }

    printInfo("Ustvarjam drugo gradivo...");
    const pdfPath2 = createDummyPDF('test-gradivo-2.pdf');
    const formData2 = new FormData();
    formData2.append('naziv', 'Ekonomija Zapiski');
    formData2.append('opis', 'Zapiski s predavanj ekonomije');
    formData2.append('predmet', 'Ekonomija');
    formData2.append('profesor', 'Dr. Jelena Jovanović');
    formData2.append('tip', 'Zapiski');
    formData2.append('cena', '150');
    formData2.append('oznake', 'ekonomija, trg');
    formData2.append('pdf', fs.createReadStream(pdfPath2));

    try {
        const res2 = await axios.post(
            `${API_BASE_URL}/materials/upload`,
            formData2,
            {
                headers: {
                    ...formData2.getHeaders(),
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );
        printSuccess(`Drugo gradivo ustvarjeno z ID: ${res2.data.gradivo.id}`);
    } catch (error) {
        printError(`Napaka pri ustvarjanju drugega gradiva`);
    }

    printHeader('3. PRIDOBIVANJE VSEH GRADIV');
    const allMaterials = await testGetAllMaterials();

    printHeader('4. FILTRIRANJE GRADIV');
    await testFilterMaterials();

    printHeader('5. ISKANJE GRADIV');
    await testSearchMaterials();

    printHeader('6. PRIDOBIVANJE SPECIFIČNEGA GRADIVA');
    if (materialId1) {
        await testGetMaterialById(materialId1);
    }

    printHeader('7. POSODABLJANJE GRADIVA');
    if (materialId1) {
        await testUpdateMaterial(materialId1);
    }

    printHeader('8. STATISTIKA');
    await testGetStatistics();

    printHeader('9. GENERIRANJE CSV POROČILA');
    await testGenerateCSVReport();

    printHeader('✓ VSI TESTI ZAKLJUČENI!');
    console.log(`${colors.green}Digitalna tržnica je bila uspešno testirana!${colors.reset}\n`);
}

runFullTest().catch(error => {
    printError(`Kritična napaka: ${error.message}`);
    process.exit(1);
});