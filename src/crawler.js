const _ = require('lodash');
const debug = require('debug')('instalib:crawler');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');
const yaml = require('js-yaml');

const defaultDataRoot = path.resolve(os.homedir(), '.instalib');

module.exports = {
  login: async dataRoot => {
    const browser = await puppeteer.launch({
      headless: false,
      userDataDir: dataRoot || defaultDataRoot,
    });
    const page = await browser.newPage();
    await page.goto('https://www.instagram.com/accounts/login');
  },

  crawl: async (url, options) => {
    options = _.defaults(options, {
      dataPath: path.resolve('data.yml'),
      mediaRoot: path.resolve('media'),
      dataRoot: defaultDataRoot,
    });

    // Go to user page
    debug(`navigating to "${url}"`);
    const browser = await puppeteer.launch({
      userDataDir: options.dataRoot,
    });
    const page = await browser.newPage();
    const response = await page.goto(url);
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
      fs.writeFileSync(options.dataPath, yaml.dump(data));
    }
  },
};
