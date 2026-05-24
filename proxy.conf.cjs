const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, 'e2e/fixtures/catalog.json');
const items = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const productDemoPath = path.join(__dirname, 'e2e/fixtures/product-demo.json');
const productDemo = fs.readFileSync(productDemoPath, 'utf8');

/** @type {import('@angular-devkit/build-angular').ProxyConfig} */
module.exports = {
  '/api/items': {
    bypass(_req, res) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(items));
    },
  },
  '/api/product/demo': {
    bypass(_req, res) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(productDemo);
    },
  },
};
