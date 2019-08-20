"use strict";

const moment = require("moment");
const _ = require("lodash");
const configuration = require("./config");
const Promise = require("bluebird");
const request=require("request");
var AdmZip = require('adm-zip');
var async=require("async");
module.exports = class Translation {
  constructor (options) {
    this.config = new configuration(options).getConfiguration();
    this.cache_time = null;
    this.translation = {};
    this.config._LOCALES.map((locale)=> {
      this.translation[locale] = {
        value: {},
        metadata: {
          cache_time : null
        }
      };
    });
    this.countryMap ={
      "au" : "au",
      "uk" : "uk",
      "nl" :  "nl",
      "nz" : "nz",
      "at" : "at",
      "ch" : "de",
      "de" : "de",
      "fr" : "fr_CH",
      "it" : "it_CH",
      "en" : "en_GB"
    };
    this.spawnTranslations();
  }

  getTranslationByKeyAndLocale (key, dependentKeys, locale, cb) {
    let self = this;
    locale = locale.toLowerCase();
    locale = this.countryMap[locale];
    // If cache can be used, use it to serve translations;
    if (self.canUseCache(locale)) {
      return cb(null, self.fetchKeyFromJSON(key, dependentKeys, locale));
    } else {
      // if cache cannot be used , serve it from previous cache and update it in background.
      if (!_.isEmpty(self.translation[locale].value)) {
        let cembraLocales=["de","it_CH","fr_CH","en_GB"];
        if(cembraLocales.indexOf(locale)>-1){
          this.getTranslationsFromLokalise().then((response) => {
            console.error("Translations downloaded successfully");
          }).catch((e) => {
            console.error(`Error while downloading translations ${locale}, ${e.stack}`);
          });;
        }
        else{
          self.downloadTranslationData(locale).then((response) => {
            self.updateCache(locale, response);
          }).catch((e) => {
            console.error(`Error while downloading translations ${locale}, ${e.stack}`);
          });
        }

        try {
          return cb(null, self.fetchKeyFromJSON(key, dependentKeys, locale));
        } catch (e) {
          return cb(e, null);
        };
      } else {
        // If cache cannot be used and no previous cache available download , update cache and serve it.
        let cembraLocales=["de","it_CH","fr_CH","en_GB"];
        if(cembraLocales.indexOf(locale)>-1){
          this.getTranslationsFromLokalise().then((response) => {
            return cb(null, self.fetchKeyFromJSON(key, dependentKeys, locale));
          }).catch((e) => {
            console.error(`Error while downloading translations ${locale}, ${e.stack}`);
            return cb(e, null);
          });
        }
        else{
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
  }

  canUseCache (locale) {
    return !_.isEmpty(this.translation[locale].value) &&
        this.translation[locale].metadata.cache_time.clone().add(this.config._CACHE_MINUTES, "minutes").isAfter(moment());
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
      data[key] = this.translation[locale].value[key];
    });

    data[key] = this.translation[locale].value[key];
    data.key = key;

    return data;
  }

  getTranslationsFromLokalise(){
    let self = this;
    var options = {
      url: this.config._LOKALISE_BASE_URL+this.config._CEMBRA_PROJECT_ID+"/files/download",
      headers: {
          "x-api-token": this.config._LOKALISE_API_TOKEN
      },
      json: {
          "format": "json",
          "original_filenames": false
      },
      gzip: true
    }
    return new Promise((resolve,reject) => {
      request.post(options, function (err, data) {
        if (err) {
          return reject(err);
        }
        else if (data.statusCode == 200) {
            if (data.body.bundle_url) {
              var reqOpts = {
                method: "GET",
                uri: data.body.bundle_url,
                json: true,
                encoding: null
            }
              request(reqOpts, function (err, res, body) {
                if (err) {
                  return reject(err);
                }
                var zip = new AdmZip(body);
                var zipEntries = zip.getEntries();
                async.each(zipEntries, function (zipContent, callback) {
                    if(!zipContent.isDirectory){
                      var locale=zipContent.name.split('.')[0];
                      self.updateCache(locale,JSON.parse(zipContent.getData().toString()));
                    }
                }, function (err) {
                    if (err) {
                      return reject(err);
                    }
                    else{
                      return resolve(body);
                    }
                })
            })
            }
        }
        else{
          return reject("Downloading Translations failed");
        }
      })
    })
  }

  spawnTranslations () {
    let self = this;
    let alpha = moment();
    let counter=0;
      console.info(`Spawning Translations started for ${self.config._LOCALES}`);
      Promise.map(self.config._LOCALES, (translationLocale) => {
        let cembraLocales=["de","it_CH","fr_CH","en_GB"];
        if(cembraLocales.indexOf(translationLocale)>-1){
          if(counter>0){
            return null;
          }
          else{
            return self.getTranslationsFromLokalise().then((response) => {
            }).catch((e) => {
              console.error(`Error while downloading translations ${locale}, ${e.stack}`);
            });
          }
        }
        else{
          return self.downloadTranslationData(translationLocale).then( (transations) => {
            self.updateCache(translationLocale, transations);
            console.info(`Spawning Translations finished for ${translationLocale}`);
          });
        }
      }).then(() => {
        console.info(`Spawning Translations finished for ${self.config._LOCALES} in ${moment().diff(alpha)} ms`);
      }).catch((e) => {
        console.error(`Error while spawning translations ${e.stack}`);
        throw e.stack;
      });
  }

  updateCache(locale, translations) {
    this.translation[locale].value = translations;
    this.translation[locale].metadata.cache_time = moment();
  }
};
