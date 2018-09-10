const debugModule = require('debug');
const program = require('caporal');
const crawler = require('./crawler');
const packageJson = require('../package.json');

const debug = debugModule('instalib:cli');

process.on('unhandledRejection', error => {
  throw error;
});

program.version(packageJson.version);

/* ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^
 * Command: login
 * ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^ */

program
  .command('login', 'Opens a browser and stores your session')
  .action(async (args, options) => {
    if (!process.env.DEBUG) {
      debugModule.enable('instalib:*');
    }
    await crawler.login();
  });

/* ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^
 * Command: liberate
 * ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^ */

program
  .command(
    'liberate',
    'Downloads images and grabs data from an Instagram profile'
  )
  .argument('<url>', 'URL to the instagram profile')
  .action(async (args, options) => {
    if (!process.env.DEBUG) {
      debugModule.enable('instalib:*');
    }
    await crawler.crawl(args.url, 'tmp.yml');
  });

debug(process.argv);
program.parse(process.argv);
