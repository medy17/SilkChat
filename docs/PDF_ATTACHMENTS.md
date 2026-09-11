# PDF attachments and imports

PDF uploads have a 30-page limit. The browser checks before upload, and the server uses PDFium to validate stored PDFs before accepting direct-upload completion or sending a PDF to a model.

## Imports

Conversations containing PDF attachment references are rejected in all import modes, including mirror, external links, and skip attachments. Remove the PDF attachments from the export before importing; upload eligible PDFs afterward. Other conversations in a batch can still import.

The rejection checks attachment filenames, URL paths, storage keys in proxy URLs, and supplied MIME types. Mirroring also rejects a PDF response MIME type before reading its body. This is not general content sniffing: foreign URLs can change or misrepresent their content. The model-facing PDF path separately refuses foreign URLs and requires server validation of stored objects.

## Persisted validation

`pdfValidations` records server-computed page counts, unreadable-file errors, or size-limit rejections. Records are tied to a server-generated R2 key and its metadata identity (bucket, modification time, size, and checksum when available). Clients cannot write these records. Upload keys are unique; direct uploads use conditional writes to prevent replacement.

Later turns read the record and apply the current page limit without downloading or parsing again. Over-limit counts, unreadable-file failures, and size-limit rejections are cached too. Size rejections from stored metadata, response Content-Length, and the streaming byte counter all prevent subsequent downloads for the same object identity. Network/setup failures are not cached. Existing stored PDFs are checked lazily on first use. Concurrent first-time validations can race, but later uses share the persisted result.

Replacing objects outside the application's immutable upload flow must also resync R2 metadata or invalidate their validation records. Do not overwrite objects behind accepted keys. Foreign PDFs in old conversations must be uploaded again.

## Future attachment watchdog

A dedicated Cloudflare service could download, enforce byte/type limits, validate PDFs, convert Office documents, and write accepted bytes directly to R2. Convex would handle authorization and store authenticated admission metadata, keeping file bytes out of Convex. PDF imports could then be supported by mirroring verified bytes even when the user otherwise keeps foreign links.

The PDFium cloud-dev experiment counted the supplied 5.94 MB PDF as 253 pages in 1.18 seconds, with about 136 MiB peak Node process RSS. This establishes feasibility for that document, not an OOM guarantee. The tested WASM build has a 2 GB heap ceiling; a future Worker implementation needs separate memory/concurrency testing and bounded parsing. Office conversion and the Worker service are not implemented here.
