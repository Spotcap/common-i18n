"use strict";
const _ = require("lodash");
const aws = require("aws-sdk");

module.exports = class Config {
  constructor (options) {
    this.configure(options);
  }

  configure (options) {
    this._LOCALES = _.get(options, "LOCALES", []);
    this._CACHE_MINUTES = _.get(options, "CACHE_MINUTES", 0);
    this._WORKSPACE = _.get(options, "WORKSPACE", null);
    this._BUCKET = _.get(options, "S3_BUCKET", null);
    this._ACCESS_KEY_ID = _.get(options, "S3_ACCESS_KEY_ID", null);
    this._SECRET_ACCESS_KEY = _.get(options, "S3_SECRET_ACCESS_KEY", null);
    this._REGION = _.get(options, "S3_REGION", null);
    this._LOKALISE_BASE_URL = _.get(options,"LOKALISE_BASE_URL",null);
    this._CEMBRA_PROJECT_ID = _.get(options,"CEMBRA_PROJECT_ID",null);
    this._LOKALISE_API_TOKEN = _.get(options,"LOKALISE_API_TOKEN",null);
  }

  getConfiguration () {
    return {
      _LOCALES: this._LOCALES,
      _CACHE_MINUTES: this._CACHE_MINUTES,
      _WORKSPACE: this._WORKSPACE,
      _BUCKET: this._BUCKET,
      _LOKALISE_BASE_URL : this._LOKALISE_BASE_URL,
      _CEMBRA_PROJECT_ID : this._CEMBRA_PROJECT_ID,
      _LOKALISE_API_TOKEN : this._LOKALISE_API_TOKEN,
      _S3: new aws.S3({
        accessKeyId: this._ACCESS_KEY_ID,
        secretAccessKey: this._SECRET_ACCESS_KEY,
        region: this._REGION,
        params: {
          Bucket: this._BUCKET
        }
      })
    }
  }
};