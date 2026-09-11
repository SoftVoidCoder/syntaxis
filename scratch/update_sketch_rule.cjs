// Update sketch cost rule in Firebase to 350₽
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (getApps().length === 0) {
    initializeApp({ credential: cert(SA) });
}
const db = getFirestore();

async function main() {
    // Find the sketch cost rule
    const rulesSnap = await db.collection('conveyor_rules').get();
    const rules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const sketchRule = rules.find(r => r.name === 'Стоимость эскиза');
    if (!sketchRule) {
        console.error('Rule "Стоимость эскиза" not found!');
        return;
    }
    
    console.log('BEFORE:', sketchRule.content);
    
    const newContent = 'Стоимость разработки эскиза (чертежа) — это разовая услуга. Она добавляется ровно 1 раз на каждый уникальный вид/наименование изделия (на каждую отдельную строку в смете), независимо от количества штук в этой позиции. Составляет 350р.';
    
    await db.collection('conveyor_rules').doc(sketchRule.id).update({ content: newContent });
    
    console.log('AFTER:', newContent);
    console.log('\n✅ Rule updated successfully!');
}

main().catch(console.error);
