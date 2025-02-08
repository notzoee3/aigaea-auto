# aigaea-auto
link aigaea

# Proxy Automation Script

Script ini secara otomatis mengambil proxy dari API penyedia proxy, melakukan autentikasi, dan mengirimkan ping setiap 10 menit. Jika proxy mati atau skornya terlalu rendah, script akan otomatis mengganti proxy dengan yang baru.

# Clone Repository 
```
git clone https://github.com/notzoee3/aigaea-auto.git

```

# Cara Menjalankan Script

1. Cara mendapatkan token
mengunakan local storage

Buka DevTools (F12 atau Ctrl + Shift + I)
Pergi ke tab Console
```
console.log(localStorage);
```


2. Untuk memasukkan akses token:

```
nano token.txt
```

Masukkan token, lalu tekan CTRL + X, Y, dan Enter.


3. Install dependencies:

```
npm install
```


4. Jalankan script:

```
npm start
```
