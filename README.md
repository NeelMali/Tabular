# AI Data Extractor

Upload a document, define what columns you want, and get a clean, editable data table — exported as CSV, Excel, or JSON.

## Features

- **Formats** — PDF, Excel (.xlsx/.xls), Word (.docx), CSV, Images (JPG, PNG, WebP)
- **AI Extraction** — Powered by [Groq](https://console.groq.com) (Llama 4 Scout) by default; configurable via `.env`
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

Edit `.env` — at minimum add one API key:

```env
GROQ_API_KEY=your_key_here
# GOOGLE_API_KEY=...
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
```

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
│   ├── services/parser.js     # Document parsing
│   ├── services/gemini.js     # Multi-provider AI
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
| `GROQ_API_KEY` | — | Groq API key (default provider) |
| `GOOGLE_API_KEY` | — | Google Gemini API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic Claude API key |
| `PORT` | `3000` | Server port |
| `MAX_FILE_SIZE_MB` | `20` | Max upload size |
| `RATE_LIMIT_PER_MIN` | `10` | Extraction rate limit |

## API

### `POST /api/extract`
Upload a file and extract structured data.

**Body** (multipart/form-data):
- `file` — Document
- `columns` — JSON array, e.g. `'["Name","Email","Phone"]'`

**Response:**
```json
{
  "id": 1,
  "filename": "contacts.pdf",
  "columns": ["Name", "Email"],
  "data": [{ "Name": "Jane", "Email": "jane@example.com" }],
  "rowCount": 1
}
```

### `POST /api/detect-columns`
Auto-detect column headers from a document.

### `GET /api/extractions`
List last 50 extractions.

### `GET /api/extractions/:id`
Get a specific extraction.

### `DELETE /api/extractions/:id`
Delete an extraction.

## License

MIT
