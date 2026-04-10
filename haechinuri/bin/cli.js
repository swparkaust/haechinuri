#!/usr/bin/env node

const path = require('path');
const Builder = require('../core/builder');
const Server = require('../core/server');

const args = process.argv.slice(2);
const command = args[0];
const siteName = args[1] || process.env.SITE_NAME;
const projectRoot = path.resolve(__dirname, '..', '..');

function usage() {
  console.log('Usage: haechinuri <command> [site]');
  console.log('');
  console.log('Commands:');
  console.log('  build <site>   Build the site to dist/');
  console.log('  dev <site>     Start development server with live reload');
  console.log('  serve <site>   Start production server');
  process.exit(1);
}

if (!command || !siteName) usage();

switch (command) {
  case 'build': {
    try {
      const builder = new Builder(siteName, projectRoot);
      builder.build();
    } catch (e) {
      console.error('Build failed:', e.message);
      process.exit(1);
    }
    break;
  }

  case 'dev': {
    try {
      const builder = new Builder(siteName, projectRoot);
      builder.build();
      const port = parseInt(process.env.PORT, 10) || 3000;
      const server = new Server(siteName, projectRoot, { port, mode: 'dev' });
      server.start();
    } catch (e) {
      console.error('Dev server failed:', e.message);
      process.exit(1);
    }
    break;
  }

  case 'serve': {
    try {
      const port = parseInt(process.env.PORT, 10) || 3000;
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
      const server = new Server(siteName, projectRoot, {
        port,
        mode: 'serve',
        adminPassword
      });
      server.start();
    } catch (e) {
      console.error('Server failed:', e.message);
      process.exit(1);
    }
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    usage();
}
