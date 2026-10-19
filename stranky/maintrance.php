<section class="maintrance-container">
    <div class="maintrance-block">
        <h2 class="maintrance-nadpis">Přidat nový příspěvek</h2>
        <div class="maintrance-form-group">
            <label for="post-title">Nadpis</label>
            <input type="text" id="post-title" placeholder="Zadejte nadpis...">
        </div>
        <div class="maintrance-form-group">
            <label for="post-content">Obsah</label>
            <textarea id="post-content" placeholder="Napište text příspěvku..."></textarea>
        </div>
        <div class="maintrance-form-group">
            <label>Obrázky</label>
            <div class="maintrance-upload-zone" id="upload-zone">
                <input type="file" id="post-image" accept="image/*" multiple>
                <div class="maintrance-upload-placeholder" id="upload-placeholder">
                    <span>Klikni nebo přetáhni obrázky</span>
                </div>
            </div>
            <div class="maintrance-upload-thumbs" id="upload-thumbs"></div>
        </div>
        <div class="maintrance-form-group">
            <label>Zobrazit na stránkách</label>
            <div class="maintrance-checkbox-group">
                <label class="maintrance-checkbox-label">
                    <input type="checkbox" value="domu" class="page-checkbox" checked>
                    <span class="maintrance-checkbox-custom"></span>
                    Úvod
                </label>
                <label class="maintrance-checkbox-label">
                    <input type="checkbox" value="arnika" class="page-checkbox">
                    <span class="maintrance-checkbox-custom"></span>
                    Arnika
                </label>
                <label class="maintrance-checkbox-label">
                    <input type="checkbox" value="lipy" class="page-checkbox">
                    <span class="maintrance-checkbox-custom"></span>
                    Lípy
                </label>
                <label class="maintrance-checkbox-label">
                    <input type="checkbox" value="rr" class="page-checkbox">
                    <span class="maintrance-checkbox-custom"></span>
                    R&R
                </label>
            </div>
        </div>
        <button class="maintrance-btn-add" id="add-post-btn">Publikovat příspěvek</button>
    </div>

    <div class="maintrance-block">
        <h2 class="maintrance-nadpis">Spravovat příspěvky</h2>
        <div id="admin-list" class="maintrance-admin-list"></div>
        <div class="maintrance-empty-admin" id="admin-empty-state">Zatím nebyly přidány žádné příspěvky.</div>
    </div>
</section>
