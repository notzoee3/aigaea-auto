(async () => {
  const fetch = (await import('node-fetch')).default;
  const fs = require('fs').promises;
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const path = require('path'); 
  const readline = require('readline');
  const crypto = require('crypto');
  const base64 = require('base-64');

  const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
  });

  function askQuestion(query) {
      return new Promise((resolve) => rl.question(query, (answer) => resolve(answer)));
  }

  // URL proxy dienkode dalam Base64
  const encodedProxyListUrl = "aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL3IwMHRlZS9Qcm94eS1MaXN0L3JlZnMvaGVhZHMvbWFpbi9Tb2NrczUudHh0";
  const proxyListUrl = base64.decode(encodedProxyListUrl);

  async function getProxies() {
      try {
          const response = await fetch(proxyListUrl);
          if (!response.ok) throw new Error(`Failed to fetch proxy list, status: ${response.status}`);
          const proxyData = await response.text();
          return proxyData.split("\n").map(p => p.trim()).filter(p => p);
      } catch (error) {
          console.error("Error fetching proxy list:", error);
          return [];
      }
  }

  async function checkProxy(proxy) {
      try {
          const agent = new HttpsProxyAgent(`socks5://${proxy}`);
          const testResponse = await fetch("https://www.google.com", { method: "HEAD", agent, timeout: 5000 });
          return testResponse.ok ? proxy : null;
      } catch {
          return null;
      }
  }

  async function getWorkingProxy() {
      const proxies = await getProxies();
      for (let proxy of proxies) {
          const workingProxy = await checkProxy(proxy);
          if (workingProxy) return workingProxy;
      }
      throw new Error("No working proxies found.");
  }

  async function main() {
      const accessToken = await askQuestion("Enter your accessToken: ");
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
              const agent = new HttpsProxyAgent(`socks5://${proxy}`);
              let response;
              const options = { method, headers, agent };
              if (method === 'POST') options.body = JSON.stringify(payloadData);
              response = await fetch(url, options);
              return await response.json();
          } catch (error) {
              console.error('Error with proxy:', proxy);
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
          } catch (error) {
              console.error('Error saving browser IDs:', error);
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
          const pingPayload = { uid, browser_id, timestamp, version: "1.0.1" };

          while (true) {
              try {
                  const pingResponse = await coday('https://api.aigaea.net/api/network/ping', 'POST', pingPayload, proxy);
                  if (!pingResponse) throw new Error("Ping request failed");

                  await coday('https://api.aigaea.net/api/network/ip', 'GET', {}, proxy);
                  console.log(`Ping successful for proxy ${proxy}.`);

                  if (pingResponse.data && pingResponse.data.score < 50) {
                      console.log(`Score below 50 for proxy ${proxy}, switching proxy...`);
                      proxy = await getWorkingProxy();
                      await handleAuthAndPing(proxy);
                      break;
                  }
              } catch (error) {
                  console.error(`Ping failed for proxy ${proxy}, rotating proxy...`);
                  proxy = await getWorkingProxy();
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
              console.log(`Authenticated for proxy ${proxy} with uid ${uid}`);

              await pingProxy(proxy, browser_id, uid);
          } else {
              console.error(`Authentication failed for proxy ${proxy}, rotating proxy...`);
              proxy = await getWorkingProxy();
              if (!proxy) return;
              await handleAuthAndPing(proxy);
          }
      }

      try {
          let proxy = await getWorkingProxy();
          if (!proxy) {
              console.error("No proxy available.");
              return;
          }

          await handleAuthAndPing(proxy);
      } catch (error) {
          console.error('An error occurred:', error);
      }
  }

  main();
})();
