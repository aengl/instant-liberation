const _ = require('lodash');
const axios = require('axios');
const debug = require('debug')('instalib:crawler');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');
const yaml = require('js-yaml');
const url = require('url');

const defaultDataRoot = path.resolve(os.homedir(), '.instalib');

function download(source, target) {
  const urlInfo = url.parse(source);
  if (!urlInfo.protocol) {
    // If the source doesn't specify a protocol, assume it's already downloaded
    return Promise.resolve();
  }
  return new Promise(async resolve => {
    debug(`downloading "${source}"`);
    const response = await axios.get(source, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    fs.writeFile(target, response.data, resolve);
    debug(`wrote "${target}"`);
  });
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
    });

    // Go to user page
    debug(`navigating to "${profileUrl}"`);
    const browser = await puppeteer.launch({
      userDataDir: options.userDataDir,
    });
    const page = await browser.newPage();
    const response = await page.goto(profileUrl);
    if (!response.ok()) {
      throw new Error(response.status());
    }

    // Get all post links and extract their IDs
    const postUrls = await page.$$eval('a', urls => urls.map(a => a.href));
    const postIDs = postUrls
      .map(href => href.match(/\/p\/(?<id>[^/]+)\//))
      .filter(match => !!match)
      .map(match => match.groups.id);
    debug(`found ${postIDs.length} post(s)`);

    if (postIDs.length === 0) {
      debug('the account might be private -- try calling "login" first');
    } else {
      // Get GraphQL data for all posts
      debug(`querying data for all posts`);
      const results = await Promise.all(
        postIDs.map(id =>
          page.evaluate(async _id => {
            // eslint-disable-next-line no-undef
            const res = await fetch(
              `https://www.instagram.com/p/${_id}/?__a=1`
            );
            const json = await res.json();
            return json;
          }, id)
        )
      );
      const data = results.map(result => result.graphql.shortcode_media);

      await page.close();
      await browser.close();

      // Store data
      debug(`writing data to "${options.dataPath}"`);
      fs.ensureFileSync(options.dataPath);
      fs.writeFileSync(options.dataPath, yaml.dump(data));
    }
  },

  download: async (dataPath, options) => {
    options = _.defaults(options, {
      field: 'display_url',
      mediaRoot: path.resolve('media'),
    });

    // Read data file
    const data = yaml.safeLoad(fs.readFileSync(dataPath));

    // Store media
    fs.ensureDirSync(options.mediaRoot);
    await Promise.all(
      data.map(d => {
        const source = _.get(d, options.field);
        const target = path.join(options.mediaRoot, path.basename(source));
        _.set(d, options.field, path.relative(options.mediaRoot, target));
        return download(source, target);
      })
    );

    // Store updated data
    fs.writeFileSync(dataPath, yaml.dump(data));
  },
};
