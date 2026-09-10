# Synthetic photo fixtures

These images contain a programmatically generated RGB gradient, not personal photos.
`photo.png`, `photo.jpg` and `photo.avif` were encoded with sharp 0.35.4;
`photo.heic` was encoded from the PNG with macOS `sips -s format heic`.
`rotated-exif.jpg` has EXIF orientation 6 for orientation and metadata-removal checks.
`canvas-safari.jpg` is a black 640 × 480 canvas encoded by Playwright WebKit 26.6;
it exercises the EXIF/IPTC blocks added by Safari's JPEG encoder.
The fixtures are project-owned test data and may be reused under CC0-1.0.
