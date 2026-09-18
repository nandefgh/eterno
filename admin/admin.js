// ==========================================
// 1. DEKLARASI VARIABEL UTAMA & KONFIGURASI
// ==========================================
const SUPABASE_URL = "https://zcjdgppodjtlwjnyrqdi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjamRncHBvZGp0bHdqbnlycWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTU4MTksImV4cCI6MjEwNTE5MTgxOX0.OdfgOI1kpCPSeIIydomfp0vb5MzkDhvyH2Pw9Z6YzeQ";

// Deklarasi diawali di paling atas agar tidak error initialization
let products = [];
let db = null;

// ==========================================
// 2. AUTHENTICATION CHECK
// ==========================================
const ADMIN_PASSWORD = "eternoadmin123"; 
let isLoggedIn = sessionStorage.getItem('eterno_admin_logged');

if (!isLoggedIn) {
    let inputPassword = prompt("Masukkan Password Admin Eterno:");
    if (inputPassword === ADMIN_PASSWORD) {
        sessionStorage.setItem('eterno_admin_logged', 'true');
    } else {
        alert("Password Salah! Akses Ditolak.");
        window.location.href = "../index.html";
    }
}

// Inisialisasi Supabase aman
function initSupabase() {
    if (typeof supabase !== 'undefined') {
        if (!db) {
            db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        return true;
    } else {
        console.error("Supabase SDK belum siap!");
        return false;
    }
}

// Helper sinkronisasi input form ke array products
function syncCurrentInputs() {
    if (!Array.isArray(products)) return;
    products.forEach((prod, pIdx) => {
        const titleEl = document.getElementById(`title-${pIdx}`);
        const priceEl = document.getElementById(`price-${pIdx}`);
        if (titleEl) prod.title = titleEl.value;
        if (priceEl) prod.price = priceEl.value;
    });
}

// ==========================================
// 3. FETCH DATA DARI SUPABASE (GET)
// ==========================================
async function fetchProducts() {
    const container = document.getElementById('adminList');
    if (!container) return;
    
    if (!initSupabase()) {
        container.innerHTML = '<p style="text-align:center; color:#ff5555; padding:2rem;">Gagal memuat Supabase SDK. Silakan refresh halaman.</p>';
        return;
    }

    container.innerHTML = '<p style="text-align:center; color:#aaa; padding:2rem;">Memuat data dari Supabase...</p>';

    try {
        const { data, error } = await db
            .from('products')
            .select('*, product_images(id, image_url)')
            .order('id', { ascending: false });

        if (error) throw error;

        products = data.map(item => ({
            id: item.id,
            title: item.title,
            price: item.price,
            images: item.product_images ? item.product_images.map(img => img.image_url) : []
        }));

        renderAdminList();
    } catch (error) {
        console.error("Error:", error);
        container.innerHTML = `<p style="text-align:center; color:#ff5555; padding:2rem;">Terjadi kesalahan: ${error.message}</p>`;
    }
}

// ==========================================
// 4. RENDER TAMPILAN ADMIN
// ==========================================
function renderAdminList() {
    const container = document.getElementById('adminList');
    if (!container) return;
    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#777; padding:2rem;">Belum ada produk di database. Klik "+ Tambah Produk Baru" untuk menambah.</p>';
        return;
    }

    products.forEach((prod, pIdx) => {
        let galleryHtml = '';
        if (prod.images && prod.images.length > 0) {
            prod.images.forEach((imgSrc, iIdx) => {
                galleryHtml += `
                    <div class="gallery-item">
                        <img src="${imgSrc}" alt="${prod.title}">
                        <button type="button" class="btn-del-img" onclick="deleteImageLocal(${pIdx}, ${iIdx})">&times;</button>
                    </div>
                `;
            });
        }

        container.innerHTML += `
            <div class="item-row">
                <button type="button" class="btn-delete-card" onclick="deleteProductFromDB(${prod.id}, '${prod.title}')">Hapus Produk Ini</button>
                
                <label>Foto Produk Saat Ini (${prod.images ? prod.images.length : 0} Foto):</label>
                <div class="gallery-preview">${galleryHtml.length > 0 ? galleryHtml : '<span style="font-size:0.8rem; color:#666;">Belum ada foto</span>'}</div>

                <label>Nama Produk:</label>
                <input type="text" value="${prod.title || ''}" id="title-${pIdx}" placeholder="Contoh: Kaos Polos Hitam">

                <label>Harga Produk:</label>
                <input type="text" value="${prod.price || ''}" id="price-${pIdx}" placeholder="Contoh: Rp 90.000">

                <label>Tambah URL Gambar (Pisahkan dengan koma jika lebih dari 1):</label>
                <input type="text" id="add-url-${pIdx}" placeholder="https://link1.jpg, https://link2.jpg">

                <label>Atau Upload Banyak Foto dari HP/Laptop:</label>
                <input type="file" accept="image/*" multiple onchange="handleMultipleFileUpload(event, ${pIdx})">
            </div>
        `;
    });
}

// ==========================================
// 5. TAMBAH PRODUK BARU (POST)
// ==========================================
async function addNewProduct() {
    if (!initSupabase()) return;
    syncCurrentInputs();

    try {
        const { data: newProd, error: prodErr } = await db
            .from('products')
            .insert([{ 
                title: "Produk Baru " + (products.length + 1), 
                price: "Rp 100.000" 
            }])
            .select()
            .single();

        if (prodErr) throw prodErr;

        await db.from('product_images').insert([{
            product_id: newProd.id,
            image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=600"
        }]);

        alert("Produk baru berhasil ditambahkan!");
        fetchProducts();
    } catch (error) {
        console.error("Error:", error);
        alert("Gagal menambah produk: " + error.message);
    }
}

// ==========================================
// 6. SIMPAN PERUBAHAN DETAIL (UPDATE)
// ==========================================
async function saveChanges() {
    if (!initSupabase()) return;
    syncCurrentInputs();

    if (products.length === 0) {
        alert("Tidak ada produk untuk disimpan.");
        return;
    }

    try {
        for (let pIdx = 0; pIdx < products.length; pIdx++) {
            const prod = products[pIdx];

            const { error: updateErr } = await db
                .from('products')
                .update({ title: prod.title, price: prod.price })
                .eq('id', prod.id);

            if (updateErr) throw updateErr;

            const extraUrlsEl = document.getElementById(`add-url-${pIdx}`);
            if (extraUrlsEl && extraUrlsEl.value.trim() !== '') {
                const urlArray = extraUrlsEl.value.split(',').map(u => u.trim()).filter(u => u !== '');
                prod.images.push(...urlArray);
            }

            await db.from('product_images').delete().eq('product_id', prod.id);

            if (prod.images.length > 0) {
                const imgInserts = prod.images.map(url => ({
                    product_id: prod.id,
                    image_url: url
                }));
                await db.from('product_images').insert(imgInserts);
            }
        }

        alert('Semua perubahan berhasil disimpan ke Supabase!');
        fetchProducts();
    } catch (error) {
        console.error("Error:", error);
        alert('Gagal menyimpan perubahan: ' + error.message);
    }
}

// ==========================================
// 7. HAPUS PRODUK DARI DATABASE (DELETE)
// ==========================================
async function deleteProductFromDB(productId, title) {
    if (!initSupabase()) return;
    
    if (confirm(`Yakin ingin menghapus produk "${title}"?`)) {
        try {
            const { error } = await db.from('products').delete().eq('id', productId);
            if (error) throw error;

            alert("Produk berhasil dihapus!");
            fetchProducts();
        } catch (error) {
            console.error("Error:", error);
            alert("Gagal menghapus produk: " + error.message);
        }
    }
}

// ==========================================
// 8. HELPER FOTO & LOGOUT
// ==========================================
function deleteImageLocal(pIdx, iIdx) {
    syncCurrentInputs();
    products[pIdx].images.splice(iIdx, 1);
    renderAdminList();
}

function handleMultipleFileUpload(event, pIdx) {
    syncCurrentInputs();
    const files = Array.from(event.target.files);
    let loadedCount = 0;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            products[pIdx].images.push(e.target.result);
            loadedCount++;
            if (loadedCount === files.length) {
                renderAdminList();
            }
        };
        reader.readAsDataURL(file);
    });
}

function resetData() {
    if (confirm("Muat ulang data dari Supabase?")) {
        fetchProducts();
    }
}

function logout() {
    sessionStorage.removeItem('eterno_admin_logged');
    window.location.href = '../index.html';
}

window.onload = function() {
    initSupabase();
    fetchProducts();
};
