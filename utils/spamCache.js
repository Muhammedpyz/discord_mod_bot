const fs = require('fs').promises;
const path = require('path');

const cacheFile = path.join(__dirname, '..', 'spamCache.json');
const oldRead = require('fs');

class SpamCache {
    constructor() {
        this.cache = new Map();
        this.dirty = false;
        this.saving = false;
        this.loadSync();
        
        setInterval(() => {
            if (this.dirty && !this.saving) {
                this.save();
                this.dirty = false;
            }
        }, 10000);
    }

    loadSync() {
        if (oldRead.existsSync(cacheFile)) {
            try {
                const data = JSON.parse(oldRead.readFileSync(cacheFile, 'utf8'));
                for (const key in data) {
                    this.cache.set(key, data[key]);
                }
            } catch (e) {
                console.error('SpamCache yukleme hatası:', e);
            }
        }
    }

    async save() {
        if (this.saving) return;
        this.saving = true;
        try {
            const obj = Object.fromEntries(this.cache);
            await fs.writeFile(cacheFile, JSON.stringify(obj), 'utf8');
        } catch (e) {
            console.error('SpamCache kaydetme hatası:', e);
        } finally {
            this.saving = false;
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
