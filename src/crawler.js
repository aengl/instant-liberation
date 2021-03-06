const os = require('os');
const path = require('path');

const _ = require('lodash');
const debug = require('debug')('instalib:crawler');
const fs = require('fs-extra');
const got = require('got');
const puppeteer = require('puppeteer');
const yaml = require('js-yaml');

const defaultDataRoot = path.resolve(os.homedir(), '.instalib');

async function download(source, target) {
  const urlInfo = new URL(source);
  if (!urlInfo.protocol) {
    // If the source doesn't specify a protocol, assume it's already downloaded
    return;
  }

  debug(`downloading "${source}"`);
  const response = await got(source, {
    encoding: null,
    retries: 5,
    timeout: 30000,
  });
  fs.writeFileSync(target, response.body);
  debug(`wrote "${target}"`);
}

async function queryNode(page, node) {
  const result = await page.evaluate(async id => {
    // eslint-disable-next-line no-undef
    const res = await fetch(`https://www.instagram.com/p/${id}/?__a=1`);
    const json = await res.json();
    return json;
  }, node.shortcode);
  return {
    index: node,
    detail: result.graphql.shortcode_media,
  };
}

async function scrollToBottom(page) {
  page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  try {
    await page.waitForResponse(res => Boolean(res.url().match(/graphql/)), {
      timeout: 5000,
    });
    // Wait a bit for the DOM to be updated
    // TODO: this is a bit brittle, we should properly wait for DOM changes
    await page.waitFor(200);
    return false;
  } catch (error) {
    // When the wait times out, no requests were fired so we assume we've
    // reached the bottom.
    return true;
  }
}

module.exports = {
  login: async options => {
    options = _.defaults(options, {
      userDataDir: defaultDataRoot,
    });
    const browser = await puppeteer.launch({
      headless: false,
      userDataDir: options.userDataDir,
    });
    const page = await browser.newPage();
    await page.goto('https://www.instagram.com/accounts/login');
  },

  crawl: async (profileUrl, options) => {
    options = _.defaults(options, {
      dataPath: path.resolve('data.yml'),
      userDataDir: defaultDataRoot,
      numPosts: Infinity,
    });

    // Create page that intercepts graphql calls
    debug(`launching Chromium`);
    const browser = await puppeteer.launch({
      userDataDir: options.userDataDir,
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    const posts = [];
    page.on('request', request => {
      // Block irrelevant resources
      if (
        ['image', 'stylesheet', 'font'].indexOf(request.resourceType()) === -1
      ) {
        request.continue();
      } else {
        request.abort();
      }
    });
    page.on('response', async response => {
      if (response.url().match(/graphql/)) {
        const json = await response.json();
        const edges = _.get(
          json,
          'data.user.edge_owner_to_timeline_media.edges'
        );
        if (edges) {
          edges.forEach(async edge =>
            posts.push(await queryNode(page, edge.node))
          );
          debug(`collected ${posts.length} posts`);
        }
      }
    });

    // Go to user page
    debug(`navigating to "${profileUrl}"`);
    const response = await page.goto(profileUrl);
    if (!response.ok()) {
      throw new Error(response.status());
    }

    // Push initial data
    const initialEdges = await page.evaluate(
      () =>
        // eslint-disable-next-line no-undef
        window._sharedData.entry_data.ProfilePage[0].graphql.user
          .edge_owner_to_timeline_media.edges
    );
    initialEdges.forEach(async edge =>
      posts.push(await queryNode(page, edge.node))
    );

    // Scroll to the bottom
    let atBottom = false;
    while (!atBottom && posts.length < options.numPosts) {
      atBottom = await scrollToBottom(page);
    }

    // Store data
    if (posts) {
      debug(`found ${posts.length} post(s)`);
      debug(`writing data to "${options.dataPath}"`);
      fs.ensureFileSync(options.dataPath);
      fs.writeFileSync(
        options.dataPath,
        yaml.dump(
          _.orderBy(
            posts.slice(0, options.numPosts),
            'index.taken_at_timestamp',
            'desc'
          )
        )
      );
    }

    // Close browser
    // Give Chromium some time to finish up outstanding async calls;
    // TODO: should not be necessary
    await page.waitFor(2000);
    await page.close();
    await browser.close();
  },

  mirror: async (dataPath, options) => {
    options = _.defaults(options, {
      field: 'detail.display_url',
      mediaRoot: path.resolve('media'),
      batchSize: 12,
      pause: 1000,
    });

    // Read data file
    debug(`reading data file from "${dataPath}"`);
    const posts = yaml.safeLoad(fs.readFileSync(dataPath));

    // Download and store media
    fs.ensureDirSync(options.mediaRoot);
    debug(`downloading media`);
    try {
      for (let i = 0; i < posts.length; i += options.batchSize) {
        const sources = posts
          .slice(i, i + options.batchSize)
          .map(post => ({ post, source: _.get(post, options.field) }))
          .filter(({ source }) => !_.isNil(source));

        if (sources.length > 0) {
          await Promise.all(
            sources.map(async ({ post, source }) => {
              const target = path.join(
                options.mediaRoot,
                path.basename(new URL(source).pathname)
              );
              await download(source, target);
              _.set(
                post,
                options.field,
                path.relative(options.mediaRoot, target)
              );
            })
          );

          const pause = _.random(options.pause * 0.8, options.pause * 1.2);
          debug(`waiting for ${pause}ms`);
          await new Promise(resolve => setTimeout(resolve, pause));
        }
      }
    } catch (error) {
      debug(error);
    } finally {
      // Store updated data
      fs.writeFileSync(dataPath, yaml.dump(posts));
    }
  },
};
