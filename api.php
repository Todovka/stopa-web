<?php
/**
 * REST API pro správu příspěvků (Středisko STOPA)
 * Podporuje operace:
 *  - GET: Načtení všech příspěvků (nebo jednoho dle ?id=...)
 *  - POST: Vytvoření nového příspěvku
 *  - PUT / PATCH: Aktualizace příspěvku (např. toggle stránek)
 *  - DELETE: Smazání příspěvku dle ID
 */

// Nastavení hlaviček pro JSON odpověď a CORS (pro přístup z jiných zařízení v lokální síti)
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

// Rychlá odpověď na preflight OPTIONS dotaz prohlížeče
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Zvýšení paměťového limitu pro zpracování objemnějších Base64 obrázků
ini_set('memory_limit', '256M');

// Konfigurace MySQL (výchozí nastavení pro XAMPP)
$host = 'localhost';
$dbName = 'stopa_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$pdoOptions = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    // 1. Připojení k MySQL serveru a automatické vytvoření databáze (pokud ještě neexistuje)
    $dsnServer = "mysql:host={$host};charset={$charset}";
    $pdoServer = new PDO($dsnServer, $user, $pass, $pdoOptions);
    $pdoServer->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    // 2. Připojení k vytvořené databázi
    $dsnDb = "mysql:host={$host};dbname={$dbName};charset={$charset}";
    $pdo = new PDO($dsnDb, $user, $pass, $pdoOptions);

    // 3. Automatické vytvoření tabulky posts (pokud ještě neexistuje)
    $pdo->exec("CREATE TABLE IF NOT EXISTS `posts` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `title` TEXT NULL,
        `content` TEXT NULL,
        `images` LONGTEXT NULL,
        `pages` JSON NULL,
        `created` BIGINT NOT NULL,
        INDEX `idx_created` (`created` DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Chyba připojení k MySQL databázi: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// Kontrola limitu velikosti POST dat (pokud klient data poslal, ale php://input je prázdný)
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
$rawInput = file_get_contents('php://input');

if ($contentLength > 0 && empty($rawInput) && in_array($method, ['POST', 'PUT', 'PATCH'])) {
    http_response_code(413);
    echo json_encode([
        'error' => 'Data jsou příliš velká pro server. Zkontrolujte limit post_max_size v php.ini.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Bezpečně dekóduje JSON vstup
 */
function getJsonInput($raw) {
    if (empty($raw)) {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Neplatný JSON formát: ' . json_last_error_msg()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $decoded;
}

// ==========================================
// 1. GET – Načtení příspěvků
// ==========================================
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    try {
        if ($id) {
            $stmt = $pdo->prepare("SELECT id, title, content, images, pages, created FROM `posts` WHERE `id` = :id LIMIT 1");
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch();

            if (!$row) {
                http_response_code(404);
                echo json_encode(['error' => 'Příspěvek nenalezen'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Příprava dat pro JSON výstup
            $row['images'] = $row['images'] ? (json_decode($row['images'], true) ?: []) : [];
            $pagesDecoded = $row['pages'] ? json_decode($row['pages'], true) : [];
            $row['pages'] = !empty($pagesDecoded) ? $pagesDecoded : (object)[];
            $row['created'] = (int)$row['created'];

            echo json_encode($row, JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Načtení všech příspěvků seřazených od nejnovějšího
        $stmt = $pdo->query("SELECT id, title, content, images, pages, created FROM `posts` ORDER BY `created` DESC");
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['images'] = $row['images'] ? (json_decode($row['images'], true) ?: []) : [];
            $pagesDecoded = $row['pages'] ? json_decode($row['pages'], true) : [];
            $row['pages'] = !empty($pagesDecoded) ? $pagesDecoded : (object)[];
            $row['created'] = (int)$row['created'];
        }

        echo json_encode($rows, JSON_UNESCAPED_UNICODE);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při čtení z databáze: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ==========================================
// 2. POST – Vytvoření nového příspěvku
// ==========================================
if ($method === 'POST') {
    $input = getJsonInput($rawInput);

    $id = !empty($input['id']) ? (string)$input['id'] : (time() . bin2hex(random_bytes(4)));
    $title = isset($input['title']) ? (string)$input['title'] : '';
    $content = isset($input['content']) ? (string)$input['content'] : '';

    $images = isset($input['images']) && is_array($input['images']) ? $input['images'] : [];
    $imagesJson = json_encode($images, JSON_UNESCAPED_UNICODE);

    $pages = isset($input['pages']) && is_array($input['pages']) ? $input['pages'] : (object)[];
    $pagesJson = json_encode($pages, JSON_UNESCAPED_UNICODE);

    $created = isset($input['created']) ? (int)$input['created'] : (int)round(microtime(true) * 1000);

    try {
        $stmt = $pdo->prepare("INSERT INTO `posts` (`id`, `title`, `content`, `images`, `pages`, `created`) 
                               VALUES (:id, :title, :content, :images, :pages, :created)");
        $stmt->execute([
            ':id' => $id,
            ':title' => $title,
            ':content' => $content,
            ':images' => $imagesJson,
            ':pages' => $pagesJson,
            ':created' => $created,
        ]);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Příspěvek byl úspěšně vytvořen',
            'id' => $id
        ], JSON_UNESCAPED_UNICODE);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při ukládání do databáze: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ==========================================
// 3. PUT / PATCH – Aktualizace příspěvku
// ==========================================
if ($method === 'PUT' || $method === 'PATCH') {
    $input = getJsonInput($rawInput);
    $id = $_GET['id'] ?? ($input['id'] ?? null);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Chybí ID příspěvku pro aktualizaci'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $fields = [];
    $params = [':id' => $id];

    if (array_key_exists('title', $input)) {
        $fields[] = "`title` = :title";
        $params[':title'] = (string)$input['title'];
    }

    if (array_key_exists('content', $input)) {
        $fields[] = "`content` = :content";
        $params[':content'] = (string)$input['content'];
    }

    if (array_key_exists('images', $input)) {
        $images = is_array($input['images']) ? $input['images'] : [];
        $fields[] = "`images` = :images";
        $params[':images'] = json_encode($images, JSON_UNESCAPED_UNICODE);
    }

    if (array_key_exists('pages', $input)) {
        $pages = is_array($input['pages']) ? $input['pages'] : (object)[];
        $fields[] = "`pages` = :pages";
        $params[':pages'] = json_encode($pages, JSON_UNESCAPED_UNICODE);
    }

    if (array_key_exists('created', $input)) {
        $fields[] = "`created` = :created";
        $params[':created'] = (int)$input['created'];
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'Nebyly předány žádné údaje k aktualizaci'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        $sql = "UPDATE `posts` SET " . implode(', ', $fields) . " WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode([
            'success' => true,
            'message' => 'Příspěvek byl úspěšně aktualizován',
            'id' => $id
        ], JSON_UNESCAPED_UNICODE);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při aktualizaci v databázi: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ==========================================
// 4. DELETE – Smazání příspěvku
// ==========================================
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        $input = getJsonInput($rawInput);
        $id = $input['id'] ?? null;
    }

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Chybí ID příspěvku ke smazání'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM `posts` WHERE `id` = :id");
        $stmt->execute([':id' => $id]);

        echo json_encode([
            'success' => true,
            'message' => 'Příspěvek byl úspěšně smazán',
            'id' => $id
        ], JSON_UNESCAPED_UNICODE);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při mazání z databáze: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Pokud je volána jiná metoda
http_response_code(405);
echo json_encode(['error' => 'Metoda ' . $method . ' není podporována'], JSON_UNESCAPED_UNICODE);
