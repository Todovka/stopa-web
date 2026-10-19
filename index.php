<?php
// Načtení stránky
$stranka = $_GET['stranka'] ?? 'domu';

// Zabezpečení vstupu
$klic = basename($stranka, '.php');

// Whitelist
$povolene_stranky = [
    'maintrance' => 'maintrance.php',
    'domu'      => 'domu.php',
    'uvod'      => 'domu.php',
    'lipy'      => 'lipy.php',
    'arnika'    => 'arnika.php',
    'rr'        => 'rr.php',
    'dokumenty' => 'dokumenty.php',
    'tabor'     => 'tabor.php',
    'historie'  => 'historie.php',
    'procleny'  => 'procleny.php',
    'infolipy'   => 'infolipy.php',
    'infoarnika' => 'infoarnika.php',
];

// Dvojtá kontrola existence
$cesta_k_souboru = null;
if (array_key_exists($klic, $povolene_stranky)) {
    $mozny_soubor = __DIR__ . '/stranky/' . $povolene_stranky[$klic];
    if (file_exists($mozny_soubor)) {
        $cesta_k_souboru = $mozny_soubor;
    }
}

// Error
if (!$cesta_k_souboru) {
    http_response_code(404);
}

// Sldožení stránky
include __DIR__ . '/casti/header.php';

if ($cesta_k_souboru) {
    include $cesta_k_souboru;
} else {
    echo '<section>';
    echo '<h2>Chyba 404 - Stránka nenalezena</h2>';
    echo '<p>Požadovaná stránka neexistuje nebo byla přesunuta.</p>';
    echo '</section>';
}

include __DIR__ . '/casti/footer.php';
?>