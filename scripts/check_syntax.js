const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.cwd();
const files = [];
function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|json|wxml|wxss)$/.test(entry.name)) files.push(full);
  });
}
walk(path.join(root, 'miniprogram'));
files.push(path.join(root, 'project.config.json'));

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('`n')) throw new Error(`${file} contains literal backtick-n`);
  if (source.includes('\uFFFD')) throw new Error(`${file} contains Unicode replacement character`);
  if (file.endsWith('.json')) {
    JSON.parse(source);
  } else if (file.endsWith('.js')) {
    new vm.Script(source, { filename: file });
  }
}
console.log(`checked ${files.length} miniprogram source files`);
