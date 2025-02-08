(async () => {
    // Impor modul menggunakan ES Modules
    const fetch = (await import('node-fetch')).default;
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    const crypto = await import('crypto');
    const fs = await import('fs').promises;

    async function readFileContent(fileName) {
        try {
            const content = await fs.readFile(fileName, 'utf-8');
            return content.trim();
        } catch (error) {
            console.error(`Gagal membaca file ${fileName}:`, error);
            process.exit(1);
        }
    }

    async function readAccessToken() {
        return await readFileContent('token.txt');
    }

    async function readBrowserIdPrefix() {
        return await readFileContent('browser_id.txt');
    }

    async function getProxyFromAPI() {
        try {
            const response = await fetch('https://proxyscrape.com/api/v1?request=getproxies&protocol=http&ssl=yes&timeout=10000');
            const data = await response.json();
            return data.proxy;
        } catch (error) {
            console.error('Gagal mengambil proxy dari API:', error);
            return null;
        }
    }

    async function coday(url, method, payloadData = null, proxy, headers) {
        try {
            const agent = new HttpsProxyAgent(proxy);
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
            console.error(`Error dengan proxy ${proxy}:`, error);
            return null;
        }
    }

    function generateBrowserId(prefix) {
        const randomPart = crypto.randomUUID().slice(8);
        return `${prefix}${randomPart}`;
    }

    function getCurrentTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    async function pingProxy(proxy, browser_id, uid, headers) {
        const timestamp = getCurrentTimestamp();
        const pingPayload = { "uid": uid, "browser_id": browser_id, "timestamp": timestamp, "version": "1.0.1" };

        while (true) {
            try {
                const pingResponse = await coday('https://api.aigaea.net/api/network/ping', 'POST', pingPayload, proxy, headers);
                if (!pingResponse) throw new Error("Ping request gagal");

                await coday('https://api.aigaea.net/api/network/ip', 'GET', {}, proxy, headers);
                console.log(`Ping berhasil untuk proxy ${proxy}.`);

                if (pingResponse.data && pingResponse.data.score < 50) {
                    console.log(`Score rendah (<50) untuk proxy ${proxy}, mengganti proxy...`);
                    proxy = await getProxyFromAPI();
                    if (!proxy) break;
                    await handleAuthAndPing(proxy, headers);
                    break;
                }
            } catch (error) {
                console.error(`Ping gagal untuk proxy ${proxy}, mengganti proxy...`);
                proxy = await getProxyFromAPI();
                if (!proxy) break;
                await handleAuthAndPing(proxy, headers);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 600000));
        }
    }

    async function handleAuthAndPing(proxy, headers) {
        const authResponse = await coday("https://api.aigaea.net/api/auth/session", 'POST', {}, proxy, headers);
        if (authResponse && authResponse.data) {
            const uid = authResponse.data.uid;
            const prefix = await readBrowserIdPrefix();
            const browser_id = generateBrowserId(prefix);
            console.log(`Berhasil autentikasi untuk proxy ${proxy} dengan uid ${uid} dan browser_id ${browser_id}`);

            await pingProxy(proxy, browser_id, uid, headers);
        } else {
            console.error(`Autentikasi gagal untuk proxy ${proxy}, mengganti proxy...`);
            proxy = await getProxyFromAPI();
            if (!proxy) return;
            await handleAuthAndPing(proxy, headers);
        }
    }

    async function main() {
        const accessToken = await readAccessToken();

        let headers = {
            'Accept': 'application/json, text/plain, */*',
            'origin': 'chrome-extension://cpjicfogbgognnifjgmenmaldnmeeeib',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        };

        try {
            let proxy = await getProxyFromAPI();
            if (!proxy) {
                console.error("Tidak ada proxy yang tersedia.");
                return;
            }

            await handleAuthAndPing(proxy, headers);
        } catch (error) {
            console.error('Terjadi kesalahan:', error);
        }
    }

    main();
})();
