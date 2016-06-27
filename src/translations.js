"use strict";

const moment = require("moment");
const _ = require("lodash");
const configuration = require("./config");

module.exports = class Translation {
  constructor (options) {
    this.config = new configuration(options).getConfiguration();
    this.locale = null;
    this.cache_time = null;
    this.translation = {};
    this.config._LOCALES.map((locale)=> {
      this.translation[locale] = {};
    });
  }

  getTranslationByKeyAndLocale (key, dependentKeys, locale, cb) {
    let self = this;
    locale = locale.toLowerCase();

    // If cache can be used, use it to serve translations;
    if (self.canUseCache(locale)) {
      return cb(null, self.fetchKeyFromJSON(key, dependentKeys, locale));
    } else {
      // if cache cannot be used , serve it from previous cache and update it in background.
      if (!_.isEmpty(self.translation[locale])) {
        self.downloadTranslationData(locale, function (err, response) {
          if (err) {
            console.error(`Error while downloading translations ${locale}, ${err}`);
            return cb(err, null);
          }

          self.translation[locale] = response;
          self.cache_time = moment();
          self.locale = locale;
        });

        try {
          return cb(null, self.fetchKeyFromJSON(key, dependentKeys, locale));
        } catch (e) {
          return cb(e, null);
        };

      } else {
        // If cache cannot be used and not previous cache i.e first time download and serve it.
        self.downloadTranslationData(locale, function (err, response) {
          if (err) {
            console.error(`Error while downloading translations ${locale}, ${err}`);
            return cb(err, null);
          }

          self.translation[locale] = response;
          self.cache_time = moment();
          self.locale = locale;

          try {
            return cb(null, self.fetchKeyFromJSON(key, dependentKeys, locale));
          } catch (e) {
            return cb(e, null);
          };
        });
      }
    }
  }

  canUseCache (locale) {
    return locale === this.locale && !_.isEmpty(this.translation[locale]) &&
        this.cache_time.clone().add(this.config._CACHE_MINUTES, "minutes").isAfter(moment());
  }

  downloadTranslationData (locale, cb) {
    try {
      this.config._S3.getObject({
        Bucket: this.config._BUCKET,
        Key: `${this.config._WORKSPACE}/${locale}.json`
      }, function (err, data) {
        if (err) {
          return cb(err, null);
        } else {
          return cb(null, JSON.parse(data.Body.toString()))
        }
      });
    } catch (e) {
      return cb(e, null);
    }
  }

  fetchKeyFromJSON (key, dependentKeys, locale) {
    let data = {};

    dependentKeys.map((key)=> {
      data[key] = this.translation[locale][key];
    });

    data[key] = this.translation[locale][key];
    data.key = key;

    return data;
  }
};