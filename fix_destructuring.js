const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        if (file.includes('node_modules') || file.includes('.git')) return;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else {
            if (file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walkDir('/root/discord_mod_bot');
let totalFixed = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;
    
    // Pattern: const [varName] = await conn.query( OR pool.query(
    // We only want to match single variables inside brackets for db queries
    content = content.replace(/const\s+\[\s*([a-zA-Z0-9_]+)\s*\]\s*=\s*await\s+(conn|pool)\.query/g, "const $1 = await $2.query");
    
    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Fixed ${file}`);
        totalFixed++;
    }
});

console.log(`Total files fixed: ${totalFixed}`);
