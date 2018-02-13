import {Shows} from '../api/shows/shows';
import ScrapingHelpers from './scrapingHelpers';

function cleanName(name) {
  return name.replace(/ \(Dub\)$/, '').replace(/ \(Sub\)$/, '');
}

function getTypeFromName(name) {
  return name.endsWith(' (Dub)') ? 'dub' : 'sub';
}

function determineAiringDateShowPage(partial, index) {
  let stringTime = undefined;
  let episodes = partial.find('div.widget.servers div.widget-body div.server.active ul li a');
  if (index) {
    stringTime = episodes.last().attr('data-title').split(' - ')[1];
  } else {
    stringTime = episodes.first().attr('data-title').split(' - ')[1];
  }

  return ScrapingHelpers.buildAiringDateFromStandardStrings(
    'EST',
    index,
    partial.find('div.info div.row dl:first-of-type dt:contains("Date aired:")').next().text().replace('Date aired:', ''),
    partial.find('div.info div.row dl:last-of-type dt:contains("Premiered:")').next().find('a').text(),
    undefined,
    stringTime
  );
}

const validTypes = ['TV', 'OVA', 'Movie', 'Special', 'ONA'];
const validGenres = ['Action', 'Adventure', 'Cars', 'Comedy', 'Dementia', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game',
  'Harem', 'Hentai', 'Historical', 'Horror', 'Josei', 'Kids', 'Magic', 'Martial Arts', 'Mecha', 'Military', 'Music', 'Mystery',
  'Parody', 'Police', 'Psychological', 'Romance', 'Samurai', 'School', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shoujo Ai',
  'Shounen', 'Shounen Ai', 'Slice of Life', 'Space', 'Sports', 'Super Power', 'Supernatural', 'Thriller', 'Vampire',
  'Yaoi', 'Yuri'];

export let nineanime = {
  // General data
  id: 'nineanime',
  name: '9anime',
  homepage: 'https://9anime.is',
  minimalPageTypes: ['sub', 'dub'],

  // Search page data
  search: {
    createUrl: function(search) {
      let query = '';
      if (search.query) {
        query = '&keyword=' + encodeURIComponentReplaceSpaces(search.query, '+');
      }

      let types = search.getTypesAsIncludes(validTypes);
      if (types) {
        types = types.map((type) => {
          return '&type[]=' + type.toLowerCase().replace('tv', 'series');
        }).join('');
      } else {
        types = '';
      }

      let genres = search.getGenresAsIncludes(validGenres);
      if (genres) {
        genres = genres.map((genre) => {
          return '&genre[]=' + (validGenres.indexOf(genre) + 1);
        }).join('');
      } else {
        genres = '';
      }

      return nineanime.homepage + '/filter?sort=title%3Aasc' + query + types + genres;
    },
    rowSelector: 'div.film-list div.item',

    // Search page attribute data
    attributes: {
      streamerUrls: function(partial, full) {
        return [{
          type: getTypeFromName(partial.find('a.name').text()),
          url: partial.find('a.name').attr('href')
        }];
      },
      name: function(partial, full) {
        return cleanName(partial.find('a.name').text());
      },
      type: function(partial, full) {
        let found = undefined;
        partial.find('a.poster div.status div').each((index, element) => {
          if (!found && Shows.validTypes.includes(partial.find(element).text())) {
            found = partial.find(element).text();
          }
        });
        return found;
      },
    },

    // Search page thumbnail data
    thumbnails: {
      rowSelector: 'img',
      getUrl: function (partial, full) {
        return partial.attr('src');
      },
    },
  },

  // Show page data
  show: {
    checkIfPage: function (page) {
      return page('title').text().cleanWhitespace().match(/^Watch .* on 9anime.to$/);
    },

    // Show page attribute data
    attributes: {
      streamerUrls: function(partial, full) {
        return [{
          type: getTypeFromName(partial.find('div.widget.player div.widget-title h1.title').text()),
          url: partial.find('head link').attr('href')
        }];
      },
      name: function(partial, full) {
        return cleanName(partial.find('div.widget.player div.widget-title h1.title').text());
      },
      altNames: function(partial, full) {
        return partial.find('div.info div.head div.c1 p.alias').text().split('; ');
      },
      description: function(partial, full) {
        return partial.find('div.info div.desc').text()
      },
      type: function(partial, full) {
        return partial.find('div.info div.row dl:first-of-type dt:contains("Type:")').next().text().split(' ')[0];
      },
      genres: function(partial, full) {
        return partial.find('div.info div.row dl:first-of-type dt:contains("Genre:")').next().find('a').map((index, element) => {
          return partial.find(element).text();
        }).get().filter((genre) => {
          return genre !== 'add some';
        });
      },
      airedStart: function(partial, full) {
        return determineAiringDateShowPage(partial, 0);
      },
      airedEnd: function(partial, full) {
        return determineAiringDateShowPage(partial, 1);
      },
      season: function(partial, full) {
        let bits = partial.find('div.info div.row dl:last-of-type dt:contains("Premiered:")').next().find('a').text().split(' ');
        if (bits.length === 2) {
          return {
            quarter: bits[0],
            year: bits[1]
          };
        }
        return undefined;
      },
    },

    // Show page thumbnail data
    thumbnails: {
      rowSelector: 'div.info div.row div.thumb img',
      getUrl: function (partial, full) {
        return partial.attr('src');
      },
    },
  },

  // Related shows data
  showRelated: {
    rowSelector: 'div.widget.simple-film-list div.widget-body div.item, div.list-film div.item',

    // Related shows attribute data
    attributes: {
      streamerUrls: function(partial, full) {
        return [{
          type: getTypeFromName(partial.find('a.name').text()),
          url: partial.find('a.name').attr('href')
        }];
      },
      name: function(partial, full) {
        return cleanName(partial.find('a.name').text());
      },
      type: function(partial, full) {
        let found = undefined;
        partial.find('a.poster div.status div').each((index, element) => {
          if (!found && Shows.validTypes.includes(partial.find(element).text())) {
            found = partial.find(element).text();
          }
        });
        return found;
      },
    },

    // Related shows thumbnail data
    thumbnails: {
      rowSelector: 'img',
      getUrl: function (partial, full) {
        return partial.attr('src');
      },
    },
  },

  // Episode list data
  showEpisodes: {
    rowSelector: 'div.widget.servers div.widget-body div.server.active ul li a',
    cannotCount: false,

    // Episode list attribute data
    attributes: {
      episodeNumStart: function(partial, full) {
        return partial.text().includes('-') ? partial.text().split('-')[0] : partial.text();
      },
      episodeNumEnd: function(partial, full) {
        return partial.text().includes('-') ? partial.text().split('-')[1] : partial.text();
      },
      translationType: function(partial, full) {
        return getTypeFromName(full.find('div.widget.player div.widget-title h1.title').text());
      },
      sources: function(partial, full) {
        let episodeString = partial.text();
        let found = [];

        let tabs = [];
        full.find('div.widget.servers div.widget-title span.tabs span.tab').each((index, element) => {
          let tab = full.find(element);
          tabs.push({
            data: tab.attr('data-name'),
            name: tab.text()
          });
        });

        full.find('div.widget.servers div.widget-body div.server').each((index, element) => {
          let server = full.find(element);
          let name = tabs.getPartialObjects({data: server.attr('data-name')})[0].name;

          server.find('ul li a').each((index, element) => {
            if (full.find(element).text() === episodeString) {
              let dateBits = full.find(element).attr('data-title').split(' - ');
              found.push({
                sourceName: name,
                sourceUrl: nineanime.homepage + full.find(element).attr('href'),
                uploadDate: ScrapingHelpers.buildAiringDateFromStandardStrings(
                  'EST',
                  undefined,
                  dateBits[0],
                  undefined,
                  undefined,
                  dateBits[1]
                )
              });
            }
          });
        });

        return found;
      },
    },
  },
};
