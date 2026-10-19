/* Navigace JS */
document.addEventListener("DOMContentLoaded", function () {
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const navigace = document.getElementById("hlavni-navigace");

    hamburgerBtn.addEventListener("click", function () {
        // Přidá/odebere třídu 'otevreno' tlačítku i navigaci
        hamburgerBtn.classList.toggle("otevreno");
        navigace.classList.toggle("otevreno");
    });
});
/* ========== MAINTRANCE – správa příspěvků (REST API + MySQL) ========== */

(function () {
    var API_URL = "api.php";
    var STORAGE_KEY = "stopa_prispevky"; // Ponecháno pro jednorázovou migraci starých dat
    var PAGE_NAMES = {
        domu: "Úvod",
        arnika: "Arnika",
        lipy: "Lípy",
        rr: "R&R"
    };
    var INFO_PAGE_NAMES = {
        infolipy: "Informace - Lípy",
        infoarnika: "Informace - Arnika"
    };

    var pendingImages = [];
    var isCompressing = false;

    var infoPendingImages = [];
    var isInfoCompressing = false;

    function isInfoPost(post) {
        if (!post || !post.pages || typeof post.pages !== "object") return false;
        return post.pages.infolipy !== undefined || post.pages.infoarnika !== undefined;
    }

    /**
     * Načtení všech příspěvků ze serveru (GET api.php)
     */
    async function loadPosts() {
        try {
            var response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("HTTP " + response.status + " " + response.statusText);
            }

            var data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.error("Nepodařilo se načíst příspěvky ze serveru:", e);
            return [];
        }
    }

    /**
     * Vytvoření nového příspěvku na serveru (POST api.php)
     */
    async function savePost(newPost) {
        try {
            var response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(newPost)
            });

            if (!response.ok) {
                var errorMsg = "HTTP " + response.status;
                try {
                    var errData = await response.json();
                    if (errData && errData.error) {
                        errorMsg = errData.error;
                    }
                } catch (_) { }
                throw new Error(errorMsg);
            }

            return true;
        } catch (e) {
            console.error("Nepodařilo se uložit příspěvek na server:", e);
            alert("Nepodařilo se uložit příspěvek na server:\n" + e.message);
            return false;
        }
    }

    /**
     * Pro zpětnou kompatibilitu se stávajícím názvem savePosts
     */
    async function savePosts(postOrPosts) {
        var post = Array.isArray(postOrPosts) ? postOrPosts[0] : postOrPosts;
        return await savePost(post);
    }

    /**
     * Aktualizace příspěvku na serveru (PATCH api.php?id=...)
     */
    async function updatePost(id, updatedFields) {
        try {
            var response = await fetch(API_URL + "?id=" + encodeURIComponent(id), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(updatedFields)
            });

            if (!response.ok) {
                var errorMsg = "HTTP " + response.status;
                try {
                    var errData = await response.json();
                    if (errData && errData.error) {
                        errorMsg = errData.error;
                    }
                } catch (_) { }
                throw new Error(errorMsg);
            }

            return true;
        } catch (e) {
            console.error("Nepodařilo se aktualizovat příspěvek na serveru:", e);
            alert("Nepodařilo se aktualizovat příspěvek:\n" + e.message);
            return false;
        }
    }

    /**
     * Smazání příspěvku ze serveru (DELETE api.php?id=...)
     */
    async function deletePost(id) {
        try {
            var response = await fetch(API_URL + "?id=" + encodeURIComponent(id), {
                method: "DELETE",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                var errorMsg = "HTTP " + response.status;
                try {
                    var errData = await response.json();
                    if (errData && errData.error) {
                        errorMsg = errData.error;
                    }
                } catch (_) { }
                throw new Error(errorMsg);
            }

            return true;
        } catch (e) {
            console.error("Nepodařilo se smazat příspěvek ze serveru:", e);
            alert("Nepodařilo se smazat příspěvek:\n" + e.message);
            return false;
        }
    }

    /**
     * Automatická jednorázová migrace dat z localStorage do MySQL (pokud v DB ještě nic není)
     */
    async function migrateLocalStorageIfNeeded() {
        try {
            var localData = localStorage.getItem(STORAGE_KEY);
            if (!localData) return;

            var localPosts = JSON.parse(localData);
            if (!Array.isArray(localPosts) || localPosts.length === 0) return;

            var serverPosts = await loadPosts();
            if (serverPosts.length === 0) {
                console.log("Migruji " + localPosts.length + " starých příspěvků z localStorage do databáze MySQL...");
                for (var i = localPosts.length - 1; i >= 0; i--) {
                    await savePost(localPosts[i]);
                }
                localStorage.removeItem(STORAGE_KEY);
                console.log("Migrace dokončena.");
            }
        } catch (e) {
            console.warn("Chyba při jednorázové migraci z localStorage:", e);
        }
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    function formatDate(timestamp) {
        var d = new Date(Number(timestamp));
        var den = d.getDate();
        var mesic = d.getMonth() + 1;
        var rok = d.getFullYear();
        return den + ". " + mesic + ". " + rok;
    }

    function compressImage(file, callback) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                var maxDim = 1200;
                var width = img.width;
                var height = img.height;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                var canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext("2d");

                if (file.type === "image/png") {
                    ctx.drawImage(img, 0, 0, width, height);
                    var pngUrl = canvas.toDataURL("image/png");
                    if (pngUrl.length > 500000) {
                        var ctx2 = canvas.getContext("2d");
                        ctx2.fillStyle = "#ffffff";
                        ctx2.fillRect(0, 0, width, height);
                        ctx2.drawImage(img, 0, 0, width, height);
                        callback(canvas.toDataURL("image/jpeg", 0.78));
                    } else {
                        callback(pngUrl);
                    }
                } else {
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    callback(canvas.toDataURL("image/jpeg", 0.78));
                }
            };
            img.onerror = function () {
                callback(e.target.result);
            };
            img.src = e.target.result;
        };
        reader.onerror = function () {
            callback(null);
        };
        reader.readAsDataURL(file);
    }

    function renderUploadThumbs() {
        var container = document.getElementById("upload-thumbs");
        if (!container) return;
        container.innerHTML = "";
        pendingImages.forEach(function (dataUrl, index) {
            var item = document.createElement("div");
            item.className = "maintrance-upload-thumb-item";

            var img = document.createElement("img");
            img.src = dataUrl;
            img.alt = "";

            var removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "maintrance-upload-thumb-remove";
            removeBtn.textContent = "✕";
            removeBtn.addEventListener("click", function () {
                pendingImages.splice(index, 1);
                renderUploadThumbs();
            });

            item.appendChild(img);
            item.appendChild(removeBtn);
            container.appendChild(item);
        });
    }

    function addFilesToPending(files) {
        var validFiles = [];
        for (var i = 0; i < files.length; i++) {
            if (files[i].type.startsWith("image/")) {
                validFiles.push(files[i]);
            }
        }
        if (validFiles.length === 0) return;

        var addBtn = document.getElementById("add-post-btn");
        if (addBtn) addBtn.disabled = true;
        isCompressing = true;

        var remaining = validFiles.length;
        validFiles.forEach(function (file) {
            compressImage(file, function (dataUrl) {
                if (dataUrl) {
                    pendingImages.push(dataUrl);
                }
                remaining--;
                if (remaining <= 0) {
                    isCompressing = false;
                    if (addBtn) addBtn.disabled = false;
                    renderUploadThumbs();
                }
            });
        });
    }

    function initUploadZone() {
        var zone = document.getElementById("upload-zone");
        var fileInput = document.getElementById("post-image");

        if (!zone) return;

        fileInput.addEventListener("change", function () {
            if (fileInput.files && fileInput.files.length > 0) {
                addFilesToPending(fileInput.files);
                fileInput.value = "";
            }
        });

        zone.addEventListener("dragover", function (e) {
            e.preventDefault();
            zone.classList.add("dragover");
        });

        zone.addEventListener("dragleave", function () {
            zone.classList.remove("dragover");
        });

        zone.addEventListener("drop", function (e) {
            e.preventDefault();
            zone.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                addFilesToPending(e.dataTransfer.files);
            }
        });
    }

    function clearUpload() {
        pendingImages = [];
        var container = document.getElementById("upload-thumbs");
        if (container) container.innerHTML = "";
        var fileInput = document.getElementById("post-image");
        if (fileInput) fileInput.value = "";
    }

    function migratePost(post) {
        if (post.image && !post.images) {
            post.images = [post.image];
            delete post.image;
        }
        if (!post.images) {
            post.images = [];
        }
        return post;
    }

    /**
     * Vykreslení příspěvků na jednotlivých podstránkách
     */
    async function renderFrontendPosts() {
        var containers = document.querySelectorAll(".prispevky-sekce");
        if (containers.length === 0) return;

        var posts = await loadPosts();

        containers.forEach(function (section) {
            var pageKey = section.getAttribute("data-page");
            var kontejner = section.querySelector(".prispevky-kontejner");
            if (!kontejner) return;
            kontejner.innerHTML = "";

            var filtered = posts.filter(function (p) {
                return p.pages && p.pages[pageKey] === true;
            });

            filtered.forEach(function (post) {
                post = migratePost(post);
                var karta = document.createElement("div");
                karta.className = "prispevek-karta";

                if (post.title && post.title.trim() !== "") {
                    var nadpis = document.createElement("div");
                    nadpis.className = "prispevek-karta-nadpis";
                    nadpis.textContent = post.title;
                    karta.appendChild(nadpis);
                }

                if (post.images && post.images.length > 0) {
                    var galerie = document.createElement("div");
                    galerie.className = "prispevek-karta-galerie";
                    post.images.forEach(function (src) {
                        var img = document.createElement("img");
                        img.className = "prispevek-galerie-img";
                        img.src = src;
                        img.alt = post.title || "";
                        galerie.appendChild(img);
                    });
                    karta.appendChild(galerie);
                }

                if (post.content && post.content.trim() !== "") {
                    var obsah = document.createElement("div");
                    obsah.className = "prispevek-karta-obsah";
                    obsah.textContent = post.content;
                    karta.appendChild(obsah);
                }

                var datum = document.createElement("div");
                datum.className = "prispevek-karta-datum";
                datum.textContent = formatDate(post.created);
                karta.appendChild(datum);

                kontejner.appendChild(karta);
            });
        });
    }

    /**
     * Vykreslení seznamu příspěvků v administraci
     */
    async function renderAdminList() {
        var adminList = document.getElementById("admin-list");
        var emptyState = document.getElementById("admin-empty-state");
        if (!adminList) return;

        var posts = await loadPosts();
        adminList.innerHTML = "";

        var regularPosts = posts.filter(function (p) {
            return !isInfoPost(p);
        });

        if (regularPosts.length === 0) {
            if (emptyState) emptyState.style.display = "block";
            return;
        }
        if (emptyState) emptyState.style.display = "none";

        regularPosts.forEach(function (post) {
            post = migratePost(post);
            var item = document.createElement("div");
            item.className = "maintrance-admin-item";

            var header = document.createElement("div");
            header.className = "maintrance-admin-item-header";

            var title = document.createElement("span");
            title.className = "maintrance-admin-item-title";
            var displayTitle = post.title && post.title.trim() !== ""
                ? post.title
                : (post.content && post.content.trim() !== ""
                    ? (post.content.length > 40 ? post.content.substring(0, 40) + "..." : post.content)
                    : "Příspěvek");
            title.textContent = displayTitle;

            var deleteBtn = document.createElement("button");
            deleteBtn.className = "maintrance-btn-delete";
            deleteBtn.textContent = "Smazat";

            deleteBtn.addEventListener("click", async function () {
                if (!confirm("Opravdu chcete tento příspěvek smazat?")) {
                    return;
                }

                deleteBtn.disabled = true;
                deleteBtn.textContent = "Mažu...";

                var success = await deletePost(post.id);
                if (success) {
                    await renderAdminList();
                } else {
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = "Smazat";
                }
            });

            header.appendChild(title);
            header.appendChild(deleteBtn);

            var toggles = document.createElement("div");
            toggles.className = "maintrance-admin-toggles";

            Object.keys(PAGE_NAMES).forEach(function (pageKey) {
                var toggleItem = document.createElement("div");
                toggleItem.className = "maintrance-toggle-item";

                var toggleLabel = document.createElement("label");
                toggleLabel.className = "maintrance-toggle-switch";

                var checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = post.pages && post.pages[pageKey] === true;

                checkbox.addEventListener("change", async function () {
                    var prevValue = !checkbox.checked;
                    checkbox.disabled = true;

                    if (!post.pages || typeof post.pages !== "object") {
                        post.pages = {};
                    }
                    post.pages[pageKey] = checkbox.checked;

                    var success = await updatePost(post.id, { pages: post.pages });
                    checkbox.disabled = false;

                    if (!success) {
                        // V případě chyby vrátit zaškrtávátko do původního stavu
                        checkbox.checked = prevValue;
                        post.pages[pageKey] = prevValue;
                    }
                });

                var slider = document.createElement("span");
                slider.className = "maintrance-toggle-slider";

                toggleLabel.appendChild(checkbox);
                toggleLabel.appendChild(slider);

                var pageName = document.createElement("span");
                pageName.textContent = PAGE_NAMES[pageKey];

                toggleItem.appendChild(toggleLabel);
                toggleItem.appendChild(pageName);
                toggles.appendChild(toggleItem);
            });

            item.appendChild(header);
            item.appendChild(toggles);
            adminList.appendChild(item);
        });
    }

    /**
     * Inicializace formuláře pro přidání příspěvku a admin sekce
     */
    async function initMaintrance() {
        var addBtn = document.getElementById("add-post-btn");
        if (!addBtn) return;

        var titleInput = document.getElementById("post-title");
        var contentInput = document.getElementById("post-content");
        var checkboxes = document.querySelectorAll(".page-checkbox");
        initUploadZone();

        addBtn.addEventListener("click", async function () {
            if (isCompressing) return;

            var title = titleInput.value.trim();
            var content = contentInput.value.trim();
            var hasImages = pendingImages.length > 0;

            if (title === "" && content === "" && !hasImages) {
                var block = addBtn.closest(".maintrance-block");
                if (block) {
                    block.classList.remove("maintrance-shake");
                    void block.offsetWidth;
                    block.classList.add("maintrance-shake");
                }
                return;
            }

            var pages = {};
            checkboxes.forEach(function (cb) {
                pages[cb.value] = cb.checked;
            });

            var hasAnyPage = false;
            Object.keys(pages).forEach(function (k) {
                if (pages[k]) hasAnyPage = true;
            });

            if (!hasAnyPage) {
                var block = addBtn.closest(".maintrance-block");
                if (block) {
                    block.classList.remove("maintrance-shake");
                    void block.offsetWidth;
                    block.classList.add("maintrance-shake");
                }
                return;
            }

            var newPost = {
                id: generateId(),
                title: title,
                content: content,
                images: pendingImages.slice(),
                pages: pages,
                created: Date.now()
            };

            // Indikace ukládání a prevence opakovaného odeslání
            addBtn.disabled = true;
            var originalBtnText = addBtn.textContent;
            addBtn.textContent = "Ukládám na server...";

            var success = await savePost(newPost);

            addBtn.disabled = false;
            addBtn.textContent = originalBtnText;

            if (!success) {
                return;
            }

            // Vyčištění formuláře po úspěšném uložení
            titleInput.value = "";
            contentInput.value = "";
            checkboxes.forEach(function (cb) { cb.checked = false; });
            if (checkboxes.length > 0) {
                checkboxes[0].checked = true;
            }
            clearUpload();
            titleInput.focus();

            await renderAdminList();
        });

        titleInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                contentInput.focus();
            }
        });

        await renderAdminList();
    }

    /**
     * Vykreslení seznamu informací pro oddíly v administraci
     */
    async function renderInfoAdminList() {
        var adminList = document.getElementById("info-admin-list");
        var emptyState = document.getElementById("info-admin-empty-state");
        if (!adminList) return;

        var posts = await loadPosts();
        adminList.innerHTML = "";

        var infoPosts = posts.filter(function (p) {
            return isInfoPost(p);
        });

        if (infoPosts.length === 0) {
            if (emptyState) emptyState.style.display = "block";
            return;
        }
        if (emptyState) emptyState.style.display = "none";

        infoPosts.forEach(function (post) {
            post = migratePost(post);
            var item = document.createElement("div");
            item.className = "maintrance-admin-item";

            var header = document.createElement("div");
            header.className = "maintrance-admin-item-header";

            var title = document.createElement("span");
            title.className = "maintrance-admin-item-title";
            var displayTitle = post.title && post.title.trim() !== ""
                ? post.title
                : (post.content && post.content.trim() !== ""
                    ? (post.content.length > 40 ? post.content.substring(0, 40) + "..." : post.content)
                    : "Informace");
            title.textContent = displayTitle;

            var deleteBtn = document.createElement("button");
            deleteBtn.className = "maintrance-btn-delete";
            deleteBtn.textContent = "Smazat";

            deleteBtn.addEventListener("click", async function () {
                if (!confirm("Opravdu chcete tuto informaci smazat?")) {
                    return;
                }

                deleteBtn.disabled = true;
                deleteBtn.textContent = "Mažu...";

                var success = await deletePost(post.id);
                if (success) {
                    await renderInfoAdminList();
                } else {
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = "Smazat";
                }
            });

            header.appendChild(title);
            header.appendChild(deleteBtn);

            var toggles = document.createElement("div");
            toggles.className = "maintrance-admin-toggles";

            Object.keys(INFO_PAGE_NAMES).forEach(function (pageKey) {
                var toggleItem = document.createElement("div");
                toggleItem.className = "maintrance-toggle-item";

                var toggleLabel = document.createElement("label");
                toggleLabel.className = "maintrance-toggle-switch";
                if (pageKey === "infolipy") {
                    toggleLabel.classList.add("maintrance-toggle-slider-lipy");
                } else if (pageKey === "infoarnika") {
                    toggleLabel.classList.add("maintrance-toggle-slider-arnika");
                }

                var checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = post.pages && post.pages[pageKey] === true;

                checkbox.addEventListener("change", async function () {
                    var prevValue = !checkbox.checked;
                    checkbox.disabled = true;

                    if (!post.pages || typeof post.pages !== "object") {
                        post.pages = {};
                    }
                    post.pages[pageKey] = checkbox.checked;

                    var success = await updatePost(post.id, { pages: post.pages });
                    checkbox.disabled = false;

                    if (!success) {
                        checkbox.checked = prevValue;
                        post.pages[pageKey] = prevValue;
                    }
                });

                var slider = document.createElement("span");
                slider.className = "maintrance-toggle-slider";

                toggleLabel.appendChild(checkbox);
                toggleLabel.appendChild(slider);

                var pageName = document.createElement("span");
                pageName.textContent = INFO_PAGE_NAMES[pageKey];

                toggleItem.appendChild(toggleLabel);
                toggleItem.appendChild(pageName);
                toggles.appendChild(toggleItem);
            });

            item.appendChild(header);
            item.appendChild(toggles);
            adminList.appendChild(item);
        });
    }

    function renderInfoUploadThumbs() {
        var container = document.getElementById("info-upload-thumbs");
        if (!container) return;
        container.innerHTML = "";
        infoPendingImages.forEach(function (dataUrl, index) {
            var item = document.createElement("div");
            item.className = "maintrance-upload-thumb-item";

            var img = document.createElement("img");
            img.src = dataUrl;
            img.alt = "";

            var removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "maintrance-upload-thumb-remove";
            removeBtn.textContent = "✕";
            removeBtn.addEventListener("click", function () {
                infoPendingImages.splice(index, 1);
                renderInfoUploadThumbs();
            });

            item.appendChild(img);
            item.appendChild(removeBtn);
            container.appendChild(item);
        });
    }

    function addFilesToInfoPending(files) {
        var validFiles = [];
        for (var i = 0; i < files.length; i++) {
            if (files[i].type.startsWith("image/")) {
                validFiles.push(files[i]);
            }
        }
        if (validFiles.length === 0) return;

        var addBtn = document.getElementById("info-add-post-btn");
        if (addBtn) addBtn.disabled = true;
        isInfoCompressing = true;

        var remaining = validFiles.length;
        validFiles.forEach(function (file) {
            compressImage(file, function (dataUrl) {
                if (dataUrl) {
                    infoPendingImages.push(dataUrl);
                }
                remaining--;
                if (remaining <= 0) {
                    isInfoCompressing = false;
                    if (addBtn) addBtn.disabled = false;
                    renderInfoUploadThumbs();
                }
            });
        });
    }

    function initInfoUploadZone() {
        var zone = document.getElementById("info-upload-zone");
        var fileInput = document.getElementById("info-post-image");

        if (!zone || !fileInput) return;

        fileInput.addEventListener("change", function () {
            if (fileInput.files && fileInput.files.length > 0) {
                addFilesToInfoPending(fileInput.files);
                fileInput.value = "";
            }
        });

        zone.addEventListener("dragover", function (e) {
            e.preventDefault();
            zone.classList.add("dragover");
        });

        zone.addEventListener("dragleave", function () {
            zone.classList.remove("dragover");
        });

        zone.addEventListener("drop", function (e) {
            e.preventDefault();
            zone.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                addFilesToInfoPending(e.dataTransfer.files);
            }
        });
    }

    function clearInfoUpload() {
        infoPendingImages = [];
        var container = document.getElementById("info-upload-thumbs");
        if (container) container.innerHTML = "";
        var fileInput = document.getElementById("info-post-image");
        if (fileInput) fileInput.value = "";
    }

    /**
     * Inicializace formuláře pro přidání informací pro oddíly
     */
    async function initInfoMaintrance() {
        var addBtn = document.getElementById("info-add-post-btn");
        if (!addBtn) return;

        var titleInput = document.getElementById("info-post-title");
        var contentInput = document.getElementById("info-post-content");
        var checkboxes = document.querySelectorAll(".info-page-checkbox");
        initInfoUploadZone();

        addBtn.addEventListener("click", async function () {
            if (isInfoCompressing) return;

            var title = titleInput.value.trim();
            var content = contentInput.value.trim();
            var hasImages = infoPendingImages.length > 0;

            if (title === "" && content === "" && !hasImages) {
                var block = addBtn.closest(".maintrance-block");
                if (block) {
                    block.classList.remove("maintrance-shake");
                    void block.offsetWidth;
                    block.classList.add("maintrance-shake");
                }
                return;
            }

            var pages = {};
            checkboxes.forEach(function (cb) {
                pages[cb.value] = cb.checked;
            });

            var hasAnyPage = false;
            Object.keys(pages).forEach(function (k) {
                if (pages[k]) hasAnyPage = true;
            });

            if (!hasAnyPage) {
                var block = addBtn.closest(".maintrance-block");
                if (block) {
                    block.classList.remove("maintrance-shake");
                    void block.offsetWidth;
                    block.classList.add("maintrance-shake");
                }
                return;
            }

            var newPost = {
                id: generateId(),
                title: title,
                content: content,
                images: infoPendingImages.slice(),
                pages: pages,
                created: Date.now()
            };

            addBtn.disabled = true;
            var originalBtnText = addBtn.textContent;
            addBtn.textContent = "Ukládám na server...";

            var success = await savePost(newPost);

            addBtn.disabled = false;
            addBtn.textContent = originalBtnText;

            if (!success) {
                return;
            }

            titleInput.value = "";
            contentInput.value = "";
            checkboxes.forEach(function (cb) { cb.checked = false; });
            if (checkboxes.length > 0) {
                checkboxes[0].checked = true;
            }
            clearInfoUpload();
            titleInput.focus();

            await renderInfoAdminList();
        });

        titleInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                contentInput.focus();
            }
        });

        await renderInfoAdminList();
    }

    document.addEventListener("DOMContentLoaded", async function () {
        await migrateLocalStorageIfNeeded();
        await initMaintrance();
        await initInfoMaintrance();
        await renderFrontendPosts();
    });
})();

/* ========== Co si zabalit ========== */
function initProclenyAkordeon() {
    var headers = document.querySelectorAll(".procleny-kategorie-header");
    headers.forEach(function (header) {
        header.addEventListener("click", function () {
            var kategorie = this.closest(".procleny-kategorie");
            if (kategorie) {
                kategorie.classList.toggle("otevreno");
            }
        });
    });
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProclenyAkordeon);
} else {
    initProclenyAkordeon();
}

/* ========== Šifrovač ========== */

const morzeovka = {
    "A": "• ─",
    "B": "─ • • •",
    "C": "─ • ─ •",
    "D": "─ • •",
    "E": "•",
    "F": "• • ─ •",
    "G": "─ ─ •",
    "H": "• • • •",
    "I": "• •",
    "J": "• ─ ─ ─",
    "K": "─ • ─",
    "L": "• ─ • •",
    "M": "─ ─",
    "N": "─ •",
    "O": "─ ─ ─",
    "P": "• ─ ─ •",
    "Q": "─ ─ • ─",
    "R": "• ─ •",
    "S": "• • •",
    "T": "─",
    "U": "• • ─",
    "V": "• • • ─",
    "W": "• ─ ─",
    "X": "─ • • ─",
    "Y": "─ • ─ ─",
    "Z": "─ ─ • •",
    "1": "• ─ ─ ─ ─",
    "2": "• • ─ ─ ─",
    "3": "• • • ─ ─",
    "4": "• • • • ─",
    "5": "• • • • •",
    "6": "─ • • • •",
    "7": "─ ─ • • •",
    "8": "─ ─ ─ • •",
    "9": "─ ─ ─ ─ •",
    "0": "─ ─ ─ ─ ─",
    ",": " // ",
    ".": " /// "
};

const telefon = {
    "A": "2",
    "B": "22",
    "C": "222",
    "D": "3",
    "E": "33",
    "F": "333",
    "G": "4",
    "H": "44",
    "I": "444",
    "J": "5",
    "K": "55",
    "L": "555",
    "M": "6",
    "N": "66",
    "O": "666",
    "P": "7",
    "Q": "77",
    "R": "777",
    "S": "7777",
    "T": "8",
    "U": "88",
    "V": "888",
    "W": "9",
    "X": "99",
    "Y": "999",
    "Z": "9999",
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    "0": "0",
    ",": ",",
    ".": ".",
    "!": "!",
    "?": "?"
};

const ajeb = {
    "A": "B",
    "B": "C",
    "C": "D",
    "D": "E",
    "E": "F",
    "F": "G",
    "G": "H",
    "H": "I",
    "I": "J",
    "J": "K",
    "K": "L",
    "L": "M",
    "M": "N",
    "N": "O",
    "O": "P",
    "P": "Q",
    "Q": "R",
    "R": "S",
    "S": "T",
    "T": "U",
    "U": "V",
    "V": "W",
    "W": "X",
    "X": "Y",
    "Y": "Z",
    "Z": "A",
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    "0": "0",
    ",": ",",
    ".": ".",
    "!": "!",
    "?": "?"
};

// Funkce pro odstranění české diakritiky (háčky a čárky), protože morzeovka je neumí
function odstranDiakritiku(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function sifrujText() {
    let vstupniText = document.getElementById("sifrovac-morzeovka-vstup").value;
    let typSifry = document.getElementById("typ-sifry").value; // Zjistíme vybranou šifru

    vstupniText = odstranDiakritiku(vstupniText).toUpperCase();

    // Specifické mazání mezer za tečkou/čárkou ponecháme jen pro morzeovku
    if (typSifry === "morzeovka") {
        vstupniText = vstupniText.replace(/[\.,]\s+/g, (match) => match[0]);
    }
    vstupniText = vstupniText.replace(/\s+/g, ' ');

    // Dynamický výběr slovníku podle roletky
    let aktualniSlovnik = (typSifry === "morzeovka") ? morzeovka : (typSifry === "telefon") ? telefon : ajeb;

    let vysledek = "";
    let predchoziBylZnak = false;

    for (let i = 0; i < vstupniText.length; i++) {
        let znak = vstupniText[i];
        let sifrovanyZnak = "";
        let jeZnak = false;

        // --- PRAVIDLA PRO PŘEKLAD ZNAKŮ ---
        if (typSifry === "morzeovka") {
            if (znak === " ") {
                sifrovanyZnak = "//";
            } else if (znak === "." || znak === ",") {
                sifrovanyZnak = "///";
            } else if (aktualniSlovnik[znak]) {
                sifrovanyZnak = aktualniSlovnik[znak];
                jeZnak = true;
            }
        }
        else if (typSifry === "telefon") {
            if (znak === " ") {
                sifrovanyZnak = " "; // Mezera mezi slovy se u telefonu nahradí lomítkem
            } else if (aktualniSlovnik[znak]) {
                sifrovanyZnak = aktualniSlovnik[znak]; // Znaky, čísla, tečky a čárky z tvé konstanty 'telefon'
                jeZnak = true;
            }
        }
        else if (typSifry === "ajeb") {
            if (znak === " ") {
                sifrovanyZnak = " "; // Mezera mezi slovy se u telefonu nahradí lomítkem
            } else if (aktualniSlovnik[znak]) {
                sifrovanyZnak = aktualniSlovnik[znak]; // Znaky, čísla, tečky a čárky z tvé konstanty 'telefon'
                jeZnak = true;
            }
        }

        // --- PRAVIDLA PRO MEZERY (FORMÁTOVÁNÍ) ---
        if (sifrovanyZnak !== "") {
            if (vysledek !== "") {
                if (typSifry === "morzeovka") {
                    if (predchoziBylZnak && jeZnak) {
                        vysledek += " / "; // Mezi písmeny
                    } else {
                        vysledek += " "; // Kolem speciálních znaků // a ///
                    }
                }
                else if (typSifry === "telefon") {
                    if (predchoziBylZnak && jeZnak) {
                        vysledek += " "; // Oddělovač stejných/různých písmen (např. 2 22 pro A B)
                    } else {
                        vysledek += " "; // Oddělí mezerou lomítka mezi slovy (např. ...22 / 2...)
                    }
                }
                else if (typSifry === "ajeb") {
                    if (predchoziBylZnak && jeZnak) {
                        vysledek += ""; // Oddělovač stejných/různých písmen (např. 2 22 pro A B)
                    } else {
                        vysledek += ""; // Oddělí mezerou lomítka mezi slovy (např. ...22 / 2...)
                    }
                }
            }
            vysledek += sifrovanyZnak;
            predchoziBylZnak = jeZnak;
        }
    }

    document.getElementById("sifrovac-morzeovka-vystup").value = vysledek;
}
