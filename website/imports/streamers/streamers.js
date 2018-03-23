import Cheerio from 'cheerio';
import { Shows } from '/imports/api/shows/shows.js';
import { myanimelist } from './_myanimelist';
import { kissanime } from './_kissanime';
import { nineanime } from './_nineanime';
import {Thumbnails} from '../api/thumbnails/thumbnails';
import {Searches} from '../api/searches/searches';
import ScrapingHelpers from './scrapingHelpers';
import moment from 'moment-timezone';
import {Episodes} from '../api/episodes/episodes';

let streamers = [myanimelist, kissanime, nineanime];

export default class Streamers {
  static getStreamerById(id) {
    return streamers.find((streamer) => {
      return streamer.id === id;
    });
  }

  static getSimpleStreamerById(id) {
    let streamer = this.getStreamerById(id);
    if (streamer) {
      return {
        id: streamer.id,
        name: streamer.name,
        homepage: streamer.homepage
      };
    }
    return undefined;
  }

  static convertCheerioToShow(cheerioRow, cheerioPage, streamer, type) {
    // Create empty show
    let show = {};

    // Get 'type'
    if (streamer[type].attributes.type) {
      show.type = streamer[type].attributes.type(cheerioRow, cheerioPage);
      if (show.type && show.type.cleanWhitespace() === 'Music') {
        return false; // Reject music videos
      }
    }

    // Get 'genres'
    if (streamer[type].attributes.genres) {
      show.genres = streamer[type].attributes.genres(cheerioRow, cheerioPage);
      if (show.genres && show.genres.map((genre) => {
          return genre.cleanWhitespace();
        }).includes('Hentai')) {
        return false; // Reject hentai shows
      }
    }

    // Get 'streamerUrls'
    show.streamerUrls = streamer[type].attributes.streamerUrls(cheerioRow, cheerioPage);
    show.streamerUrls = show.streamerUrls.map((streamerUrl) => {
      streamerUrl.streamerId = streamer.id;
      return streamerUrl;
    });

    // Get 'malId'
    if (streamer[type].attributes.malId) {
      show.malId = streamer[type].attributes.malId(cheerioRow, cheerioPage);
    }

    // Get 'name'
    show.name = streamer[type].attributes.name(cheerioRow, cheerioPage);
    // Get 'altNames'
    if (streamer[type].attributes.altNames) {
      show.altNames = streamer[type].attributes.altNames(cheerioRow, cheerioPage);
    } else {
      show.altNames = [];
    }
    show.altNames.push(show.name);

    // Get 'description'
    if (streamer[type].attributes.description) {
      show.description = streamer[type].attributes.description(cheerioRow, cheerioPage);
    }

    // Get 'airedStart'
    if (streamer[type].attributes.airedStart) {
      show.airedStart = streamer[type].attributes.airedStart(cheerioRow, cheerioPage);
    }
    // Get 'airedEnd'
    if (streamer[type].attributes.airedEnd) {
      show.airedEnd = streamer[type].attributes.airedEnd(cheerioRow, cheerioPage);
    }

    // Get 'season'
    if (streamer[type].attributes.season) {
      show.season = streamer[type].attributes.season(cheerioRow, cheerioPage);
    }
    if (!show.season && show.airedStart && typeof show.airedStart.year !== 'undefined' && typeof show.airedStart.month !== 'undefined') {
      show.season = {
        quarter: Shows.validQuarters[moment().month(show.airedStart.month).quarter() - 1],
        year: show.airedStart.year
      };
    }

    // Get 'thumbnails'
    if (streamer[type].thumbnails) {
      show.thumbnails = [];
      cheerioRow.find(streamer[type].thumbnails.rowSelector).each((index, element) => {
        let url = streamer[type].thumbnails.getUrl(cheerioRow.find(element), cheerioPage);
        if (url) {
          show.thumbnails.push(Thumbnails.addThumbnail(url));
        }
      });
    }

    // Clean and validate show
    Schemas.Show.clean(show, {
      mutate: true
    });
    Schemas.Show.validate(show);

    // Return the show
    return show;
  }

  static convertCheerioToEpisodes(cheerioRow, cheerioPage, streamer, type) {
    // Get the different sources as base episodes
    let episodes = streamer[type].attributes.sources(cheerioRow, cheerioPage);

    // Set some default variables on the episodes
    episodes = episodes.map((episode) => {
      episode.showId = 'undefined';
      episode.streamerId = streamer.id;
      return episode;
    });

    // Set the upload time to now on some episodes
    episodes = episodes.map((episode) => {
      Schemas.Episode.clean(episode, {
        mutate: true
      });

      let now = moment();

      if (episode.uploadDate.year === now.year() && episode.uploadDate.month === now.month() && episode.uploadDate.date === now.date()
        && typeof episode.uploadDate.hour === 'undefined' && typeof episode.uploadDate.minute === 'undefined') {
        episode.uploadDate.hour = now.hour();
        episode.uploadDate.minute = now.minute();
      }

      return episode;
    });

    // Get 'episodeNumStart'
    let episodeNumStart = streamer[type].attributes.episodeNumStart(cheerioRow, cheerioPage);
    if (typeof episodeNumStart !== 'undefined' && !isNumeric(episodeNumStart)) {
      episodeNumStart = 1;
    }
    episodes = episodes.map((episode) => {
      episode.episodeNumStart = episodeNumStart;
      return episode;
    });

    // Get 'episodeNumEnd'
    let episodeNumEnd = streamer[type].attributes.episodeNumEnd(cheerioRow, cheerioPage);
    if (typeof episodeNumEnd !== 'undefined' && !isNumeric(episodeNumEnd)) {
      episodeNumEnd = 1;
    }
    episodes = episodes.map((episode) => {
      episode.episodeNumEnd = episodeNumEnd;
      return episode;
    });

    // Get 'translationType'
    let translationType = streamer[type].attributes.translationType(cheerioRow, cheerioPage);
    episodes = episodes.map((episode) => {
      episode.translationType = translationType;
      return episode;
    });

    // Clean and validate episodes
    episodes = episodes.map((episode) => {
      Schemas.Episode.clean(episode, {
        mutate: true
      });
      Schemas.Episode.validate(episode);
      return episode;
    });

    // Return the episodes
    return episodes;
  }

  static processSearchPage(html, streamer, logData) {
    let results = [];

    if (!html) {
      return results;
    }

    try {
      // Load page
      let page = Cheerio.load(html);

      // Check if we have a show page
      if (streamer.show.checkIfPage(page)) {
        let showResult = this.processShowPage(html, streamer, logData);

        results = results.concat(showResult.partials.map((partial) => {
          return {
            partial: partial,
            episodes: []
          };
        }));

        if (showResult.full) {
          results.push({
            partial: showResult.full,
            episodes: showResult.episodes,
            fromShowPage: true
          });
        }
      }

      // Otherwise we have a search page
      else {
        // For each row of data
        page(streamer.search.rowSelector).each((index, element) => {
          try {
            // Create and add show
            let result = this.convertCheerioToShow(page(element), page('html'), streamer, 'search');
            if (result) {
              results.push({
                partial: result,
                episodes: []
              });
            }
          }

          catch(err) {
            console.error('Failed to process search page with query: \'' + logData + '\' and streamer: \'' + streamer.id + '\'.');
            console.error('Failed to process row number ' + index + '.');
            console.error(err);
          }
        });
      }
    }

    catch(err) {
      console.error('Failed to process search page with query: \'' + logData + '\' and streamer: \'' + streamer.id + '\'.');
      console.error(err);
    }

    return results;
  }

  static processShowPage(html, streamer, logData) {
    let results = {
      full: false,
      partials: [],
      episodes: []
    };

    if (!html) {
      return results;
    }

    try {
      // Load page
      let page = Cheerio.load(html);

      // Create and store show
      let result = this.convertCheerioToShow(page('html'), page('html'), streamer, 'show');
      if (result) {
        results.full = result;
      }

      // For each related show
      page(streamer.showRelated.rowSelector).each((index, element) => {
        try {
          // Create and add related show
          let result = this.convertCheerioToShow(page(element), page('html'), streamer, 'showRelated');
          if (result) {
            results.partials.push(result);
          }
        }

        catch(err) {
          console.error('Failed to process show page for show: \'' + logData + '\' and streamer: \'' + streamer.id + '\'.');
          console.error('Failed to process related row number ' + index + '.');
          console.error(err);
        }
      });

      // For each episode
      page(streamer.showEpisodes.rowSelector).each((index, element) => {
        try {
          // Create and add episodes
          results.episodes = results.episodes.concat(this.convertCheerioToEpisodes(page(element), page('html'), streamer, 'showEpisodes'));
        }

        catch(err) {
          console.error('Failed to process show page for show: \'' + logData + '\' and streamer: \'' + streamer.id + '\'.');
          console.error('Failed to process episode row number ' + index + '.');
          console.error(err);
        }
      });

      // Fix episode numbers if required
      if (streamer.showEpisodes.cannotCount && !results.episodes.empty()) {
        let episodeCorrection = Math.max(results.episodes.reduce((total, episode) => {
          return Math.min(total, episode.episodeNumStart);
        }, Infinity) - 1, 0);
        results.episodes = results.episodes.map((episode) => {
          episode.episodeNumStart -= episodeCorrection;
          episode.episodeNumEnd -= episodeCorrection;
          return episode;
        });
      }
    }

    catch(err) {
      console.error('Failed to process show page for show: \'' + logData + '\' and streamer: \'' + streamer.id + '\'.');
      console.error(err);
    }

    return results;
  }

  static processRecentPage(html, streamer, logData) {
    let results = [];

    if (!html) {
      return results;
    }

    try {
      // Load page
      let page = Cheerio.load(html);

      // For each row of data
      page(streamer.recent.rowSelector).each((index, element) => {
        try {
          // Create the show and search the db
          let show = this.convertCheerioToShow(page(element), page('html'), streamer, 'recentShow');
          let dbShows = Shows.queryMatchingShows(show);

          // Test if the show is present
          let missing = !dbShows.count();

          if (!missing) {
            // Get episode information
            let episodeNumStart = streamer.recent.attributes.episodeNumStart(page(element), page('html'));
            if (typeof episodeNumStart !== 'undefined' && !isNumeric(episodeNumStart)) {
              episodeNumStart = 1;
            } else {
              episodeNumStart = Number(episodeNumStart);
            }
            let episodeNumEnd = streamer.recent.attributes.episodeNumEnd(page(element), page('html'));
            if (typeof episodeNumEnd !== 'undefined' && !isNumeric(episodeNumEnd)) {
              episodeNumEnd = 1;
            } else {
              episodeNumEnd = Number(episodeNumEnd);
            }
            let translationType = streamer.recent.attributes.translationType(page(element), page('html')).cleanWhitespace();

            // TODO: Correct episode numbers for streamers which can't count

            // Test if the latest episode is present
            missing = dbShows.fetch().some((show) => {
              return !Episodes.queryForStreamer(show._id, translationType, episodeNumStart, episodeNumEnd, streamer.id).count();
            });
          }

          // Create and add final result
          let result = {};
          result.show = show;
          result.missing = missing;
          results.push(result);
        }

        catch(err) {
          console.error('Failed to process recent page for streamer: \'' + streamer.id + '\'.');
          console.error('Failed to process row number ' + index + '.');
          console.error(err);
        }
      });
    }

    catch(err) {
      console.error('Failed to process recent page for streamer: \'' + streamer.id + '\'.');
      console.error(err);
    }

    return results;
  }

  static getSearchResults(url, streamer, logData, resultCallback) {
    startDownloadWithCallback(url, (html) => {
      resultCallback(this.processSearchPage(html, streamer, logData));
    });
  }

  static getShowResults(url, streamer, logData, resultCallback) {
    startDownloadWithCallback(url, (html) => {
      resultCallback(this.processShowPage(html, streamer, logData));
    });
  }

  static getRecentResults(url, streamer, logData, resultCallback) {
    startDownloadWithCallback(url, (html) => {
      resultCallback(this.processRecentPage(html, streamer, logData));
    });
  }

  static doSearch(search, doneCallback, resultCallback, streamersIdsExcluded=[]) {
    // Filter streamers
    let filteredStreamers = streamers.filter((streamer) => {
      return !streamersIdsExcluded.includes(streamer.id);
    });

    // Stop if none remain
    if (filteredStreamers.empty()) {
      doneCallback();
      return;
    }

    // Variables
    let streamersDone = 0;

    // For each not excluded streamer
    filteredStreamers.forEach((streamer) => {
      // Download and process search results
      this.getSearchResults(streamer.search.createUrl(search), streamer, search.query, (results) => {

        // Return results
        results.forEach((result) => {
          resultCallback(result.partial, result.episodes, result.fromShowPage);
        });

        // Check if done
        streamersDone++;
        if (streamersDone === filteredStreamers.length) {
          doneCallback();
        }

      });
    });
  }

  static createFullShow(oldShow, doneCallback, partialCallback, fullCallback, episodeCallback) {
    let tempShow = new TempShow(oldShow, doneCallback, partialCallback, fullCallback, episodeCallback, false);
    tempShow.start();
  }

  static findRecentEpisodes(partialCallback, episodeCallback) {
    // For each streamer
    streamers.forEach((streamer) => {
      // Download and process recent page
      this.getRecentResults(streamer.recentPage, streamer, undefined, (results) => {
        // For each result
        results.forEach((result) => {

          // Add as partial
          partialCallback(result.show);

          // Process show in simple mode when episodes are missing
          if (result.missing) {
            let tempShow = new TempShow(result.show, partialCallback, partialCallback, (partial) => {

              result.show = partial;
              partialCallback(partial);
              delete partial._id;

            }, (episode) => {

              Shows.queryMatchingShows(result.show).forEach((show) => {
                episode.showId = show._id;
                episodeCallback(episode);
                delete episode._id;
              });

            }, true);
            tempShow.start();
          }

        });
      });
    });
  }
}

class TempShow {
  constructor(oldShow, doneCallback, partialCallback, fullCallback, episodeCallback, simpleMode) {
    this.doneCallback = doneCallback;
    this.partialCallback = partialCallback;
    this.fullCallback = fullCallback;
    this.episodeCallback = episodeCallback;

    this.simpleMode = simpleMode;

    this.oldShow = oldShow;
    this.mergedShow = oldShow;
    this.newShow = {};

    this.streamerUrlsStarted = [];
    this.streamerUrlsDone = [];

    this.currentAltNameIndex = 0;
    this.searchWithCurrentAltLooping = false;

    this.tempResultStorage = new Mongo.Collection(null);
  }

  isStreamerDone(streamer) {
    return streamer.minimalPageTypes.every((minimalPageType) => {
      return this.streamerUrlsStarted.hasPartialObjects({
        streamerId: streamer.id,
        type: minimalPageType
      });
    });
  }

  areDownloadsDone() {
    return this.streamerUrlsStarted.every((streamerUrl) => {
      return this.streamerUrlsDone.hasPartialObjects({
        streamerId: streamerUrl.streamerId,
        type: streamerUrl.type
      });
    });
  }

  areStreamersOrAltsDone() {
    return this.simpleMode || this.currentAltNameIndex >= this.mergedShow.altNames.length || streamers.every((streamer) => {
      return this.isStreamerDone(streamer);
    });
  }

  getStreamerIdsDone() {
    return streamers.filter((streamer) => {
      return this.isStreamerDone(streamer);
    }).map((streamer) => {
      return streamer.id;
    });
  }

  doesShowMatchMerged(tempShow) {
    let tempId = this.tempResultStorage.insert(tempShow);
    let result = ScrapingHelpers.queryMatchingShows(this.tempResultStorage, this.mergedShow, tempId).count();
    this.tempResultStorage.remove(tempId);
    return result;
  }

  mergeShows(intoShow, withShow, streamer) {
    Object.keys(withShow).forEach((key) => {
      if ((typeof intoShow[key] === 'undefined' && !['_id', 'lastUpdateStart', 'lastUpdateEnd'].includes(key))
        || (Shows.objectKeys.includes(key) && Object.countNonEmptyValues(withShow[key]) > Object.countNonEmptyValues(intoShow[key]))) {
        intoShow[key] = withShow[key];
      }
      else if (Shows.arrayKeys.includes(key)) {
        intoShow[key] = intoShow[key].concat(withShow[key]);
      }
      else if (streamer.id === 'myanimelist' && !Shows.objectKeys.includes(key) && !Shows.arrayKeys.includes(key)) {
        intoShow[key] = withShow[key];
      }
    });
  }

  start() {
    if (Meteor.isDevelopment) {
      console.log('Started creating full show with name: \'' + this.oldShow.name + '\'');
    }

    // Start processing all existing streamer urls
    this.processUnprocessedStreamerUrls(this.oldShow.streamerUrls);

    // Start the alt search loop
    if (!this.simpleMode && !this.areStreamersOrAltsDone() && !this.searchWithCurrentAltLooping) {
      this.searchWithCurrentAlt();
    }
  }

  processUnprocessedStreamerUrls(streamerUrls) {
    streamerUrls.filter((streamerUrl) => {
      return !this.streamerUrlsStarted.hasPartialObjects({
        streamerId: streamerUrl.streamerId,
        type: streamerUrl.type
      });
    }).forEach((streamerUrl) => {
      this.processStreamerUrl(streamerUrl)
    });
  }

  processStreamerUrl(streamerUrl) {
    // Mark as started
    this.markAsStarted(streamerUrl);

    // Download and process show page
    Streamers.getShowResults(streamerUrl.url, Streamers.getStreamerById(streamerUrl.streamerId), this.oldShow.name, (result) => {
      this.processShowResult(result, streamerUrl);

      // Start the loop again if possible
      if (!this.simpleMode && !this.areStreamersOrAltsDone() && !this.searchWithCurrentAltLooping) {
        this.searchWithCurrentAlt();
      }

      // When completely done
      if (this.areDownloadsDone() && this.areStreamersOrAltsDone()) {
        this.finish();
      }
    });
  }

  searchWithCurrentAlt() {
    this.searchWithCurrentAltLooping = true;

    // Create a full search object
    let search = {
      query: this.mergedShow.altNames[this.currentAltNameIndex]
    };
    Schemas.Search.clean(search, {
      mutate: true
    });
    Schemas.Search.validate(search);
    let result = Searches.getOrInsertSearch(search);

    // Search all the pending streamers with the current altName
    Streamers.doSearch(result, () => {

      // Increment alt index
      this.currentAltNameIndex++;

      // When all alts or streamers are done
      if (this.areStreamersOrAltsDone()) {
        this.searchWithCurrentAltLooping = false;
        // When we have nothing to do anymore
        if (this.areDownloadsDone()) {
          this.finish();
        }
      }

      // When some streamers are not done
      else {
        this.searchWithCurrentAlt();
      }

    }, (partial, episodes, fromShowPage) => {

      // If the partial matches this show
      if (this.doesShowMatchMerged(partial)) {

        if (fromShowPage) {
          // Mark as started and process
          this.markAsStarted(partial.streamerUrls[0]);
          this.processShowResult({
            full: partial,
            partials: [],
            episodes: episodes
          }, partial.streamerUrls[0]);
        }

        else {
          // Process it's unprocessed streamer urls
          this.processUnprocessedStreamerUrls(partial.streamerUrls);
        }

      }

      // Otherwise store as partial
      else {
        this.partialCallback(partial, episodes);
      }

    }, this.getStreamerIdsDone());
  }

  markAsStarted(streamerUrl) {
    // Mark streamerUrl as started
    this.streamerUrlsStarted.push(streamerUrl);
  }

  processShowResult(result, streamerUrl) {
    // Get the streamer
    let streamer = Streamers.getStreamerById(streamerUrl.streamerId);

    if (result.full) {
      // Merge result into the working show
      this.mergeShows(this.mergedShow, result.full, streamer);

      // Clean working show
      Schemas.Show.clean(this.mergedShow, {
        mutate: true
      });

      // Merge result into the new show
      this.mergeShows(this.newShow, result.full, streamer);
    }

    // Store partial results from show page
    result.partials.forEach((partial) => {
      if (!this.doesShowMatchMerged(partial)) {
        this.partialCallback(partial);
      }
    });

    // Handle episodes
    result.episodes.forEach((episode) => {
      episode.showId = this.oldShow._id;
      this.episodeCallback(episode);
    });

    // Process any new unprocessed streamer urls
    if (result.full) {
      this.processUnprocessedStreamerUrls(result.full.streamerUrls);
    }

    // Store as partial show
    if (Schemas.Show.newContext().validate(this.newShow)) {
      this.fullCallback(this.newShow);
    }

    // Mark streamerUrl as done
    this.streamerUrlsDone.push(streamerUrl);
  }

  finish() {
    if (!this.newShow.streamerUrls) {
      this.newShow.streamerUrls = [];
    }

    this.newShow.streamerUrls = this.newShow.streamerUrls.concat(this.streamerUrlsStarted.filter((streamerUrlStarted) => {
      return !this.newShow.streamerUrls.hasPartialObjects({
        streamerId: streamerUrlStarted.streamerId,
        type: streamerUrlStarted.type
      });
    }).map((streamerUrlStarted) => {
      streamerUrlStarted.lastDownloadFailed = true;
      return streamerUrlStarted;
    }));

    Thumbnails.removeWithHashes(this.oldShow.thumbnails.filter((thumbnail) => {
      return !this.newShow.thumbnails.includes(thumbnail);
    }));

    this.doneCallback(this.newShow);

    if (Meteor.isDevelopment) {
      console.log('Done creating full show with name: \'' + this.oldShow.name + '\'');
    }
  }
}
