<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host     = "localhost";
$user     = "root";
$password = "";
$dbname   = "eterno_db";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Koneksi database gagal: " . $e->getMessage()]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// 1. GET: Ambil Data Produk dari Database
if ($method === 'GET') {
    // Pada bagian GET di api.php
        $sql = "SELECT 
                    p.id, 
                    p.title, 
                    p.price, 
                    p.stock, 
                    c.name AS category,
                    GROUP_CONCAT(pi.image_url ORDER BY pi.is_primary DESC, pi.id ASC SEPARATOR '|||') AS images_str
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN product_images pi ON p.id = pi.product_id
                WHERE p.is_active = 1
                GROUP BY p.id
                ORDER BY p.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll();

    $products = array_map(function($row) {
        return [
            "id"       => (int)$row['id'],
            "title"    => $row['title'],
            "price"    => "Rp " . number_format($row['price'], 0, ',', '.'),
            "raw_price"=> (float)$row['price'],
            "category" => $row['category'] ?? "Uncategorized",
            "images"   => $row['images_str'] ? explode('|||', $row['images_str']) : ["https://via.placeholder.com/600"]
        ];
    }, $results);

    echo json_encode($products);
    exit();
}

// 2. POST: Tambah atau Update Produk
if ($method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);

    if (empty($input['title']) || !isset($input['price'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Judul dan harga wajib diisi."]);
        exit();
    }

    $id     = $input['id'] ?? null;
    $title  = $input['title'];
    $price  = (float)preg_replace('/[^0-9]/', '', $input['price']); 
    $images = $input['images'] ?? [];

    $pdo->beginTransaction();
    try {
        if ($id) {
            // Update Produk
            $stmt = $pdo->prepare("UPDATE products SET title = :title, price = :price WHERE id = :id");
            $stmt->execute(['title' => $title, 'price' => $price, 'id' => $id]);
            $productId = $id;

            // Hapus gambar lama, perbarui dengan gambar baru
            $stmtDel = $pdo->prepare("DELETE FROM product_images WHERE product_id = :product_id");
            $stmtDel->execute(['product_id' => $productId]);
        } else {
            // Tambah Baru
            $stmt = $pdo->prepare("INSERT INTO products (title, price, category_id) VALUES (:title, :price, 1)");
            $stmt->execute(['title' => $title, 'price' => $price]);
            $productId = $pdo->lastInsertId();
        }

        if (!empty($images)) {
            $stmtImg = $pdo->prepare("INSERT INTO product_images (product_id, image_url, is_primary) VALUES (:product_id, :image_url, :is_primary)");
            foreach ($images as $index => $url) {
                $stmtImg->execute([
                    'product_id' => $productId,
                    'image_url'  => $url,
                    'is_primary' => ($index === 0) ? 1 : 0
                ]);
            }
        }

        $pdo->commit();
        echo json_encode(["status" => "success", "message" => "Berhasil disimpan", "id" => $productId]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Gagal menyimpan: " . $e->getMessage()]);
    }
    exit();
}

// 3. DELETE: Hapus Produk
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;

    if (!$id) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "ID wajib ada."]);
        exit();
    }

    $stmt = $pdo->prepare("DELETE FROM products WHERE id = :id");
    $stmt->execute(['id' => $id]);

    echo json_encode(["status" => "success", "message" => "Produk berhasil dihapus."]);
    exit();
}
?>