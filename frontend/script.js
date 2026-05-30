const urlMaterials = 'http://localhost:3000/api/v1/materials';
const urlAuth = 'http://localhost:3000/api/v1/auth';
const grid = document.getElementById('materials-grid');
const pagnationDiv = document.getElementById('pagination-controls');
var all_data = [];
var isEditModal = false;
let allSubjects = [];
let allUniversities = [];
let currentMaterialId = null;

const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('StudyHubDB', 1);

    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('gradiva')) {
            db.createObjectStore('gradiva', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('sync_queue')) {
            db.createObjectStore('sync_queue', { autoIncrement: true });
        }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
        return reg.pushManager.getSubscription()
            .then(async (sub) => {
                if (sub) return sub;

                const response = await fetch(`${urlMaterials}/public-key`);
                const key = await response.json();

                return reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: key.publicKey
                });
            });
    }).then(sub => {
        fetch(`${urlMaterials}/subscribe`, {
            method: 'POST',
            body: JSON.stringify(sub),
            headers: { 'Content-Type': 'application/json' }
        });
    });
}

async function refreshSubjects() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/v1/subject', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            allSubjects = await response.json();
            buildDropdown(allSubjects);
        }
    } catch (err) {
        console.error("Napaka pri pridobivanju predmetov:", err);
    }
}

async function getUniversities() {
    try {
        const response = await fetch('/api/v1/university', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            allUniversities = data.universities || [];
        }
    } catch (err) {
        console.error("Napaka pri pridobivanju univerz:", err);
    }
}

async function refreshUniversities() {
    try {
        const response = await fetch('/api/v1/university', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            allUniversities = data.universities || [];

            buildUniversitySelect(allUniversities);
        }
    } catch (err) {
        console.error("Napaka pri pridobivanju univerz:", err);
    }
}

function buildUniversityDropdown(universities) {
    const dropdown = document.getElementById('universityDropdownList');
    if (!dropdown) return;

    dropdown.innerHTML = '';

    if (universities.length === 0) {
        dropdown.innerHTML = '<div style="padding: 10px; color: #64748b;">Ni najdenih univerz</div>';
        return;
    }

    universities.forEach(uni => {
        const div = document.createElement('div');
        div.style.padding = '10px';
        div.style.cursor = 'pointer';
        div.style.color = '#1e293b';
        div.textContent = uni.name;
        div.addEventListener('click', () => {
            document.getElementById('universitySearchInput').value = uni.name;
            document.getElementById('universityRegisterSelect').value = uni.id; // Upisuje ID u hidden polje
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(div);
    });
}

function buildDropdown(subjects) {
    const list = document.getElementById('subjectDropdownList');
    if (!list) return;

    list.innerHTML = '';

    if (subjects.length === 0) {
        list.innerHTML = '<div class="no-suggestions">Ni najdenih predmetov</div>';
        return;
    }

    subjects.forEach(subject => {
        const item = document.createElement('div');
        item.className = 'subject-dropdown-item';
        item.textContent = subject.name;
        item.dataset.id = subject.id;

        item.addEventListener('click', function () {
            document.getElementById('subjectSearchInput').value = subject.name;
            document.getElementById('materialSubjectSelect').value = subject.id;
            list.style.display = 'none';
        });

        list.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    getUniversities();
    const subjectInput = document.getElementById('subjectSearchInput');
    const subjectDropdown = document.getElementById('subjectDropdownList');

    const uniInput = document.getElementById('universitySearchInput');
    const uniDropdown = document.getElementById('universityDropdownList');

    if (subjectInput && subjectDropdown) {
        subjectInput.addEventListener('focus', async () => {
            if (allSubjects.length === 0) {
                await refreshSubjects();
            }
            buildDropdown(allSubjects);
            subjectDropdown.style.display = 'block';
        });

        subjectInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allSubjects.filter(s => s.name.toLowerCase().includes(query));
            buildDropdown(filtered);
            subjectDropdown.style.display = 'block';

            if (query === '') {
                document.getElementById('materialSubjectSelect').value = '';
            }
        });
    }

    if (uniInput && uniDropdown) {
        uniInput.addEventListener('focus', async () => {
            if (allUniversities.length === 0) {
                await refreshUniversities();
            }
            buildUniversityDropdown(allUniversities);
            uniDropdown.style.display = 'block';
        });

        uniInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allUniversities.filter(u => u.name.toLowerCase().includes(query));
            buildUniversityDropdown(filtered);
            uniDropdown.style.display = 'block';

            if (query === '') {
                document.getElementById('universitySubjectSelect').value = '';
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (subjectInput && !subjectInput.contains(e.target) && !subjectDropdown.contains(e.target)) {
            subjectDropdown.style.display = 'none';
        }
        if (uniInput && !uniInput.contains(e.target) && !uniDropdown.contains(e.target)) {
            uniDropdown.style.display = 'none';
        }
    });

    if (localStorage.getItem('token')) {
        refreshSubjects();
        refreshUniversities();
    }
});

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
const synth = window.speechSynthesis;

recognition.continuous = false;
recognition.lang = "sl-SI";
recognition.interimResults = false;

const voiceBtn = document.getElementById('voice-btn');

function speak(text) {
    const utterThis = new SpeechSynthesisUtterance(text);
    utterThis.lang = 'sl-SI';
    synth.speak(utterThis);
}

function processVoiceCommand(command) {
    const text = command.toLowerCase();
    console.log("Prepoznan ukaz:", text);
    if (text.includes("išči") || text.includes("iskanje")) {
        const query = text.replace("išči", "").replace("iskanje", "").trim();
        if (query) {
            searchFunction({ target: { value: query } });
            speak(`Iščem gradivo ${query}`);
        }
    }

    else if (text.includes("domov") || text.includes("začetek")) {
        speak("Vračam se na prvo stran.");
        setTimeout(() => window.location.href = "/", 1000);
    }
    else if (text.includes("dodaj gradivo") || text.includes("dodaj")) {
        showModal();
        speak("Odpiram modalno okno za dodajanje gradiva.");
    }

    else if (text.includes("osveži") || text.includes("refresh")) {
        naloziPodatke();
        showPagnation();
        speak("Osvežujem prikaz.");
    }

    else if (text.includes("pokaži pomoč")) {
        simulateHoverEffect();
        speak("Prikaz pomoči.");
    }

    else if (text.includes("moje gradivo") || text.includes("moja gradiva")) {
        filterData('my', document.querySelector('.my-data'));
        speak("Prikaz tvojega gradiva.");
    }

    else if (text.includes("pomoč")) {
        speak("Lahko rečete: išči ter naslov gradiva, pojdi domov, osveži podatke, dodaj gradivo, prikaz mojega gradiva ali pokaži pomoč.");
    }
    else {
        speak("Ukaza ne razumem. Poskusite znova.");
    }
}

voiceBtn.onclick = () => {
    try {
        recognition.start();
    } catch (e) {
        console.log("Prepoznava že teče.");
    }
};

recognition.onstart = () => {
    console.log("Poslušam...");
    voiceBtn.style.boxShadow = "0 0 15px red";
};

recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    processVoiceCommand(transcript);
};

recognition.onend = () => {
    voiceBtn.style.boxShadow = "none";
};

recognition.onerror = (event) => {
    if (event.error === 'network') {
        speak("Napaka v omrežju.");
    }
};

function simulateHoverEffect() {
    const infoContainer = document.querySelector('.info-container');

    if (infoContainer) {
        infoContainer.classList.add('active-hover');

        setTimeout(() => {
            infoContainer.classList.remove('active-hover');
        }, 5000);
    }
}

function initLazyLoading() {
    const images = document.querySelectorAll('img.lazy');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });
    images.forEach(img => imageObserver.observe(img));
}

const emailInput = document.getElementById('reg-email');
const emailError = document.getElementById('email-error');

const passInput = document.getElementById('reg-pass');
const passError = document.getElementById('pass-error');

emailInput.addEventListener('input', () => {
    const emailValue = emailInput.value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailValue.length === 0) {
        emailError.textContent = "Obvezen vnos e-naslova.";
        emailError.style.display = 'block';
        emailInput.style.borderColor = '#ef4444';
    } else if (!emailRegex.test(emailValue)) {
        emailError.textContent = "Vnesite veljaven e-poštni naslov.";
        emailError.style.display = 'block';
        emailInput.style.borderColor = '#ef4444';
    } else {
        emailError.style.display = 'none';
        emailInput.style.borderColor = '#22c55e';
    }
});

passInput.addEventListener('input', () => {
    const passValue = passInput.value;

    if (passValue.length === 0) {
        passError.textContent = "Geslo ni vnešeno.";
        passError.style.display = 'block';
        passInput.style.borderColor = '#ef4444';
    } else if (passValue.length < 6) {
        passError.textContent = "Geslo mora imeti vsaj 6 znakov.";
        passError.style.display = 'block';
        passInput.style.borderColor = '#ef4444';
    } else {
        passError.style.display = 'none';
        passInput.style.borderColor = '#22c55e';
    }
});

window.showSettings = async function () {
    hideAllViews();
    document.getElementById('profile-view').style.display = 'block';

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${urlAuth}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (response.ok) {
            const u = data.uporabnik;
            document.getElementById('profile-email').textContent = u.email;
            getUniversities();
            console.log(allUniversities);
            allUniversities.forEach((data) => {
                if (data.id === u.university_id) {
                    document.getElementById('profile-uni').textContent = data.name;
                }
            });
            document.getElementById('profile-role').textContent = u.role;
            document.getElementById('profile-date').textContent = new Date(u.created_at).toLocaleDateString('sl-SI');
        }
    } catch (err) {
        showCustomNotification("Napaka pri nalaganju profila.", "error");
    }
};

document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${urlAuth}/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            showCustomNotification("Geslo uspešno spremenjeno!", "success");
            e.target.reset();
        } else {
            showCustomNotification("Napaka", "error");
        }
    } catch (error) {
        showCustomNotification("Napaka pri povezavi", "error");
    }
});

function showModal() {
    document.getElementById('uploadModal').style.display = 'block';

    if (isEditModal === false) {
        document.querySelector('.files-uploader').style.display = 'flex';
    }
}

function showModalSubject() {
    document.getElementById('openSubjectForm').style.display = 'block';
}

function closeModal() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('uploadForm').reset();
    document.getElementById('file-name-display').textContent = "";
    document.getElementById('image-name-display').textContent = "";
    document.getElementById('edit-id').value = "";

    const modalTitle = document.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.innerHTML = `<i class="fas fa-upload"></i> Naloži novo gradivo`;

    const submitBtn = document.querySelector('#uploadForm button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Objavi gradivo`;

    const pdfInput = document.getElementById('pdf-file');
    if (pdfInput) pdfInput.required = true;

    if (isEditModal === true) {
        isEditModal = false;
    }

    const subjectModal = document.getElementById('openSubjectForm');
    if (subjectModal) {
        subjectModal.style.display = 'none';
    }

    const subjectForm = document.getElementById('addSubjectForm');
    if (subjectForm) {
        subjectForm.reset();
    }
}

function showCustomNotification(sporocilo, tip = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const jeSuccess = tip === 'success';

    const ozadje = jeSuccess ? 'rgba(236, 253, 245, 0.95)' : 'rgba(254, 242, 242, 0.95)';
    const barvaTeksta = jeSuccess ? '#065f46' : '#991b1b';
    const rob = jeSuccess ? 'rgba(167, 243, 208, 0.7)' : 'rgba(254, 202, 202, 0.7)';
    const ikona = jeSuccess ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    const ikonaBarva = jeSuccess ? '#10b981' : '#ef4444';

    toast.style.cssText = `
        background: ${ozadje};
        color: ${barvaTeksta};
        border: 1px solid ${rob};
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 320px;
        max-width: 420px;
        transform: translateX(140%);
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
        opacity: 0;
    `;

    toast.innerHTML = `
        <i class="${ikona}" style="color: ${ikonaBarva}; font-size: 18px; shrink: 0;"></i>
        <span style="line-height: 1.4;">${sporocilo}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateX(140%)';
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 3500);
}


async function handleSubjectSubmit(event) {
    event.preventDefault();

    const subjectNameInput = document.getElementById('subjectName');
    const token = localStorage.getItem('token');

    if (!token) {
        showCustomNotification("Niste prijavljeni.", "error");
        return;
    }

    try {
        const response = await fetch('/api/v1/subject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: subjectNameInput.value.trim() })
        });

        const data = await response.json();

        if (!response.ok) {
            showCustomNotification(data.napaka || 'Napaka pri dodajanju predmeta.', "error");
            return;
        }

        const select = document.getElementById('materialSubjectSelect');
        if (select) {
            const option = document.createElement('option');
            option.value = data.id;
            option.textContent = data.name;
            select.appendChild(option);
            select.value = data.id;
        }

        showCustomNotification("Predmet uspešno dodan!", "success");
        closeModal();

    } catch (error) {
        showCustomNotification("Napaka pri povezavi s strežnikom.", "error");
    }
}


function updateFileName(input) {
    const fileName = input.files[0] ? input.files[0].name : "";
    document.getElementById('file-name-display').textContent = fileName;
}

function updateImageName(input) {
    const fileName = input.files[0] ? input.files[0].name : "";
    document.getElementById('image-name-display').textContent = fileName;
}

function getMaterialImageUrl(path) {
    if (!path) return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=500';

    let cleanPath = path.replace(/\\/g, '/');

    if (cleanPath.startsWith('uploads/')) {
        return '/' + cleanPath;
    }

    if (cleanPath.startsWith('materials/')) {
        return '/uploads/' + cleanPath;
    }

    if (!cleanPath.startsWith('/') && !cleanPath.startsWith('http')) {
        return '/uploads/materials/' + cleanPath;
    }

    return cleanPath;
}

/*document.getElementById('uploadForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const editId = document.getElementById('edit-id').value;
    const token = localStorage.getItem('token');

    const naziv = this.querySelector('[name="naziv"]').value;
    const opis = this.querySelector('[name="opis"]').value;
    const predmet = this.querySelector('[name="predmet"]').value;
    const profesor = this.querySelector('[name="profesor"]').value;

    if (!navigator.onLine) {
        const formData = new FormData(this);

        const syncTask = {
            action: editId ? 'PUT' : 'POST',
            id: editId || null,
            token: token,
            data: {
                naziv: formData.get('naziv'),
                opis: formData.get('opis'),
                predmet: formData.get('predmet'),
                profesor: formData.get('profesor'),
                pdf: formData.get('pdf'),
                slika: formData.get('slika')
            }
        };

        await dodajVSyncQueue(syncTask);

        showNotification('Nimate povezave. Gradivo in datoteke so varno shranjeni lokalno.');
        closeModal();
        return;
    }

    if (editId) {
        const editFormData = new FormData();

        editFormData.append('naziv', this.querySelector('[name="naziv"]').value);
        editFormData.append('opis', this.querySelector('[name="opis"]').value);
        editFormData.append('predmet', this.querySelector('[name="predmet"]').value);
        editFormData.append('profesor', this.querySelector('[name="profesor"]').value);

        try {
            const response = await fetch(`http://localhost:3000/api/v1/materials/${editId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: editFormData
            });

            if (response.ok) {
                showNotification("Gradivo in datoteke uspešno posodobljene!");
                closeModal();
                location.reload();
                isEditModal = false;
            } else {
                const err = await response.json();
                showNotification(err.napaka || "Napaka pri posodabljanju.", true);
            }
        } catch (err) {
            showNotification("Težava s povezavo.", true);
        }
    } else {
        const formData = new FormData();
        formData.append('naziv', naziv);
        formData.append('opis', opis);
        formData.append('predmet', predmet);
        formData.append('profesor', profesor);

        const pdfInput = this.querySelector('input[type="file"]:not([accept*="image"])');
        const slikaInput = this.querySelector('input[accept*="image"]');

        if (pdfInput && pdfInput.files[0]) {
            formData.append('pdf', pdfInput.files[0]);
        }

        if (slikaInput && slikaInput.files[0]) {
            formData.append('slika', slikaInput.files[0]);
        }

        try {
            const response = await fetch('http://localhost:3000/api/v1/materials/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showNotification("Gradivo uspešno naloženo!");
                closeModal();
                this.reset();
                location.reload();
            } else {
                showNotification(data.napaka || "Napaka pri nalaganju.", true);
            }
        } catch (err) {
            console.error("Napaka:", err);
            showNotification("Povezava s strežnikom ni uspela.", true);
        }
    }
});*/

document.getElementById('uploadForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const editId = document.getElementById('edit-id').value;
    const token = localStorage.getItem('token');

    const subjectId = document.getElementById('materialSubjectSelect').value;
    if (!subjectId) {
        showNotification("Prosimo, izberite predmet iz seznama.", "error");
        return;
    }

    const formData = new FormData(this);
    formData.set('predmet', subjectId);

    if (!navigator.onLine) {
        const pdfInput = document.getElementById('pdf-file');
        const slikaInput = document.getElementById('image-file');

        const dataObj = {
            naziv: formData.get('naziv') || "",
            opis: formData.get('opis') || "",
            predmet: subjectId,
            profesor: formData.get('profesor') || "",
            pdf: (pdfInput && pdfInput.files[0]) ? pdfInput.files[0] : null,
            slika: (slikaInput && slikaInput.files[0]) ? slikaInput.files[0] : null
        };

        const syncTask = {
            action: editId ? 'PUT' : 'POST',
            id: editId || null,
            token: token,
            data: dataObj
        };

        try {
            await dodajVSyncQueue(syncTask);
            showNotification('Spletna povezava ni na voljo. Podatki so shranjeni lokalno.');
            closeModal();
        } catch (err) {
            console.error("Napaka pri shranjevanju v IndexedDB:", err);
            showNotification("Napaka pri lokalnem shranjevanju.", true);
        }
        return;
    }

    const url = editId ? `${urlMaterials}/${editId}` : `${urlMaterials}/upload`;
    const method = editId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (response.ok) {
            showCustomNotification(editId ? "Posodobljeno!" : "Naloženo!", "success");
            closeModal();
            naloziPodatke();
        } else {
            const err = await response.json();
            showCustomNotification(err.napaka || "Napaka pri strežniku", "error");
        }
    } catch (err) {
        showCustomNotification("Težava s povezavo!", "error")
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('subjectSearchInput');
    const dropdownList = document.getElementById('subjectDropdownList');

    if (searchInput) {
        searchInput.addEventListener('focus', async () => {
            if (allSubjects.length === 0) {
                await refreshSubjects();
            }
            buildDropdown(allSubjects);
            dropdownList.style.display = 'block';
        });

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allSubjects.filter(s => s.name.toLowerCase().includes(query));
            buildDropdown(filtered);
            dropdownList.style.display = 'block';

            if (query === '') {
                document.getElementById('materialSubjectSelect').value = '';
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdownList.contains(e.target)) {
                dropdownList.style.display = 'none';
            }
        });
    }

    if (localStorage.getItem('token')) {
        refreshSubjects();
    }
});



window.onclick = function (event) {
    const modal = document.getElementById('uploadModal');
    if (event.target == modal) {
        closeModal();
    }
}

function switchAuth(type) {
    const loginCont = document.getElementById('login-container');
    const regCont = document.getElementById('register-container');

    if (type === 'register') {
        loginCont.style.display = 'none';
        regCont.style.display = 'block';
    } else {
        loginCont.style.display = 'block';
        regCont.style.display = 'none';
    }
}

function filterData(type, element) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    let filtrirano;
    if (type === 'my') {
        filtrirano = all_data.filter(item => item.korisnikId === user.id);
    } else {
        filtrirano = all_data;
    }

    osveziPrikaz({ gradiva: filtrirano });

    if (filtrirano.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">
            <i class="fas fa-folder-open" style="font-size: 3rem; margin-bottom: 15px; display: block; opacity: 0.5;"></i>
            Nimate še naloženih lastnih gradiv.
        </div>`;
    }
}

function enterApp() {
    document.getElementById('login').style.display = 'none';
    document.querySelector('.navbar').style.display = 'flex';
    document.querySelector('.container').style.display = 'block';

    if (typeof naloziPodatke === "function") {
        naloziPodatke();
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.email) {
        document.getElementById('nav-username').textContent = user.email.split('@')[0];
    }

    if (user && user.role === 'admin') {
        document.querySelectorAll('.statistic-button')[0].style.display = 'block';
        document.querySelectorAll('.statistic-button')[0].style.display = 'flex';
        document.querySelectorAll('.statistic-button')[0].style.gap = '10px';
    }
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    const response = await fetch(`${urlAuth}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: email,
            password: password
        })
    });

    const data = await response.json();

    if (response.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.uporabnik));

        enterApp();
        clearData();
    } else {
        showCustomNotification("Napaka pri prijavi", "error");
    }
});

document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const university = document.getElementById('universityRegisterSelect').value;
    const password = document.getElementById('reg-pass').value;

    const response = await fetch(`${urlAuth}/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: email,
            password: password,
            university: university
        })
    });

    const data = await response.json();

    if (response.ok) {
        switchAuth('login');
        clearData();
    } else {
        alert(data.napaka || "Napaka pri prijavi");
        showCustomNotification(data.napaka || "Napaka pri prijavi.", "error");
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        enterApp();
    }
});

function clearData() {
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-pass').value = '';
    document.getElementById('login-email').value = '';
    document.getElementById('login-pass').value = '';
}

function toggleProfileMenu() {
    document.getElementById("profileMenu").classList.toggle("show");
}

window.onclick = function (event) {
    if (!event.target.closest('.profile-dropdown')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains('show')) {
                dropdowns[i].classList.remove('show');
            }
        }
    }
}

function logout() {
    if (confirm("Se res želite odjaviti?")) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        location.reload();
    }
}

function checkButtonActive() {
    const buttons = document.querySelectorAll('.pagination-button');
    buttons.forEach(button => button.classList.remove('active'));
}

function pagnateData(data, pageSize) {
    const pages = Math.ceil(data.length / pageSize);
    pagnationDiv.innerHTML = '';
    for (let i = 0; i < pages; i++) {
        const button = document.createElement('button');
        button.className = 'pagination-button';
        button.textContent = i + 1;
        button.onclick = () => {
            const start = i * pageSize;
            const end = start + pageSize;
            const paginatedItems = data.slice(start, end);
            checkButtonActive();
            button.classList.add('active');
            grid.innerHTML = '';
            displayCards({ gradiva: paginatedItems });
            onClickPagination(start, end, data.length);
            initLazyLoading();
        };
        pagnationDiv.appendChild(button);
    }
}

function onClickPagination(start, end, dataLength) {
    const pagDiv = document.getElementById('pagination-info');
    if (pagDiv) {
        pagDiv.textContent = `Prikazujem ${start + 1} - ${Math.min(end, dataLength)} od ${dataLength} gradiv.`;
    }
}

async function naloziPodatke() {
    const cached = localStorage.getItem('gradiva_cache');
    if (cached) {
        const parsed = JSON.parse(cached);
        all_data = parsed.gradiva;
        osveziPrikaz(parsed);
    }

    try {
        const response = await fetch(urlMaterials);
        const data = await response.json();
        localStorage.setItem('gradiva_cache', JSON.stringify(data));
        all_data = data.gradiva;
        osveziPrikaz(data);
    } catch (error) {
        console.error('Offline mode:', error);
    }
}

function osveziPrikaz(data) {
    grid.innerHTML = '';
    pagnateData(data.gradiva, 8);
    const buttons = document.querySelectorAll('.pagination-button');
    if (buttons.length > 0) buttons[0].classList.add('active');
    displayCards({ gradiva: data.gradiva.slice(0, 8) });
    onClickPagination(0, 8, data.gradiva.length);
    initLazyLoading();
}

function getMaterialImageUrl(imagePath) {
    if (!imagePath) return null;
    if (imagePath.startsWith('http') || imagePath.startsWith('data:') || imagePath.startsWith('/')) {
        return imagePath;
    }
    return `/uploads/materials/${imagePath}`;
}

function displayCards(data) {
    grid.innerHTML = '';
    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    data.gradiva.forEach(item => {
        const card = document.createElement('div');
        const imageUrl = getMaterialImageUrl(item.slikaPath || item.slika);
        const itemId = item.id;

        const finalSrc = imageUrl ? imageUrl : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

        const canManage = currentUser && (currentUser.id === item.korisnikId || currentUser.role === 'admin');
        const actionsHtml = canManage ? `
                    <div class="card-footer" style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="btn-add" onclick="event.stopPropagation(); openEditModal('${itemId}')" style="flex-grow: 1;">Uredi</button>
                        <button class="btn-delete" onclick="event.stopPropagation(); izbrisiMaterial('${itemId}')" style="background: #fee2e2; color: #ef4444; border: none; padding: 10px; border-radius: 10px; cursor: pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>` : '';

        card.className = 'card';
        card.setAttribute('data-id', itemId);
        card.innerHTML = `
                <div class="card-image-wrapper">
                    <span class="badge">${item.dostupno ? 'Na zalogi' : 'Ni na voljo'}</span>
                    <img
                        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                        data-src="${finalSrc}"
                        alt="${item.naziv}"
                        class="card-image lazy"
                        onerror="this.onerror=null; this.removeAttribute('data-src'); this.classList.remove('lazy'); this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';"
                    >
                </div>
                <div class="card-content" style="width: 100%;">
                    <h3 class="card-title">${item.naziv}</h3>
                    <div class="card-price">${item.cena} €</div>
                    <p class="card-description">${item.opis ? item.opis.substring(0, 60) + '...' : 'Brez opisa.'}</p>
                    ${actionsHtml}
                </div>
            `;
        card.onclick = () => prikaziPodrobnosti(itemId);
        grid.appendChild(card);
    });
    initLazyLoading();
}

window.openEditModal = async function (id) {
    const token = localStorage.getItem('token');
    const files_uploader = document.querySelector('.files-uploader');
    if (files_uploader) files_uploader.style.display = 'none';

    try {
        const response = await fetch(`http://localhost:3000/api/v1/materials/${id}`);
        const data = await response.json();
        const item = data.gradivo;

        if (!item) return;

        document.getElementById('edit-id').value = item.id;

        const form = document.getElementById('uploadForm');
        form.querySelector('[name="naziv"]').value = item.naziv || "";
        form.querySelector('[name="opis"]').value = item.opis || "";
        form.querySelector('[name="predmet"]').value = item.predmet || "";
        form.querySelector('[name="profesor"]').value = item.profesor || "";

        const modalTitle = document.querySelector('.modal-header h3');
        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fas fa-edit"></i> Uredi gradivo`;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = `<i class="fas fa-save"></i> Shrani spremembe`;
        }

        const pdfInput = document.getElementById('pdf-file');
        if (pdfInput) pdfInput.required = false;

        isEditModal = true;
        showModal();
    } catch (err) {
        console.error("Napaka:", err);
        showNotification("Napaka pri pridobivanju podatkov.", true);
    }
};

window.prikaziPodrobnosti = async function (id) {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('profile-view').style.display = 'none';
    const detailView = document.getElementById('material-detail-view');
    detailView.style.display = 'block';

    try {
        const response = await fetch(`${urlMaterials}/${id}`);
        const data = await response.json();
        const item = data.gradivo;
        console.log(data);

        document.getElementById('detail-title').textContent = item.naziv;
        document.getElementById('detail-image').src = getMaterialImageUrl(item.slikaPath || item.slika);
        document.getElementById('detail-price').textContent = `${item.cena} €`;
        document.getElementById('detail-desc').textContent = item.opis || "Ni opisa.";
        document.getElementById('detail-views').innerHTML = `<i class="fas fa-eye"></i> ${item.brojPregledavanja || 0}`;

        const btnDownload = document.getElementById('download-button');
        if (btnDownload) {
            btnDownload.onclick = () => downloadFile(id);
        }

        loadReviews(id);

    } catch (err) {
        console.error("Napaka pri nalaganju podrobnosti", err);
    }
};

async function izbrisiMaterial(id) {
    if (!confirm('Res želiš izbrisati to gradivo?')) return;
    const token = localStorage.getItem('token');

    if (!navigator.onLine) {
        await dodajVSyncQueue({
            action: 'DELETE',
            id: id,
            token: token,
            data: null
        });

        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) card.remove();

        showNotification('Izbris bo izveden ob vrnitvi povezave.');
        return;
    }

    try {
        const response = await fetch(`${urlMaterials}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showNotification('Izbrisano.');
            naloziPodatke();
        } else {
            showNotification('Napaka pri brisanju na strežniku.', true);
        }
    } catch (error) {
        showNotification('Napaka pri povezavi.', true);
    }
}

window.showStatistics = async function () {
    hideAllViews();
    document.getElementById('statistics-view').style.display = 'block';

    const statsView = document.getElementById('statistics-view');
    statsView.style.display = 'block';

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${urlMaterials}/statistics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const stats = await response.json();
            document.getElementById('stat-materials').textContent = stats.skupnoGradiva || 0;
            document.getElementById('stat-rating').textContent = stats.povprečnaOcena || "0.00";
            document.getElementById('stat-purchases').textContent = stats.skupnoPrenosi || 0;
            document.getElementById('stat-reviews').textContent = stats.skupnoPregledi || 0;

            console.log(stats);

            const subjectsList = document.getElementById('stat-subjects-list');
            subjectsList.innerHTML = stats.predmeti.map(p =>
                `<li><i class="fas fa-chevron-right"></i> ${p}</li>`
            ).join('');

            const professorsList = document.getElementById('stat-professors-list');
            professorsList.innerHTML = stats.profesorji.map(prof =>
                `<li><i class="fas fa-user-tie"></i> ${prof}</li>`
            ).join('');
        }
    } catch (err) {
        console.error("Napaka pri nalaganju statistike:", err);
    }
};

window.backToShop = function () {
    hideAllViews();
    document.querySelector('.container').style.display = 'block';
};

async function downloadFile(id) {
    const token = localStorage.getItem('token');
    const url = `http://localhost:3000/api/v1/materials/${id}/download`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.napaka || 'Napaka pri prenosu');
        }

        const blob = await response.blob();

        const downloadUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = downloadUrl;

        link.setAttribute('download', `gradivo_${id}.pdf`);

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        showCustomNotification(error.message, "error");
    }
}

function showNotification(text, isError = false) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(isError ? "Napaka" : "Uspešno", { body: text });
    } else {
        alert(text);
    }
}

window.addEventListener('online', async () => {
    const db = await dbPromise;
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');

    const tasks = await new Promise((res) => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result);
    });

    if (!tasks || tasks.length === 0) return;

    for (const task of tasks) {
        if (task.action !== 'DELETE' && !task.data) continue;

        let url = (task.action === 'POST') ? `${urlMaterials}/upload` : `${urlMaterials}/${task.id}`;

        let options = {
            method: task.action,
            headers: { 'Authorization': `Bearer ${task.token}` }
        };

        if (task.action !== 'DELETE') {
            const formData = new FormData();
            formData.append('naziv', task.data.naziv);
            formData.append('opis', task.data.opis);
            formData.append('predmet', task.data.predmet);
            formData.append('profesor', task.data.profesor);

            if (task.data.pdf instanceof Blob) {
                formData.append('pdf', task.data.pdf);
            }
            if (task.data.slika instanceof Blob) {
                formData.append('slika', task.data.slika);
            }

            options.body = formData;
        }

        try {
            const res = await fetch(url, options);
            if (res.ok) console.log(`Sinhronizirano: ${task.action}`);
        } catch (err) {
            console.error("Napaka pri sinhronizaciji:", err);
        }
    }

    const clearTx = db.transaction('sync_queue', 'readwrite');
    clearTx.objectStore('sync_queue').clear();
    showNotification('Sinhronizacija končana.');
    naloziPodatke();
});

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        naloziPodatke();
    }
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('searchInput')?.focus();
    }
});

const searchInput = document.getElementById('searchInput');

searchInput.addEventListener('input', async (e) => {
    searchFunction(e);
});

function showPagnation() {
    const pagnation = document.getElementsByClassName('pagination-container');
    pagnation[0].style.display = 'block';
    const pag = document.getElementById('pagination-info');
    pag.style.textAlign = 'center';
    pag.style.marginBottom = '10px';
    return;
}

async function searchFunction(e) {
    const q = e.target.value.trim();
    const pagnation = document.getElementsByClassName('pagination-container');

    if (pagnation.length > 0) {
        pagnation[0].style.display = 'none';
        const container = document.getElementById('materials-grid');
        container.style.marginBottom = '20px';
    }

    if (q.length < 2) {
        pagnation[0].style.display = 'block';
        const pag = document.getElementById('pagination-info');
        pag.style.textAlign = 'center';
        pag.style.marginBottom = '10px';
        refreshDisplay({ materials: all_data });
        return;
    }

    if (navigator.onLine) {
        try {
            const response = await fetch(`${urlMaterials}/search?q=${encodeURIComponent(q)}`);

            if (response.ok) {
                const data = await response.json();
                const items = data.results || data.rezultati;
                showSearchResults(items);
            }
        } catch (error) {
            console.error("Napaka v API-ju, iskanje lokalno:", error);
            searchLocally(q);
        }
    } else {
        searchLocally(q);
    }
}

function searchLocally(q) {
    const term = q.toLowerCase();
    const filtered = all_data.filter(item =>
        (item.naziv && item.naziv.toLowerCase().includes(term)) ||
        (item.opis && item.opis.toLowerCase().includes(term))
    );
    showSearchResults(filtered);
}

function hideAllViews() {
    const viewIds = [
        'profile-view',
        'statistics-view',
        'material-detail-view',
        'login'
    ];

    viewIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const mainContainer = document.querySelector('.container:not(#profile-view):not(#statistics-view):not(#material-detail-view)');
    if (mainContainer) mainContainer.style.display = 'none';
}

function showSearchResults(results) {
    grid.innerHTML = '';

    if (results && results.length > 0) {
        pagnateData(results, 8);
        displayCards({ gradiva: results.slice(0, 8) });
        onClickPagination(0, 8, results.length);
    } else {
        grid.innerHTML = '<p>Ni podatkov za vaš iskalni niz.</p>';
        pagnationDiv.innerHTML = '';
    }
    initLazyLoading();
}

async function loadReviews(materialId) {
    currentMaterialId = materialId;
    const reviewsList = document.getElementById('reviews-list');
    const avgDisplay = document.getElementById('average-rating-display');
    const totalDisplay = document.getElementById('total-reviews-display');

    if (!reviewsList) return;
    reviewsList.innerHTML = 'Nalaganje mnenj...';

    try {
        const response = await fetch(`/api/v1/reviews/material/${materialId}`);
        if (response.ok) {
            const data = await response.json();

            avgDisplay.textContent = `${data.stats.averageRating ? data.stats.averageRating.toFixed(2) : '0.00'} ★`;
            totalDisplay.textContent = `(${data.stats.totalReviews} mnenj)`;

            reviewsList.innerHTML = '';
            if (data.reviews.length === 0) {
                reviewsList.innerHTML = '<p style="color: #64748b; font-style: italic;">Za to gradivo še ni ocen. Bodite prvi!</p>';
                return;
            }

            data.reviews.forEach(review => {
                const reviewDiv = document.createElement('div');
                reviewDiv.style = "border-bottom: 1px solid #f1f5f9; padding: 15px;";
                reviewDiv.classList.add('card');

                const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

                const currentUid = getUserIdFromToken();
                const isOwner = currentUid && (String(currentUid) === String(review.user_id));

                console.log(`Review ID: ${review.id}, UserID iz review: ${review.user_id}, Current UID: ${currentUid}, IsOwner: ${isOwner}`);

                const deleteButtonHtml = isOwner ? `
                    <button class="btn-delete" onclick="deleteReview(${review.id})" 
                        style="background: #fee2e2; color: #ef4444; border: none; padding: 10px; border-radius: 10px; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : '';

                reviewDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong style="color: #334155;">${review.user_email || 'Uporabnik'}</strong>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <span style="color: #f59e0b; font-weight: bold;">${stars}</span>
                            ${deleteButtonHtml}
                        </div>
                    </div>
                    <p style="margin: 0; color: #475569;">${review.comment || '<span style="color: #94a3b8; font-style: italic;">Brez komentarja</span>'}</p>
                    <small style="color: #94a3b8;">${new Date(review.created_at).toLocaleDateString('sl-SI')}</small>
                `;
                reviewsList.appendChild(reviewDiv);
            });
        }
    } catch (error) {
        console.error("Napaka pri nalaganju recenzij:", error);
        reviewsList.innerHTML = 'Ni mnenj.';
    }
}

document.getElementById('addReviewForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
        alert("Za ocenjevanje gradiva morate biti prijavljeni!");
        showCustomNotification("Za ocenjevanje gradiva morate biti prijavljeni!", "success");
        return;
    }

    const rating = document.getElementById('review-rating').value;
    const comment = document.getElementById('review-comment').value;

    console.log("Šaljem recenziju za gradivo ID:", currentMaterialId, "Ocena:", rating);

    try {
        const response = await fetch('/api/v1/reviews', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                materialId: parseInt(currentMaterialId),
                rating: parseInt(rating),
                comment: comment.trim()
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            showCustomNotification(`Napaka (${response.status}): ${errorData.napaka || 'Not Found'}`, "error");
            return;
        }

        const data = await response.json();

        document.getElementById('review-comment').value = '';
        showCustomNotification("Mnenje uspešno oddano.", "success");
        loadReviews(currentMaterialId);

    } catch (error) {
        console.error("Mrežna napaka pri pošiljanju recenzije:", error);
        showCustomNotification("Napaka na strežniku", "error");
    }
});

async function deleteReview(reviewId) {
    if (!confirm("Ali ste prepričani, da želite izbrisati to mnenje?")) {
        return;
    }

    try {
        const response = await fetch(`/api/v1/reviews/${reviewId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            showCustomNotification("Mnenje uspešno izbrisano", "success");

            if (typeof currentMaterialId !== 'undefined') {
                loadReviews(currentMaterialId);
            }
        } else {
            const data = await response.json();
            showCustomNotification(data.napaka || "Napaka pri brisanju.", "error");
        }
    } catch (error) {
        console.error("Napaka:", error);
        showCustomNotification("Sistemska napaka pri brisanju.", "error");
    }
}

function getUserIdFromToken() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload).id;
    } catch (e) {
        console.error("Greška pri dekodiranju tokena:", e);
        return null;
    }
}

window.addEventListener('online', () => {
    document.body.style.filter = "none";
    showNotification("Povezava vzpostavljena. Sinhronizacija...");
});

window.addEventListener('offline', () => {
    document.body.style.filter = "grayscale(0.5)";
    showNotification("Ste brez povezave. Delo poteka v omejenem načinu.", true);
});

async function dodajVSyncQueue(opravilo) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const request = store.add(opravilo);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function refreshDisplay(data) {
    const items = data.materials || data.gradiva || [];
    grid.innerHTML = '';
    pagnateData(items, 8);
    displayCards({ gradiva: items.slice(0, 8) });
    onClickPagination(0, 8, items.length);
    initLazyLoading();
}

if ("Notification" in window) {
    Notification.requestPermission();
}

naloziPodatke();