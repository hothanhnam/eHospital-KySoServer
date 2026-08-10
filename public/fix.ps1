$filePath = "d:\BACKUP\eHospital\eHospital.SignCoreVD\KySoServer\public\app.js"
$content = Get-Content $filePath -Raw
$regex = "(?s)    signatureCanvas.addEventListener\('mousedown', startDraw\);\s*\}\s*const base64Data = signatureCanvas.toDataURL\('image/png'\);"

$replacement = "    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', endDraw);
    signatureCanvas.addEventListener('mouseout', endDraw);

    signatureCanvas.addEventListener('touchstart', startDraw, { passive: false });
    signatureCanvas.addEventListener('touchmove', draw, { passive: false });
    signatureCanvas.addEventListener('touchend', endDraw, { passive: false });
    
    document.getElementById('btn-close-signpad').addEventListener('click', closeSignpad);
    document.getElementById('btn-cancel-signpad').addEventListener('click', closeSignpad);
    document.getElementById('btn-clear-signpad').addEventListener('click', clearSignpad);
    document.getElementById('btn-confirm-signpad').addEventListener('click', confirmSignpad);
}

function clearSignpad() {
    if(!signaturePadContext) return;
    const rect = signatureCanvas.getBoundingClientRect();
    signaturePadContext.clearRect(0, 0, rect.width, rect.height);
    document.getElementById('signpad-placeholder').style.display = 'block';
}

function closeSignpad() {
    document.getElementById('signpad-modal').classList.add('hidden');
}

window.openSignpad = function(docId) {
    currentSignDocId = docId;
    document.getElementById('signpad-modal').classList.remove('hidden');
    setTimeout(() => {
        if (!signaturePadContext) {
            initSignpad();
        }
        clearSignpad();
    }, 50);
};

async function confirmSignpad() {
    const isBlank = document.getElementById('signpad-placeholder').style.display !== 'none';
    if (isBlank) {
        showToast('Vui lòng vẽ chữ ký trước khi xác nhận!', 'error');
        return;
    }
    
    const base64Data = signatureCanvas.toDataURL('image/png');"

$newContent = $content -replace $regex, $replacement

$docRegex = "(?s)    const doc = patientsList.find\(d => \(d.DocumentInstance_Id \|\| d.Document_Id\) == currentSignDocId\);\s*if \(!doc\) \{"
$docReplacement = "    let doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == currentSignDocId);
    if (!doc && typeof currentPatientDocs !== 'undefined') {
        doc = currentPatientDocs.find(d => (d.DocumentInstance_Id || d.Document_Id) == currentSignDocId);
    }
    if (!doc) {"
$newContent = $newContent -replace $docRegex, $docReplacement

Set-Content -Path $filePath -Value $newContent -Encoding UTF8
