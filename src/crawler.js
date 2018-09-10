const debug = require('debug')('instalib:crawler');
const fs = require('fs-extra');
const _ = require('lodash');
const axios = require('axios');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const puppeteer = require('puppeteer');

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
    const browser = await puppeteer.launch({
      userDataDir: options.dataRoot,
    });
    const page = await browser.newPage();

    // Go to user page
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
    debug(`found ${postIDs.length} posts:`);
    debug(postIDs);

    await page.close();
    await browser.close();

    // Get GraphQL data for all posts
    const results = await Promise.all(
      postIDs.map(id => axios.get(`https://www.instagram.com/p/${id}/?__a=1`))
    );
    const data = results.map(result => result.data.graphql.shortcode_media);

    // Store data
    fs.writeFileSync(options.dataPath, yaml.dump(data));
  },
};
