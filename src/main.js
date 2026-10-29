import { onPaste, onPastePlainText, insertText } from 'onpaste';

const logEl = document.querySelector('#log');
const thumbsEl = document.querySelector('#thumbs');
const armed = document.querySelector('#armed');

function log(label, detail) {
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString();
  li.innerHTML = `<span class="log-time">${time}</span><span class="log-label">${label}</span>`;
  const pre = document.createElement('pre');
  pre.textContent = detail;
  li.append(pre);
  logEl.prepend(li);
}

function describe({ text, html, files, types }) {
  return [
    `types: ${types.join(', ') || '(none)'}`,
    `text (${text.length}): ${JSON.stringify(text.slice(0, 120))}${text.length > 120 ? '…' : ''}`,
    `html: ${html ? JSON.stringify(html.slice(0, 120)) + (html.length > 120 ? '…' : '') : 'null'}`,
    `files: ${files.length ? files.map((f) => `${f.name || '(unnamed)'} ${f.type} ${f.size}B`).join(', ') : 'none'}`,
  ].join('\n');
}

// Every listener registers through one AbortController so the checkbox can
// detach and reattach the whole set.
let controller;

function attach() {
  controller = new AbortController();
  const { signal } = controller;

  // 1. Plain listener — inspect the payload, leave the paste alone.
  onPaste('#title', (info) => log('#title', describe(info)), { signal });

  // 2. transform — rewrite what lands in the field.
  onPaste('#slug', (info) => log('#slug transform', describe(info)), {
    signal,
    transform: ({ text }) =>
      text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  });

  onPaste('#phone', () => {}, {
    signal,
    transform: ({ text }) => {
      const digits = text.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
      log('#phone transform', `${JSON.stringify(text)} → ${JSON.stringify(digits)}`);
      return digits;
    },
  });

  // Returning null from transform drops the paste entirely.
  onPaste('#amount', () => {}, {
    signal,
    transform: ({ text }) => {
      const value = text.trim().replace(/[,\s$]/g, '');
      if (!/^-?\d*\.?\d+$/.test(value)) {
        log('#amount rejected', `${JSON.stringify(text)} is not a number — paste dropped`);
        return null;
      }
      log('#amount accepted', value);
      return value;
    },
  });

  // 3. Textareas.
  onPaste('#notes', (info) => {
    const lines = info.text ? info.text.split('\n').length : 0;
    log('#notes', `${info.text.length} chars, ${lines} line(s)\n${describe(info)}`);
  }, { signal });

  onPaste('#csv', () => {}, {
    signal,
    transform: ({ text }) =>
      text
        .split(/\r?\n/)
        .flatMap((line) => line.split(/[\t,]/))
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join('\n'),
  });

  // 4. contenteditable — strip formatting.
  onPastePlainText('#editor', (info) => {
    log('#editor plain text', describe(info));
  }, { signal });

  // 5. Files only — the handler never fires for text-only pastes.
  onPaste('#composer', ({ files, insert }) => {
    log('#composer image', files.map((f) => `${f.type} ${f.size}B`).join(', '));
    insert(files.map((f) => `[image: ${f.name || 'clipboard'}]`).join(' '));
    for (const file of files) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = file.name || 'pasted image';
      img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true });
      thumbsEl.append(img);
    }
  }, { signal, types: 'image/*' });

  // 6. Delegation — one listener on the container covers rows added later.
  onPaste('#tags', ({ target, text }) => {
    log('#tags delegated', `${target.tagName.toLowerCase()} ← ${JSON.stringify(text)}`);
  }, { signal, selector: 'input' });

  // 7. Native alert — the paste never lands, and the user is told why.
  onPaste('#passcode', ({ text }) => {
    log('#passcode blocked', `${text.length} char(s) kept out of the field`);
    alert('For your own security, type your passcode instead of pasting it.');
  }, { signal, preventDefault: true });

  // 8. Custom modal — hold the paste, show a preview, insert only on accept.
  onPaste('#confirm', (info) => {
    info.preventDefault();
    log('#confirm held', describe(info));
    confirmPaste(info).then((accepted) => {
      if (!accepted) {
        log('#confirm discarded', 'the user dismissed the modal — nothing inserted');
        return;
      }
      insertText(info.target, info.text);
      info.target.focus();
      log('#confirm inserted', `${info.text.length} char(s) written after confirmation`);
    });
  }, { signal });
}

// The modal is a plain <dialog>; onPaste only has to stop the native paste
// long enough for the answer to come back.
const modal = document.querySelector('#paste-modal');
const modalMeta = document.querySelector('#paste-modal-meta');
const modalPreview = document.querySelector('#paste-modal-preview');

function confirmPaste({ text, types }) {
  const lines = text ? text.split(/\r?\n/).length : 0;
  modalMeta.textContent = `${text.length} character(s), ${lines} line(s) — ${types.join(', ') || 'no types'}`;
  modalPreview.textContent = text.slice(0, 400) + (text.length > 400 ? '…' : '');
  modal.showModal();
  return new Promise((resolve) => {
    modal.addEventListener('close', () => resolve(modal.returnValue === 'accept'), { once: true });
  });
}

attach();

armed.addEventListener('change', () => {
  if (armed.checked) {
    attach();
    log('listeners', 'attached');
  } else {
    controller.abort();
    log('listeners', 'detached via AbortController');
  }
});

document.querySelector('#add-tag').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'tag';
  input.placeholder = 'Paste a tag';
  document.querySelector('#tags').append(input);
  input.focus();
});

document.querySelector('#clear-log').addEventListener('click', () => {
  logEl.replaceChildren();
});

document.querySelector('#demo').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  data.editor = document.querySelector('#editor').textContent;
  log('submit', JSON.stringify(data, null, 2));
});

document.querySelector('#demo').addEventListener('reset', () => {
  document.querySelector('#editor').textContent = '';
  thumbsEl.replaceChildren();
});

// insertText on its own, outside of a paste event.
document.querySelector('#editor').addEventListener('dblclick', () => {
  insertText(document.querySelector('#editor'), ' ⟨inserted⟩ ');
});
