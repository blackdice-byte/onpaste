# onpaste-playground

A small Vite app for exercising [`onpaste`](https://www.npmjs.com/package/onpaste)
against a real form.

```bash
npm install
npm run dev
```

The form covers, one fieldset at a time:

| Field | What it demonstrates |
| --- | --- |
| Title | plain `onPaste`, payload logged, paste untouched |
| Slug / Phone / Amount | `transform` rewriting the paste, and `null` dropping it |
| Notes / One per line | textareas, including tab/comma → newline splitting |
| Rich field | `onPastePlainText` on a `contenteditable` (double-click calls `insertText`) |
| Composer | `types: 'image/*'` plus `info.insert()` and thumbnails from `info.files` |
| Tags | `selector` delegation — rows added later are covered by the same listener |

Every listener shares one `AbortSignal`; the "Listeners attached" checkbox
aborts and reattaches the whole set. All pastes are logged in the panel at the
bottom.
