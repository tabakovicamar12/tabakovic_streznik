const axios = require('axios');
const readline = require('readline');

const API_BASE_URL = 'http://localhost:3000/api/v1';
let authToken = null; 
let currentUser = null;

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
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${title}${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
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

function printWarning(message) {
    console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

async function register(email, password, faks_id) {
    try {
        printInfo(`Registracija: ${email}`);
        const response = await apiClient.post('/auth/register', {
            email,
            password,
            university_id: faks_id 
        });

        printSuccess(response.data.sporocilo);
        authToken = response.data.access_token;
        currentUser = response.data.uporabnik;

        console.log(`${colors.green}Žeton:${colors.reset} ${authToken.substring(0, 20)}...`);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.log(`${colors.red}Podatki o napaki s strežnika:${colors.reset}`, error.response.data);
            printError(`Registracija neuspešna: ${error.response.data.napaka || error.response.data.opis || "Neznana napaka"}`);
        } else {
            printError(`Strežnik sploh ni odgovoril: ${error.message}`);
        }
        return null;
    }
}

async function login(email, password) {
    try {
        printInfo(`Prijava: ${email}`);
        const response = await apiClient.post('/auth/login', {
            email,
            password
        });

        printSuccess(response.data.sporocilo);
        authToken = response.data.access_token;
        currentUser = response.data.uporabnik;

        console.log(`${colors.green}Žeton:${colors.reset} ${authToken.substring(0, 20)}...`);
        return response.data;
    } catch (error) {
        printError(`Prijava neuspešna: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function getProfile() {
    try {
        if (!authToken) {
            printWarning("Nisi prijavljen!");
            return null;
        }

        printInfo("Pridobivam profil...");
        const response = await apiClient.get('/auth/me');

        printSuccess("Profil pridobljen!");
        const u = response.data.uporabnik;
        console.log(`${colors.green}ID:${colors.reset}`, u.id);
        console.log(`${colors.green}Email:${colors.reset}`, u.email);
        console.log(`${colors.green}Vloga:${colors.reset}`, u.role);
        console.log(`${colors.green}Fakulteta:${colors.reset}`, u.university_id);

        return response.data;
    } catch (error) {
        printError(`Napaka: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

async function updatePassword(currentPassword, newPassword) {
    try {
        if (!authToken) return null;

        printInfo("Posodabljam geslo...");
        const response = await apiClient.put('/auth/change-password', {
            currentPassword,
            newPassword
        });

        printSuccess(response.data.sporocilo);
        return response.data;
    } catch (error) {
        printError(`Napaka: ${error.response?.data?.napaka || error.message}`);
        return null;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    printSuccess("Odjava uspešna!");
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function interactiveMode() {
    const ask = (q) => new Promise((res) => rl.question(q, res));
    let running = true;

    while (running) {
        console.log(`\n${colors.cyan}--- MENI ---${colors.reset}`);
        console.log('1. Registracija\n2. Prijava\n3. Profil\n4. Geslo\n5. Odjava\n6. Izhod');
        
        const choice = await ask('\nIzbira: ');

        switch (choice) {
            case '1':
                await register(await ask('Email: '), await ask('Geslo: '), await ask('Faks ID: '));
                break;
            case '2':
                await login(await ask('Email: '), await ask('Geslo: '));
                break;
            case '3':
                await getProfile();
                break;
            case '4':
                await updatePassword(await ask('Trenutno: '), await ask('Novo: '));
                break;
            case '5':
                logout();
                break;
            case '6':
                running = false;
                rl.close();
                break;
        }
    }
}

interactiveMode();