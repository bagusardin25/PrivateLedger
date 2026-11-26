# Uji go/no-go — Private Ledger

Halaman uji untuk membuktikan asumsi teknis PRD (bagian 13) **sebelum** aplikasi dibangun. Semua data di sini sintetis.

| ID | Yang diuji | Butuh |
|---|---|---|
| G1 | Model on-device menjawab lewat Firebase AI Logic | Chrome dengan model |
| G2 | F3: JSON selalu valid (2 batch × 20 transaksi) | Chrome dengan model |
| G3 | F3: di bawah 15 detik per batch | Chrome dengan model |
| G4 | F3: akurasi bisnis/pribadi ≥ 80% | Chrome dengan model |
| G5 | F7: tidak mengarang merchant | Chrome dengan model |
| G6 | F9a: penjaga memblokir data transaksi | Chrome dengan model (lapisan aturan jalan tanpa model) |
| G7 | Tiga model cloud menjawab di free tier | Proyek Firebase |
| I1–I4 | Structured output cloud, function calling, function calling + Google Search (model PRD v0.3), `inferenceSource` | Proyek Firebase |
| I5–I7 | Uji I1–I3 yang sama di `gemini-3.5-flash-lite`, dijalankan lebih dulu. Ditambahkan 26 Nov setelah model yang lebih besar terus penuh | Proyek Firebase |

Ambang angka adalah usulan dari PRD dan bisa diubah di `src/tests.ts` (`THRESHOLDS`).

## Langkah 1 — Aktifkan model on-device di Chrome

1. Buka `chrome://flags`, cari **Gemma 4 for Built-in AI**, pilih **Enabled**, lalu klik **Relaunch**.
2. Jika status di halaman uji masih "LanguageModel API missing", cari juga **Prompt API for Gemini Nano** di `chrome://flags` dan aktifkan.
3. Status unduhan model bisa dilihat di `chrome://on-device-internals`.

Syarat perangkat dari dokumentasi Chrome: GPU dengan VRAM di atas 4 GB (laptop ini RTX 4050 6 GB), dan minimal 22 GB ruang kosong di drive profil Chrome (C:).

## Langkah 2 — Jalankan uji on-device (tanpa proyek Firebase)

```powershell
npm --prefix D:\Project\PrivateLedger\spike\go-no-go run dev
```

1. Buka **http://localhost:5173** di **Chrome biasa** (bukan browser lain).
2. Klik **1. Enable on-device AI**. Unduhan model bisa memakan beberapa menit; progresnya terlihat di halaman.
3. Klik **2. Run on-device tests**.

Tanpa `.env.local`, halaman memakai konfigurasi Firebase palsu. Itu aman karena panggilan on-device tidak pernah menghubungi Firebase, dan tombol uji cloud dinonaktifkan.

## Langkah 3 — Siapkan proyek Firebase (untuk uji cloud)

1. Buka [Firebase console](https://console.firebase.google.com/) dan buat proyek baru. Google Analytics tidak perlu.
2. **AI Services → AI Logic → Get started**, pilih **Gemini Developer API** (gratis), lalu ikuti alurnya. Langkah ini juga mengaktifkan App Check untuk AI Logic.
3. **Project settings → General → Your apps → Add app → Web**. Daftarkan aplikasinya (Hosting tidak perlu), lalu salin nilai `firebaseConfig`.
4. **Security → App Check → Apps**: pada web app tadi, buka menu ⋮ → **Manage debug tokens** → **Add debug token** → **Generate**, lalu salin nilainya.
5. Salin `.env.example` menjadi `.env.local` di folder ini, lalu isi nilai dari langkah 3 dan 4.
6. Hentikan server (Ctrl+C) lalu jalankan lagi, karena Vite hanya membaca `.env.local` saat mulai.
7. Klik **3. Run cloud tests**.

`.env.local` sudah ada di `.gitignore`. Jangan pernah meng-commit debug token.

## Hasil

Setiap kali uji selesai, laporan disimpan ke `results/latest.json` (beserta salinan bertanggal). Folder `results/` tidak masuk git.

## Temuan penting soal SDK

Di Firebase JS SDK 13.2.0 dan 13.4.0 (`callCloudOrDevice`), jika browser tidak punya API `LanguageModel` (misalnya Firefox, Safari, atau Chrome tanpa flag), permintaan **dikirim ke model cloud walaupun modenya `ONLY_ON_DEVICE`**. Karena itu setiap panggilan on-device di sini lewat `assertOnDeviceReady()` (`src/onDevice.ts`), yang menolak permintaan jika model tidak tersedia. Aplikasi Private Ledger wajib memakai penjaga yang sama.
