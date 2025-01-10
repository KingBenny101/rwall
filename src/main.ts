import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {convertFileSrc} from '@tauri-apps/api/core';

let SELECTED_IMAGE: HTMLImageElement | null = null;

listen('REPO-CLONED', () => {
  setMessage('Moving files...');
});

listen('IMAGES-MOVED', () => {
  setMessage('');
  hideModal();
  updateProgress('0');
});

listen('CLONE-PROGRESS', (event) => {
  updateProgress(event.payload as string);
});

listen('MOVE-PROGRESS', (event) => {
  updateProgress(event.payload as string);
});

listen('IMAGES-LOADED',(event) => {
  eraseImages();
  addImages(event.payload as string[]);
});

async function load() {
  console.log('load from JS');
  eraseImages();
  showModal();
  setMessage('Downloading files...');
  disableButtons();
  await invoke('load');
}

async function set() {
  console.log('Set from JS');
  if (!SELECTED_IMAGE) {
    return;
  }
  var selectedImage = SELECTED_IMAGE?.src;
  const tauriPrefix = "http://asset.localhost/";
  if (selectedImage.startsWith(tauriPrefix)) {
    selectedImage = selectedImage.replace(tauriPrefix, "");
  }
  await invoke('set', {image: selectedImage});
}

async function erase() {
  console.log('Erase from JS');
  eraseImages();
  await invoke('erase');
}

function waitForImagesToLoad(images: HTMLImageElement[]): Promise<void> {
  return Promise.all(
    images.map((img) => {
      return new Promise<void>((resolve, reject) => {
        if (img.complete) {
          resolve();
        } else {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load ${img.src}`));
        }
      });
    })
  ).then(() => {
    console.log('All images loaded!');
  });
}

// function addRandomImages() {
//   var imageGrid = document.getElementById('image-grid');
//   var imgTemplate = document.getElementById(
//     'image-template'
//   ) as HTMLTemplateElement;

//   if (imgTemplate) {
//     const images = 300;
//     for (var i = 0; i < images; i++) {
//       var img = imgTemplate.content.cloneNode(true);
//       (img as HTMLElement).querySelector('img')!.src =
//         'https://picsum.photos/200?random=' + i;
//       if (imageGrid) {
//         imageGrid.appendChild(img);
//       }
//     }
//   }
// }

async function addImages(images: string[]) {
  setMessage('Loading images...');
  var imageGrid = document.getElementById('image-grid');

  if (imageGrid?.hasChildNodes()) {
    imageGrid.innerHTML = '';
  }

  var imgTemplate = document.getElementById(
    'image-template'
  ) as HTMLTemplateElement;

  if (imgTemplate) {
    for (var i = 0; i < images.length; i++) {
      var img = imgTemplate.content.cloneNode(true) as HTMLElement;
      const path = convertFileSrc(images[i]);
      console.log(i);
      img.querySelector('img')!.src = path;

      img.querySelector('img')!.addEventListener('click', selectImage);
      if (imageGrid) {
        imageGrid.appendChild(img);
      }
    }
  }
  waitForImagesToLoad(
    Array.from(document.querySelectorAll<HTMLImageElement>('img'))
  ).then(() => {
    hideModal();
    enableButtons();
  });
}

function eraseImages() {
  var imageGrid = document.getElementById('image-grid');
  if (imageGrid) {
    imageGrid.innerHTML = '';
  }
  setMessage('Click Load');
  SELECTED_IMAGE = null;
  showModal();
}

function setMessage(message: string | null) {
  const msgEl = document.getElementById('msg');
  if (msgEl) {
    msgEl.textContent = message;
  }
}
function updateProgress(percent: string) {
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.width = percent + '%';
  }
}
function hideModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function showModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function disableButtons() {
  const buttons = document.querySelectorAll('button');
  buttons.forEach((button) => {
    button.setAttribute('disabled', 'true');
  });
}

function enableButtons() {
  const buttons = document.querySelectorAll('button');
  buttons.forEach((button) => {
    button.removeAttribute('disabled');
  });
}

function setButtonHandlers() {
  document.getElementById('load')?.addEventListener('click', load);
  document.getElementById('set')?.addEventListener('click', set);
  document.getElementById('erase')?.addEventListener('click', erase);
}

function selectImage(event: Event) {
  const target = event.target as HTMLElement;

  if (target.tagName === 'IMG') {
    const clickedImage = target as HTMLImageElement;

    if (SELECTED_IMAGE) {
      SELECTED_IMAGE.classList.remove('highlight');
    }

    clickedImage.classList.add('highlight');
    SELECTED_IMAGE = clickedImage;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setButtonHandlers();
});
