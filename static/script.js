document.addEventListener("DOMContentLoaded", function () {
    // === FOTOĞRAF VE VİDEO ÖNİZLEME ===
    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');

    fileInput.addEventListener('change', () => {
        const files = fileInput.files;
        const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
        const videoFiles = Array.from(files).filter(file => file.type.startsWith("video/"));

        previewContainer.innerHTML = '';

        if (imageFiles.length > 0 || videoFiles.length > 0) {
            uploadText.style.display = "none";
            previewContainer.style.minHeight = "100px";
        } else {
            uploadText.style.display = "block";
            previewContainer.style.minHeight = "auto";
        }

        const maxNormalPreview = 2;
        const maxOverlayPreview = 3;

        // Fotoğrafların önizlemesini ekleyelim
        imageFiles.slice(0, maxNormalPreview).forEach(file => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement("img");
                img.src = e.target.result;
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });

        // Videoların kapaklarını alalım
        videoFiles.slice(0, maxNormalPreview).forEach(file => {
            const video = document.createElement("video");
            video.src = URL.createObjectURL(file);
            video.load();
            video.onloadeddata = function () {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = 80;  // Boyutunu ayarlayabilirsiniz
                canvas.height = 100;

                // Videonun ilk karesini çekiyoruz
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const img = new Image();
                img.src = canvas.toDataURL();
                previewContainer.appendChild(img);
            };
        });

        // Eğer fotoğraf ve video karışıksa, 3. resimleri veya video kapaklarını kaydırma ekleyelim
        const remainingFiles = [...imageFiles.slice(maxNormalPreview), ...videoFiles.slice(maxNormalPreview)];
        const totalExtraCount = remainingFiles.length;
        const shownOverlayCount = Math.min(maxOverlayPreview, totalExtraCount);
        const remainingHiddenCount = totalExtraCount;
        const extraCountToShow = remainingFiles.length;

        if (totalExtraCount > 0) {
            const overlayStackContainer = document.createElement("div");
            overlayStackContainer.className = "overlay-stack-container";
            
            const slideDistance = 3.75;

            remainingFiles.forEach((file, index) => { 
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    img.classList.add("overlay");
                    img.style.left = `${index * slideDistance}px`;
                    img.style.zIndex = remainingFiles.length - index;
                    overlayStackContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            });

            if (extraCountToShow > 0) {
                const extra = document.createElement("div");
                extra.className = "extra-count";
                extra.textContent = `+${extraCountToShow}`;
                overlayStackContainer.appendChild(extra);
            }

            previewContainer.appendChild(overlayStackContainer);
        }
    });
});
