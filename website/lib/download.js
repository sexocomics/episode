import {CloudKicker} from "cloudkicker/lib/index";

const cloudkicker = new CloudKicker();

downloadWithCallback = function(url, callback, tries=1) {
  // TODO: Fix database stuff so the client can download too
  // if (Meteor.isServer || Session.get('AddOnInstalled')) {
  if (Meteor.isServer) {
    url = encodeURI(url).replace(/%25/g, '%');

    if (Meteor.isDevelopment) {
      console.log('Downloading: url \'' + url + '\', try \'' + tries + '\'');
    }

    if (Meteor.isClient && url.startsWith('http://')) {
      // TODO: Fix http downloads on the client
      callback(false);
      return;
    }

    cloudkicker.get(url).then(({options, response}) => {
      if (Meteor.isDevelopment) {
        console.log('Downloaded: url \'' + response.request.href + '\', status \'' + response.statusCode + ' ' + response.statusMessage + '\'');
      }
      callback(response.body.toString(), response);
    },

    (err) => {
      maybeNextDownload(url, callback, tries, err);
    }).

    catch((err) => {
      if (err === 'Download Failed!') {
        maybeNextDownload(url, callback, tries, err);
      } else {
        console.error(err);
      }
    });
  }
};

function maybeNextDownload(url, callback, tries, err) {
  if (tries >= 3) {
    console.error('Failed downloading ' + url + ' after ' + tries + ' tries.');
    console.error(err);
    callback(false);
  } else {
    downloadWithCallback(url, callback, tries + 1);
  }
}
