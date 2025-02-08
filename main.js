import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { fileURLToPath } from 'url';

// Simulasi __dirname dalam ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Buat readline untuk input terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise((resolve) => rl.question(query, (answer) => resolve(answer)));
}

// Baca token dari file
async function readAccessToken() {
    try {
        const token = await fs.readFile('token.txt', 'utf-8');
        return token.trim();
    } catch (error) {
        console.error('Gagal membaca token.txt:', error);
        process.exit(1);
    }
}

// Konfigurasi Proxy Tor
const TOR_PROXY = 'socks5h://127.0.0.1:9050';
const agent = new SocksProxyAgent(TOR_PROXY);

// Header untuk request
async function getHeaders() {
    const accessToken = await readAccessToken();
    return {
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'chrome-extension://cpjicfogbgognnifjgmenmaldnmeeeib',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    };
}

// Fungsi untuk request dengan Tor
async function coday(url, method, payloadData = null) {
    try {
        const headers = await getHeaders();
        const options = {
            method: method,
            headers: headers,
            agent: agent
        };

        if (method === 'POST') {
            options.body = JSON.stringify(payloadData);
        }

        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        return await response.json();
    } catch (error) {
        console.error(`Error dengan Tor Proxy:`, error);
        return null;
    }
}

// Fungsi untuk mengganti IP dengan Tor
async function changeTorIP() {
    try {
        console.log('Mengganti IP dengan Tor...');
        await fetch('http://127.0.0.1:9051', {
            method: 'POST',
            body: 'AUTHENTICATE ""\r\nSIGNAL NEWNYM\r\n',
            agent: agent
        });
        console.log('IP berhasil diganti.');
    } catch (error) {
        console.error('Gagal mengganti IP:', error);
    }
}

// Generate browser ID unik
function generateBrowserId(id8) {
    const rdm = crypto.randomUUID().slice(8);
    return `${id8}${rdm}`;
}

// Dapatkan browser ID dari file atau buat baru
async function getBrowserId(id8) {
    const browserIdFile = path.join(__dirname, 'browser_ids.json');
    try {
        const data = await fs.readFile(browserIdFile, 'utf-8');
        const browserIds = JSON.parse(data);
        return browserIds[id8] || generateBrowserId(id8);
    } catch {
        return generateBrowserId(id8);
    }
}

// Simpan browser ID ke file
async function saveBrowserId(id8, browserId) {
    const browserIdFile = path.join(__dirname, 'browser_ids.json');
    let browserIds = {};

    try {
        const data = await fs.readFile(browserIdFile, 'utf-8');
        browserIds = JSON.parse(data);
    } catch {}

    browserIds[id8] = browserId;

    try {
        await fs.writeFile(browserIdFile, JSON.stringify(browserIds, null, 2), 'utf-8');
        console.log('Browser IDs disimpan.');
    } catch (error) {
        console.error('Gagal menyimpan Browser IDs:', error);
    }
}

// Mendapatkan timestamp saat ini
function getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
}

// Kirim ping ke API dengan Tor
async function pingProxy(id8, uid) {
    const timestamp = getCurrentTimestamp();
    const browser_id = await getBrowserId(id8);
    await saveBrowserId(id8, browser_id);

    const pingPayload = {
        "uid": uid,
        "browser_id": browser_id,
        "timestamp": timestamp,
        "version": "1.0.1"
    };

    while (true) {
        try {
            const pingResponse = await coday('https://api.aigaea.net/api/network/ping', 'POST', pingPayload);
            if (!pingResponse) throw new Error("Ping request gagal");

            console.log(`Ping berhasil dengan browser ID ${browser_id}.`);

            if (pingResponse.data && pingResponse.data.score < 50) {
                console.log(`Score rendah (<50), mengganti IP...`);
                await changeTorIP();
                break;
            }
        } catch (error) {
            console.error(`Ping gagal, mengganti IP...`);
            await changeTorIP();
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 600000)); // Delay 10 menit
    }
}

// Handle autentikasi & ping
async function handleAuthAndPing(id8) {
    const authResponse = await coday("https://api.aigaea.net/api/auth/session", 'POST');
    if (authResponse && authResponse.data) {
        const uid = authResponse.data.uid;
        console.log(`Autentikasi berhasil dengan UID ${uid}`);
        await pingProxy(id8, uid);
    } else {
        console.error("Autentikasi gagal, mengganti IP...");
        await changeTorIP();
    }
}

// **Main Function**
async function main() {
    const id8 = await askQuestion("Enter your first 8 browserID: ");
    rl.close(); // Tutup readline setelah input

    await handleAuthAndPing(id8);
}

main();
