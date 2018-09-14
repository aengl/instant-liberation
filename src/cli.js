const debugModule = require('debug');
const path = require('path');
const program = require('caporal');
const packageJson = require('../package.json');
const crawler = require('./crawler');

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
  .option(
    '-d, --data <path>',
    'Data directory for Chromium (default: "~/.instalib")'
  )
  .action(async (args, options) => {
    if (!process.env.DEBUG) {
      debugModule.enable('instalib:*');
    }
    await crawler.login({
      userDataDir: options.data ? path.resolve(options.data) : undefined,
    });
  });

/* ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^
 * Command: liberate
 * ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^ */

program
  .command('liberate', 'Grabs data from an Instagram profile')
  .argument('<url>', 'URL to the instagram profile')
  .option(
    '-o, --out <path>',
    'Output path for the data file (default: "data.yml")'
  )
  .option(
    '-d, --data <path>',
    'Data directory for Chromium (default: "~/.instalib")'
  )
  .option('-n, --num <path>', 'Stop after the specified number of posts')
  .action(async (args, options) => {
    if (!process.env.DEBUG) {
      debugModule.enable('instalib:*');
    }
    await crawler.crawl(args.url, {
      dataPath: options.out ? path.resolve(options.out) : undefined,
      userDataDir: options.data ? path.resolve(options.data) : undefined,
      numPosts: options.num,
    });
  });

/* ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^
 * Command: mirror
 * ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^ */

program
  .command('mirror', 'Mirrors the media in a data file')
  .argument('<path>', 'Path to the data file')
  .option(
    '-o, --out <path>',
    'Output path for the media files (default: "media")'
  )
  .option(
    '-f, --field <name>',
    'The name of the data field to mirror (default: "detail.display_url")'
  )
  .option(
    '-b, --batch-size <size>',
    'The number of images to download in parallel (default: 12)',
    program.INT
  )
  .action(async (args, options) => {
    if (!process.env.DEBUG) {
      debugModule.enable('instalib:*');
    }
    await crawler.mirror(args.path, {
      field: options.field,
      mediaRoot: options.out ? path.resolve(options.out) : undefined,
      batchSize: options.batchSize,
    });
  });

debug(process.argv);
program.parse(process.argv);
