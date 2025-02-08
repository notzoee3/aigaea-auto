(async () => {
const fetch = (await import('node-fetch')).default;
const fs = require('fs').promises;
const { HttpsProxyAgent } = require('https-proxy-agent');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

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

async function getProxyFromAPI() {  
    try {  
        const response = await fetch('https://proxy-provider.com/api/get-proxy'); // Ganti dengan API penyedia proxy  
        const data = await response.json();  
        return data.proxy; // Pastikan API mengembalikan format proxy yang benar  
    } catch (error) {  
        console.error('Gagal mengambil proxy dari API:', error);  
        return null;  
    }  
}  

async function main() {  
    const accessToken = await readAccessToken();  
    const id8 = await askQuestion("Enter your first 8 browserID: ");  

    let headers = {  
        'Accept': 'application/json, text/plain, */*',  
        'origin': 'chrome-extension://cpjicfogbgognnifjgmenmaldnmeeeib',  
        'Content-Type': 'application/json',  
        'Authorization': `Bearer ${accessToken}`,  
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"  
    };  

    const browserIdFilePath = path.join(__dirname, 'browser_ids.json');  

    async function coday(url, method, payloadData = null, proxy) {  
        try {  
            const agent = new HttpsProxyAgent(proxy);  
            let response;  
            const options = {  
                method: method,  
                headers: headers,  
                agent: agent  
            };  

            if (method === 'POST') {  
                options.body = JSON.stringify(payloadData);  
            }  

            response = await fetch(url, options);  
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);  

            return await response.json();  
        } catch (error) {  
            console.error(`Error dengan proxy ${proxy}:`, error);  
            return null;  
        }  
    }  

    function generateBrowserId() {  
        const rdm = crypto.randomUUID().slice(8);  
        return `${id8}${rdm}`;  
    }  

    async function loadBrowserIds() {  
        try {  
            const data = await fs.readFile(browserIdFilePath, 'utf-8');  
            return JSON.parse(data);  
        } catch {  
            return {};  
        }  
    }  

    async function saveBrowserIds(browserIds) {  
        try {  
            await fs.writeFile(browserIdFilePath, JSON.stringify(browserIds, null, 2), 'utf-8');  
            console.log('Browser IDs disimpan.');  
        } catch (error) {  
            console.error('Gagal menyimpan Browser IDs:', error);  
        }  
    }  

    async function getBrowserId(proxy) {  
        const browserIds = await loadBrowserIds();  
        if (browserIds[proxy]) return browserIds[proxy];  

        const newBrowserId = generateBrowserId();  
        browserIds[proxy] = newBrowserId;  
        await saveBrowserIds(browserIds);  
        return newBrowserId;  
    }  

    function getCurrentTimestamp() {  
        return Math.floor(Date.now() / 1000);  
    }  

    async function pingProxy(proxy, browser_id, uid) {  
        const timestamp = getCurrentTimestamp();  
        const pingPayload = { "uid": uid, "browser_id": browser_id, "timestamp": timestamp, "version": "1.0.1" };  

        while (true) {  
            try {  
                const pingResponse = await coday('https://api.aigaea.net/api/network/ping', 'POST', pingPayload, proxy);  
                if (!pingResponse) throw new Error("Ping request gagal");  

                await coday('https://api.aigaea.net/api/network/ip', 'GET', {}, proxy);  
                console.log(`Ping berhasil untuk proxy ${proxy}.`);  

                if (pingResponse.data && pingResponse.data.score < 50) {  
                    console.log(`Score rendah (<50) untuk proxy ${proxy}, mengganti proxy...`);  
                    proxy = await getProxyFromAPI();  
                    if (!proxy) break;  
                    await handleAuthAndPing(proxy);  
                    break;  
                }  
            } catch (error) {  
                console.error(`Ping gagal untuk proxy ${proxy}, mengganti proxy...`);  
                proxy = await getProxyFromAPI();  
                if (!proxy) break;  
                await handleAuthAndPing(proxy);  
                break;  
            }  
            await new Promise(resolve => setTimeout(resolve, 600000));  
        }  
    }  

    async function handleAuthAndPing(proxy) {  
        const authResponse = await coday("https://api.aigaea.net/api/auth/session", 'POST', {}, proxy);  
        if (authResponse && authResponse.data) {  
            const uid = authResponse.data.uid;  
            const browser_id = await getBrowserId(proxy);  
            console.log(`Berhasil autentikasi untuk proxy ${proxy} dengan uid ${uid}`);  

            await pingProxy(proxy, browser_id, uid);  
        } else {  
            console.error(`Autentikasi gagal untuk proxy ${proxy}, mengganti proxy...`);  
            proxy = await getProxyFromAPI();  
            if (!proxy) return;  
            await handleAuthAndPing(proxy);  
        }  
    }  

    try {  
        let proxy = await getProxyFromAPI();  
        if (!proxy) {  
            console.error("Tidak ada proxy yang tersedia.");  
            return;  
        }  

        await handleAuthAndPing(proxy);  
    } catch (error) {  
        console.error('Terjadi kesalahan:', error);  
    }  
}  

main();

})();

