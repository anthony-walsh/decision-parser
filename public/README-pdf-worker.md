# PDF.js Worker Self-Hosting Setup

## Security Enhancement

For production deployments, the PDF.js worker should be self-hosted to avoid dependency on external CDNs and potential supply chain attacks.

## Required File

Download the PDF.js worker file and place it at:
```
public/pdf.worker.min.mjs
```

## Download Instructions

1. Go to https://github.com/mozilla/pdf.js/releases
2. Download the latest stable release
3. Extract the `build/pdf.worker.min.mjs` file
4. Copy it to `public/pdf.worker.min.mjs`

## Alternative: npm installation

```bash
# Download from npm
npm install pdfjs-dist@4.10.38

# Copy worker file
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
```

## Environment Configuration

- **Development**: Uses CDN for convenience (`https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`)
- **Production**: Uses self-hosted file (`/pdf.worker.min.mjs`)

This is automatically configured through the environment detection system in `src/utils/environment.ts`.

## Verification

After placing the file, verify it's accessible at:
```
http://yourdomain.com/pdf.worker.min.mjs
```

The file should return JavaScript content with Content-Type `application/javascript` or `text/javascript`.