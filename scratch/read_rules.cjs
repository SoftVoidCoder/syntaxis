// Read all conveyor rules directly via Firebase Admin SDK
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (getApps().length === 0) {
    initializeApp({ credential: cert(SA) });
}
const db = getFirestore();

async function main() {
    const [catSnap, rulesSnap] = await Promise.all([
        db.collection('conveyor_rule_categories').get(),
        db.collection('conveyor_rules').get()
    ]);
    
    const categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const catMap = {};
    categories.forEach(c => {
        const parent = categories.find(p => p.id === c.parentId);
        catMap[c.id] = { name: c.name, parentName: parent?.name || null, fullPath: parent ? `${parent.name} / ${c.name}` : c.name };
    });
    
    console.log('\n=== КАТЕГОРИИ ===\n');
    categories.filter(c => !c.parentId).forEach(root => {
        console.log(`[ROOT] ${root.name}`);
        categories.filter(c => c.parentId === root.id).forEach(child => {
            const cr = rules.filter(r => r.categoryId === child.id).length;
            console.log(`  +-- ${child.name} (${cr} правил)`);
            categories.filter(c => c.parentId === child.id).forEach(gc => {
                const gr = rules.filter(r => r.categoryId === gc.id).length;
                console.log(`      +-- ${gc.name} (${gr} правил)`);
            });
        });
    });
    
    console.log('\n\n=== ВСЕ ПРАВИЛА ===\n');
    rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    rules.forEach((rule, i) => {
        const cat = catMap[rule.categoryId] || { fullPath: '(без категории)' };
        console.log(`--- #${i + 1} "${rule.name}" | Приоритет: ${rule.priority}/10 | ${cat.fullPath}`);
        console.log((rule.content || '(пусто)').split('\n').map(l => `    ${l}`).join('\n'));
        console.log('');
    });
    
    console.log(`\nИТОГО: ${categories.length} категорий, ${rules.length} правил`);
}

main().catch(console.error);
