# AI Data Extractor

Upload a document, define what columns you want, and get a clean, editable data table — exported as CSV, Excel, or JSON.

## Features

- **Formats** — PDF, Excel (.xlsx/.xls), Word (.docx), CSV, Images (JPG, PNG, WebP)
- **Smart extraction** — Excel/CSV files are parsed directly (all rows, instant). PDF/Word/Image use Claude AI.
- **Auto-detect columns** — Let AI suggest headers from your document
- **Inline editing** — Click any cell to edit; add/delete rows and columns after extraction
- **Export** — Download as CSV, Excel, or JSON
- **History** — Browse and reload past extractions (SQLite persistence)
- **Dark/Light mode** — Toggle in the top bar

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
ANTHROPIC_API_KEY=your_claude_api_key_here
```

Get a key at [console.anthropic.com](https://console.anthropic.com)

> **Note:** An API key is only needed for PDF, Word, and Image files. Excel and CSV files are parsed directly — no AI required.

### 3. Run

**Development** (hot reload):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

**Production:**
```bash
npm run build
npm start
```
Serves everything from Express on port 3000.

## Project Structure

```
├── server/
│   ├── index.js               # Express server
│   ├── routes/extract.js      # API routes
│   ├── services/ai.js         # Claude AI (PDF/Word/Image only)
│   ├── services/parser.js     # Document parsing + direct Excel/CSV extraction
│   ├── db/database.js         # SQLite
│   └── middleware/            # Upload, rate-limit, errors
├── client/
│   ├── index.html
│   └── src/
│       ├── main.js
│       ├── api.js
│       ├── components/
│       └── styles/
├── .env.example
└── package.json
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude API key (required for PDF/Word/Image) |
| `PORT` | `3000` | Server port |
| `MAX_FILE_SIZE_MB` | `20` | Max upload size |
| `RATE_LIMIT_PER_MIN` | `10` | Extraction rate limit |

## API

### `POST /api/extract`
Upload a file and extract structured data.

- Excel/CSV → parsed directly, returns **all rows**
- PDF/Word/Image → sent to Claude AI

### `POST /api/detect-columns`
Auto-detect column headers from a document.

### `GET /api/extractions`
List last 50 extractions.

### `GET /api/extractions/:id` / `DELETE /api/extractions/:id`
Get or delete a specific extraction.

## License

MIT
