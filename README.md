# TableForge — AI Document Table Extractor

Extract structured data tables from **any document** using Google Gemini AI. Upload a PDF, Excel, Word, CSV, or image file, define your output columns, and get a perfectly formatted table in seconds.

## ✨ Features

- **Multi-format support** — PDF, Excel (.xlsx/.xls), Word (.docx), CSV, Images (JPG, PNG, WebP)
- **AI-powered extraction** — Google Gemini 2.0 Flash for intelligent data parsing
- **Structured output** — Define exactly which columns you want
- **Export** — Download results as CSV, Excel, or JSON
- **Extraction history** — Browse and re-load past extractions
- **Dark mode** — System-aware with manual toggle
- **Production-ready** — Rate limiting, security headers, error handling, SQLite persistence

## 🚀 Quick Start

### 1. Clone & Install

```bash
cd Summariser
npm install
```

### 2. Configure

Copy the example env file and add your Gemini API key:

```bash
cp .env.example .env
```

Edit `.env`:
```
GEMINI_API_KEY=your_api_key_here
```

Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 3. Run

```bash
npm run dev
```

This starts both the backend (port 3000) and frontend (port 5173) with hot reload.

Open **http://localhost:5173** in your browser.

### Production

```bash
npm run build
npm start
```

Serves the built frontend from Express on port 3000.

## 📁 Project Structure

```
├── server/                    # Express backend
│   ├── index.js               # Server entry + middleware
│   ├── routes/extract.js      # API endpoints
│   ├── services/parser.js     # Document parsing
│   ├── services/gemini.js     # Gemini AI integration
│   ├── db/database.js         # SQLite persistence
│   └── middleware/            # Upload, rate limit, errors
├── client/                    # Vite frontend
│   ├── index.html
│   └── src/
│       ├── main.js            # App orchestration
│       ├── api.js             # Backend API client
│       ├── components/        # UI components
│       └── styles/            # CSS design system
├── .env                       # Environment config (not in git)
├── .env.example               # Template
└── package.json
```

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | **Required.** Google AI API key |
| `PORT` | `3000` | Server port |
| `MAX_FILE_SIZE_MB` | `20` | Maximum upload size |
| `RATE_LIMIT_PER_MIN` | `10` | Rate limit for extraction endpoint |

## 📡 API Reference

### `POST /api/extract`
Upload a file and extract data.

**Body** (multipart/form-data):
- `file` — Document file
- `columns` — JSON array string, e.g. `'["Name","Email","Phone"]'`

**Response:**
```json
{
  "id": 1,
  "filename": "contacts.pdf",
  "fileType": "PDF",
  "columns": ["Name", "Email", "Phone"],
  "data": [{ "Name": "John", "Email": "john@example.com", "Phone": "555-0123" }],
  "rowCount": 1
}
```

### `GET /api/extractions`
List past extractions (last 50).

### `GET /api/extractions/:id`
Get a specific extraction with full result data.

### `DELETE /api/extractions/:id`
Delete an extraction record.

### `GET /api/health`
Health check endpoint.

## 📄 License

MIT
