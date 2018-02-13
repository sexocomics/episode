import './show.html';
import {Shows} from '/imports/api/shows/shows.js';
import '/imports/ui/components/loadingIndicatorBackground.js';
import {Episodes} from "../../api/episodes/episodes";
import Streamers from "../../streamers/streamers";
import '/imports/ui/components/carousel.js';

Template.pages_show.onCreated(function() {
  // Set page variables
  Session.set('BreadCrumbs', JSON.stringify([{
    name: 'Anime',
    url: FlowRouter.path('search')
  }]));

  // Subscribe based on the show id
  this.autorun(() => {
    this.subscribe('shows.withId', FlowRouter.getParam('showId'));
    this.subscribe('episodes.forShow', FlowRouter.getParam('showId'));
  });

  // Check if the show exists
  this.autorun(() => {
    if (this.subscriptionsReady() && !Shows.findOne(FlowRouter.getParam('showId'))) {
      FlowRouter.go('notFound');
    }
  });

  // When a show is found
  this.autorun(() => {
    let show = Shows.findOne(FlowRouter.getParam('showId'));
    if (show) {
      Meteor.call('shows.attemptUpdate', FlowRouter.getParam('showId'));
      Session.set('PageTitle', show.name);
      this.subscribe('thumbnails.withHashes', show.thumbnails);
    }
  });
});

Template.pages_show.helpers({
  show() {
    return Shows.findOne(FlowRouter.getParam('showId'));
  },

  updating() {
    let show = Shows.findOne(FlowRouter.getParam('showId'));
    return show && show.locked();
  },

  episodesJoined(translationType) {
    let episodes = [];

    Episodes.queryForTranslationType(FlowRouter.getParam('showId'), translationType).forEach((episode) => {
      let selector = {
        showId: episode.showId,
        translationType: episode.translationType,
        episodeNumStart: episode.episodeNumStart,
        episodeNumEnd: episode.episodeNumEnd
      };

      if (episodes.hasPartialObjects(selector)) {
        let other = episodes.getPartialObjects(selector)[0];
        other.streamers.push(Streamers.getSimpleStreamerById(episode.streamerId));
        episodes = episodes.removePartialObjects(selector);
        episodes.push(other);
      }

      else {
        episode.streamers = [Streamers.getSimpleStreamerById(episode.streamerId)];
        episodes.push(episode);
      }
    });

    return episodes;
  }
});
