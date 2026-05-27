const { createUser, updateUserRole, getUserByEmail } = require('./models/userStore');

async function postaviAdmina() {
    const email = 'admin@studyhub.si';
    const geslo = 'admin123';
    const uniId = 1; 

    try {        
        const rezultat = await createUser(email, geslo, uniId);

        if (rezultat.error) {
            console.error("Napaka:", rezultat.error);
        }

        const user = await getUserByEmail(email);

        if (user) {
            await updateUserRole(user.id, 'admin');
        }

    } catch (error) {
        console.error("Napaka:", error);
    } finally {
        process.exit();
    }
}

postaviAdmina();