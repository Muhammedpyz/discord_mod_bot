const fs = require('fs');
const path = require('path');

const cacheFile = path.join(__dirname, '..', 'spamCache.json');

class SpamCache {
    constructor() {
        this.cache = new Map();
        this.dirty = false;
        this.load();
        
        setInterval(() => {
            if (this.dirty) {
                this.save();
                this.dirty = false;
            }
        }, 10000);
    }

    load() {
        if (fs.existsSync(cacheFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                for (const key in data) {
                    this.cache.set(key, data[key]);
                }
            } catch (e) {
                console.error('SpamCache yukleme hatasi:', e);
            }
        }
    }

    save() {
        try {
            const obj = Object.fromEntries(this.cache);
            fs.writeFileSync(cacheFile, JSON.stringify(obj), 'utf8');
        } catch (e) {
            console.error('SpamCache kaydetme hatasi:', e);
        }
    }

    get(key) { 
        return this.cache.get(key); 
    }

    set(key, val) { 
        this.cache.set(key, val); 
        this.dirty = true;
        return this;
    }

    delete(key) {
        const res = this.cache.delete(key);
        if (res) this.dirty = true;
        return res;
    }

    entries() { return this.cache.entries(); }
    [Symbol.iterator]() { return this.cache[Symbol.iterator](); }
}

module.exports = new SpamCache();
