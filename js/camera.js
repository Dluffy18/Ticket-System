// Camera-only photo capture. Phones open the rear camera directly (no gallery);
// PCs use a live camera view; without any camera the prototype offers a
// labelled sample image.
import { t } from './strings.js';
import { esc } from './util.js';
import { icon, shrinkImage } from './ui.js';
import { samplePhoto } from './store.js';

const coarse = () => window.matchMedia('(pointer: coarse)').matches;

// One capture at a time: a double tap must not open two cameras.
let busy = false;
export async function takePhoto(kind, label, no) {
  if (busy) return null;
  busy = true;
  try {
    return await (coarse() ? nativeCapture(kind, label, no) : liveCapture(kind, label, no));
  } finally { busy = false; }
}

function nativeCapture(kind, label, no) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);
    let done = false;
    const finish = v => { if (done) return; done = true; input.remove(); resolve(v); };
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return finish(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { const d = shrinkImage(img); URL.revokeObjectURL(url); finish(d); };
      img.onerror = () => { URL.revokeObjectURL(url); finish(null); };
      img.src = url;
    });
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

function liveCapture(kind, label, no) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg dlg-camera';
    dlg.innerHTML = `
      <div class="dlg-form">
        <h2 class="dlg-title">${esc(t('cameraTitle', { what: label }))}</h2>
        <div class="cam-view"><video playsinline muted autoplay></video><p class="cam-msg" hidden></p></div>
        <div class="dlg-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel">${esc(t('cancel'))}</button>
          <button type="button" class="btn btn-ghost" data-act="sample" hidden>${esc(t('useSamplePhoto'))}</button>
          <button type="button" class="btn btn-primary" data-act="shoot" disabled>${icon('camera')}<span>${esc(t('capture'))}</span></button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    const video = dlg.querySelector('video');
    const msg = dlg.querySelector('.cam-msg');
    const shoot = dlg.querySelector('[data-act=shoot]');
    const sample = dlg.querySelector('[data-act=sample]');
    let stream = null, result = null;

    const noCamera = () => {
      video.hidden = true;
      msg.hidden = false;
      msg.textContent = t('cameraUnavailable') + ' ' + t('samplePhotoNote');
      shoot.hidden = true;
      sample.hidden = false;
      sample.classList.replace('btn-ghost', 'btn-primary');
      sample.focus();
    };

    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
        .then(s => { stream = s; video.srcObject = s; video.onloadedmetadata = () => { shoot.disabled = false; shoot.focus(); }; })
        .catch(noCamera);
    } else noCamera();

    shoot.addEventListener('click', () => { if (video.videoWidth) { result = shrinkImage(video); dlg.close(); } });
    sample.addEventListener('click', () => { result = samplePhoto(kind, no); dlg.close(); });
    dlg.querySelector('[data-act=cancel]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => {
      if (stream) stream.getTracks().forEach(tr => tr.stop());
      dlg.remove();
      resolve(result);
    });
    dlg.showModal();
  });
}
