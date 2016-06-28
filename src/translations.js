"use strict";

const moment = require("moment");
const _ = require("lodash");
const configuration = require("./config");
const Promise = require("bluebird");

module.exports = class Translation {
  constructor (options) {
    this.config = new configuration(options).getConfiguration();
    this.cache_time = null;
    this.translation = {};
    this.config._LOCALES.map((locale)=> {
      this.translation[locale] = {};
    });
    this.spwanTranslations();
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
        self.downloadTranslationData(locale).then((response) => {
          self.updateCache(locale, response);
        }).catch((e) => {
          console.error(`Error while downloading translations ${locale}, ${e.stack}`);
        });

        try {
          return cb(null, self.fetchKeyFromJSON(key, dependentKeys, locale));
        } catch (e) {
          return cb(e, null);
        };
      } else {
        // If cache cannot be used and no previous cache available download , update cache and serve it.
        self.downloadTranslationData(locale).then((response) => {
          self.updateCache(locale, response);
          return cb(null, self.fetchKeyFromJSON(key, dependentKeys, locale));
        }).catch((e) => {
          console.error(`Error while downloading translations ${locale}, ${e.stack}`);
          return cb(e, null);
        });
      }
    }
  }

  canUseCache (locale) {
    return !_.isEmpty(this.translation[locale]) &&
        this.cache_time.clone().add(this.config._CACHE_MINUTES, "minutes").isAfter(moment());
  }

  downloadTranslationData (locale) {
    let self = this;
    return new Promise ((resolve, reject) => {
      self.config._S3.getObject({
        Bucket: self.config._BUCKET,
        Key: `${self.config._WORKSPACE}/${locale}.json`
      }, function (err, data) {
        if (err) {
          return reject(err);
        } else {
          return resolve(JSON.parse(data.Body.toString()));
        }
      });
    });
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

  spwanTranslations () {
    let self = this;
    let alpha = moment();

    console.info(`Spawning Translations started for ${self.config._LOCALES}`);

    Promise.map(self.config._LOCALES, (translationLocale) => {
      return self.downloadTranslationData(translationLocale).then( (transations) => {
        self.updateCache(translationLocale, transations);
        console.info(`Spawning Translations finished for ${translationLocale}`);
      });
    }).then(() => {
      console.info(`Spawning Translations finished for ${self.config._LOCALES} in ${moment().diff(alpha)} ms`);
    }).catch((e) => {
      console.error(`Error while spawning translations ${e.stack}`);
      throw e.stack;
    });
  }

  updateCache(locale, translations) {
    this.translation[locale] = translations;
    this.cache_time = moment();
  }
};