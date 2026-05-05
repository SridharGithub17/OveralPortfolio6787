const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const sourceDbPath = path.join(projectRoot, 'portfolio.db');
const backupsDir = path.join(projectRoot, 'backups');

const pad = (value) => String(value).padStart(2, '0');

const buildTimestamp = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

const ensureSourceExists = () => {
  if (!fs.existsSync(sourceDbPath)) {
    throw new Error(`SQLite database not found at ${sourceDbPath}`);
  }
};

const ensureBackupsDir = () => {
  fs.mkdirSync(backupsDir, { recursive: true });
};

const copyIfExists = (sourcePath, targetPath) => {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
};

const run = () => {
  ensureSourceExists();
  ensureBackupsDir();

  const timestamp = buildTimestamp(new Date());
  const dbBackupPath = path.join(backupsDir, `portfolio-${timestamp}.db`);
  const walBackupPath = path.join(backupsDir, `portfolio-${timestamp}.db-wal`);
  const shmBackupPath = path.join(backupsDir, `portfolio-${timestamp}.db-shm`);

  fs.copyFileSync(sourceDbPath, dbBackupPath);
  copyIfExists(`${sourceDbPath}-wal`, walBackupPath);
  copyIfExists(`${sourceDbPath}-shm`, shmBackupPath);

  console.log(JSON.stringify({
    ok: true,
    database: dbBackupPath,
    wal: fs.existsSync(`${sourceDbPath}-wal`) ? walBackupPath : null,
    shm: fs.existsSync(`${sourceDbPath}-shm`) ? shmBackupPath : null,
  }, null, 2));
};

try {
  run();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
