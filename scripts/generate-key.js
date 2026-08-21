import crypto from 'node:crypto';

const machineId = process.argv[2];
const dateStr = process.argv[3] || '20301231'; // Default: Dec 31, 2030

if (!machineId) {
  console.log('Usage: npm run key <MACHINE_ID> [YYYYMMDD]');
  console.log('Example: npm run key 40bb4e73c5cd2ce04853b53c799b8ce6c8f58d34c38a51a3a82ef98e2472ea1c 20301231');
  process.exit(1);
}

const SECRET_SALT = 'MEDFLOW-OFFLINE-LICENSE-2024-X99';
const hash = crypto.createHash('sha256').update(machineId + dateStr + SECRET_SALT).digest('hex').toUpperCase();
const key = `${dateStr}-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;

console.log('\n===========================================');
console.log('            BUVORA LICENSE GENERATOR       ');
console.log('===========================================');
console.log(' Machine ID  :', machineId);
console.log(' Expiry Date :', `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`);
console.log(' License Key :', key);
console.log('===========================================\n');
