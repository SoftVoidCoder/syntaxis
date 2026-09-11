
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function findUser() {
    console.log('Searching for user "art"...');
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', 'art').get();

        if (snapshot.empty) {
            console.log('No matching user found.');
            return;
        }

        snapshot.forEach(doc => {
            console.log('FOUND USER:', doc.id, doc.data());
        });
    } catch (error) {
        console.error('Error finding user:', error);
    }
}

findUser();
