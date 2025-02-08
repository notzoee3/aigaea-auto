import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Simulasi __dirname dalam ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import https-proxy-agent secara dinamis
const { HttpsProxyAgent } = await import('https-proxy-agent');

const rl = readline.createInterface({  
    input: process.stdin,  
    output: process.stdout  
});

function askQuestion(query) {  
    return new Promise((resolve) => rl.question(query, (answer) => resolve(answer)));  
}  

async function readAccessToken() {  
    try {  
        const token = await fs.readFile('token.txt', 'utf-8');  
        return token.trim();  
    } catch (error) {  
        console.error('Gagal membaca token.txt:', error);  
        process.exit(1);  
    }  
}  

async function getProxyFromFile() {
    try {
        const data = await fs.readFile('proxies.txt', 'utf-8');
        const proxies = data.split('\n').map(proxy => proxy.trim()).filter(proxy => proxy);
        if (proxies.length === 0) throw new Error("File proxies.txt kosong.");
        return proxies[Math.floor(Math.random() * proxies.length)]; // Pilih proxy acak
    } catch (error) {
        console.error('Gagal membaca proxies.txt:', error);
        return null;
    }
}

async function coday(url, method, payloadData = null, proxy) {  
    try {  
        const agent = new HttpsProxyAgent(proxy);  
        const options = {  
            method: method,  
            headers: {  
                'Accept': 'application/json, text/plain, */*',  
                'origin': 'chrome-extension://cpjicfogbgognnifjgmenmaldnmeeeib',  
                'Content-Type': 'application/json',  
                'Authorization': `Bearer ${await readAccessToken()}`,  
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"  
            },  
            agent: agent  
        };  

        if (method === 'POST') {  
            options.body = JSON.stringify(payloadData);  
        }  

        const response = await fetch(url, options);  
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);  

        return await response.json();  
    } catch (error) {  
        console.error(`Error dengan proxy ${proxy}:`, error);  
        return null;  
    }  
}  

function generateBrowserId(id8) {  
    const rdm = crypto.randomUUID().slice(8);  
    return `${id8}${rdm}`;  
}  

async function handleAuthAndPing(proxy, id8) {  
    const authResponse = await coday("https://api.aigaea.net/api/auth/session", 'POST', {}, proxy);  
    if (authResponse && authResponse.data) {  
        const uid = authResponse.data.uid;  
        const browser_id = generateBrowserId(id8);  
        console.log(`Berhasil autentikasi untuk proxy ${proxy} dengan uid ${uid}`);  

        await pingProxy(proxy, browser_id, uid);  
    } else {  
        console.error(`Autentikasi gagal untuk proxy ${proxy}, mencoba proxy lain...`);  
        proxy = await getProxyFromFile();  
        if (!proxy) return;  
        await handleAuthAndPing(proxy, id8);  
    }  
}  

async function pingProxy(proxy, browser_id, uid) {  
    const timestamp = Math.floor(Date.now() / 1000);  
    const pingPayload = { "uid": uid, "browser_id": browser_id, "timestamp": timestamp, "version": "1.0.1" };  

    while (true) {  
        try {  
            const pingResponse = await coday('https://api.aigaea.net/api/network/ping', 'POST', pingPayload, proxy);  
            if (!pingResponse) throw new Error("Ping request gagal");  

            await coday('https://api.aigaea.net/api/network/ip', 'GET', {}, proxy);  
            console.log(`Ping berhasil untuk proxy ${proxy}.`);  

            if (pingResponse.data && pingResponse.data.score < 50) {  
                console.log(`Score rendah (<50) untuk proxy ${proxy}, mengganti proxy...`);  
                proxy = await getProxyFromFile();  
                if (!proxy) break;  
                await handleAuthAndPing(proxy, browser_id);  
                break;  
            }  
        } catch (error) {  
            console.error(`Ping gagal untuk proxy ${proxy}, mengganti proxy...`);  
            proxy = await getProxyFromFile();  
            if (!proxy) break;  
            await handleAuthAndPing(proxy, browser_id);  
            break;  
        }  
        await new Promise(resolve => setTimeout(resolve, 600000));  
    }  
}  

async function main() {
    const accessToken = await readAccessToken();
    const id8 = await askQuestion("Enter your first 8 browserID: ");

    let proxy = await getProxyFromFile();  
    if (!proxy) {  
        console.error("Tidak ada proxy yang tersedia dalam file proxies.txt.");  
        return;  
    }

    await handleAuthAndPing(proxy, id8);
}

// Jalankan script utama
main().catch(console.error);
