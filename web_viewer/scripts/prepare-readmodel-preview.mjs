// Kept for existing commands and records: forwards to the one packager as a preview package.
// New work calls scripts/prepare-pages-package.mjs --target preview|production directly.
process.argv.splice(2, 0, '--target', 'preview')
await import('./prepare-pages-package.mjs')
