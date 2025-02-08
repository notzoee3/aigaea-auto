# aigaea-auto
link aigaea

# Proxy Automation Script

Script ini secara otomatis mengambil proxy dari API penyedia proxy, melakukan autentikasi, dan mengirimkan ping setiap 10 menit. Jika proxy mati atau skornya terlalu rendah, script akan otomatis mengganti proxy dengan yang baru.

# Instalisasi & pengunaan
```
git clone https://github.com/notzoee3/aigaea-auto.git

```
Konfigurasi API Proxy

Buka file script.js.

Ganti URL API proxy di bagian ini dengan API penyedia proxy Anda:

async function getProxyFromAPI() {
    const response = await fetch('https://proxy-provider.com/api/get-proxy'); // Ganti dengan API penyedia proxy
    const data = await response.json();
    return data.proxy;
}


# Jalankan Script

```
npm start
```

