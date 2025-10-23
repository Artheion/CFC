const fs = require('fs');
const path = require('path');

// Directories to clean
const dirs = [
  './src/pages',
  './src/components', 
  './src/utils',
  './src/store',
  './src/hooks'
];

// Patterns to remove (keep console.error)
const patterns = [
  /\s*console\.log\([^)]*\);?\s*\n/g,
  /\s*console\.info\([^)]*\);?\s*\n/g,
  /\s*console\.warn\([^)]*\);?\s*\n/g,
  /\s*console\.debug\([^)]*\);?\s*\n/g,
];

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  patterns.forEach(pattern => {
    content = content.replace(pattern, '');
  });
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Cleaned: ${filePath}`);
    return true;
  }
  return false;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let cleaned = 0;
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      cleaned += walkDir(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      if (cleanFile(filePath)) cleaned++;
    }
  });
  
  return cleaned;
}

let totalCleaned = 0;
dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`\nCleaning ${dir}...`);
    totalCleaned += walkDir(dir);
  }
});

console.log(`\n✓ Done! Cleaned ${totalCleaned} files`);
