import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config();

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!saJson) {
  console.error("No FIREBASE_SERVICE_ACCOUNT found");
  process.exit(1);
}

const credentials = JSON.parse(saJson);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credentials)
  });
}

const db = admin.firestore();

async function run() {
  console.log("Fetching logs...");
  const snapshot = await db.collection("server_activity_logs").get();
  
  interface Log {
      id: string;
      user: string;
      time: string;
      file: string;
      fullPath: string;
  }

  const logs: Log[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));
  console.log(`Fetched ${logs.length} logs total`);

  // Today from user screenshot is 18.05.2026, let's look at 2026-05-18 logs
  const today = "2026-05-18";
  const dayLogs = logs.filter(log => log.time && log.time.startsWith(today) && !log.file.toLowerCase().endsWith('.lnk'));
  console.log(`Found ${dayLogs.length} valid logs for ${today}`);

  const userMap = new Map<string, Log[]>();
  for (const log of dayLogs) {
      if (!userMap.has(log.user)) userMap.set(log.user, []);
      userMap.get(log.user)!.push(log);
  }

  const sortedUsers = Array.from(userMap.keys()).sort((a, b) => userMap.get(b)!.length - userMap.get(a)!.length);
  const topUsers = sortedUsers.slice(0, 3);
  console.log("Top 3 users:", topUsers);

  for (const user of topUsers) {
      console.log(`\n=================================`);
      console.log(`Analyzing user: ${user}`);
      const userLogs = userMap.get(user)!;
      userLogs.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      const gaps: number[] = [];
      for (let i = 1; i < userLogs.length; i++) {
          const diffMs = new Date(userLogs[i].time).getTime() - new Date(userLogs[i-1].time).getTime();
          gaps.push(diffMs / 1000 / 60); // in minutes
      }

      gaps.sort((a, b) => a - b);
      if (gaps.length === 0) continue;
      
      console.log(`  Total events: ${userLogs.length}, Gaps count: ${gaps.length}`);
      console.log(`  Average gap: ${(gaps.reduce((a,b)=>a+b,0)/gaps.length).toFixed(1)} min`);
      console.log(`  Median gap (50%): ${gaps[Math.floor(gaps.length/2)].toFixed(1)} min`);
      console.log(`  90th percentile gap: ${gaps[Math.floor(gaps.length*0.9)].toFixed(1)} min`);
      console.log(`  95th percentile gap: ${gaps[Math.floor(gaps.length*0.95)].toFixed(1)} min`);
      console.log(`  Max gap: ${gaps[gaps.length-1].toFixed(1)} min`);
      
      console.log(`\n  --- Distribution ---`);
      console.log(`  Gaps <= 5m: ${gaps.filter(g => g <= 5).length}`);
      console.log(`  Gaps 5m-15m: ${gaps.filter(g => g > 5 && g <= 15).length}`);
      console.log(`  Gaps 15m-30m: ${gaps.filter(g => g > 15 && g <= 30).length}`);
      console.log(`  Gaps 30m-60m: ${gaps.filter(g => g > 30 && g <= 60).length}`);
      console.log(`  Gaps > 60m: ${gaps.filter(g => g > 60).length}`);
      console.log(`  Gaps > 120m: ${gaps.filter(g => g > 120).length}`);
  }
}

run().catch(console.error);
