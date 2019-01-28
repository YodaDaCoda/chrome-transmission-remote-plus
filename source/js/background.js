/* global getFile parseTorrent encodeFile */

// global variables
var completedTorrents = ''; // string of completed torrents to prevent duplicate notifications
var notificationTimer;
var torrentInfo = {}; // timer for displaying notifications

/**
 * Display a text badge on the browser icon
 * @param {String} text - text to display
 * @param {String} color - color of badge
 * @param {Number} duration - how long to show badge for
 */
function showBadge(text, color, duration) {

  duration = (typeof duration == 'undefined') ? localStorage.browserbadgetimeout : duration;

  chrome.browserAction.setBadgeBackgroundColor({color: color});
  chrome.browserAction.setBadgeText({text: text});

  setTimeout(function () { chrome.browserAction.setBadgeText({text: ''}); }, duration);
}

/**
 * Show a broiwser notification
 * @param {String} title - title of notification
 * @param {String} message - text to display
 */
function showNotification(title, message) {

  var options = {
    type    : 'basic',
    title   : title,
    message : message,
    iconUrl : 'images/icon128.png',
  };

  if (localStorage.notificationsnewtorrent === 'true') {
    chrome.notifications.create(options);
  }
}

/**
 * Send a request to a remote Transmission client
 * @param {Object} args - data to pass to the Transmission client
 * @param {String} method - tells the Transmission client how to handle the data
 * @param {String} tag: makes it easy to know what to do with the response
 * @param {String} callback: function to reference with the response
 */
function rpcTransmission(args, method, tag, callback) {
  jQuery.ajax({
    url      : localStorage.server + localStorage.rpcPath,
    type     : 'POST',
    username : localStorage.user,
    password : localStorage.pass,
    headers  : {'X-Transmission-Session-Id': localStorage.sessionId},
    data     : '{ "arguments": {' + args + '}, "method": "' + method + '"' + (tag ? ', "tag": ' + tag : '') + '}',
  })
  .done(function (data, textStatus, jqXHR) {
    if (callback) {
      callback(jqXHR.responseJSON);
    }
  })
  .fail(function (jqXHR, textStatus, errorThrown) {
    if (errorThrown === 'Conflict') {
      // X-Transmission-Session-Id should only be included if we didn't include it when we sent our request
      let xSid = jqXHR.getResponseHeader('X-Transmission-Session-Id');
      localStorage.sessionId = xSid;
      rpcTransmission(args, method, tag, callback);
      return;
    }
    // console.log('ajax error: ' + errorThrown);
    // TODO: This should be improved such that it doesn't have to return a parsed object
    callback(JSON.parse(
      '{"arguments":{"torrents":[{"addedDate":0,"doneDate":0,"downloadDir":"","eta":0,"id":0,"leftUntilDone":0,"metadataPercentComplete":0,"name":"Unable to connect to ' + localStorage.server + '.","rateDownload":0,"rateUpload":0,"recheckProgress":0,"sizeWhenDone":0,"status":0,"uploadedEver":0}]},"result":"Unable to connect to server.","tag":1}'
    ));


  });
}

/**
 * Download the torrent
 * @param {Object} request - Object containg data needed to download torrent
 */
function dlTorrent(request) {
  if (request.add_to_custom_locations) {
    let dir = request.dir;
    let label = request.new_label;
    if (label === '') {
      let i = dir.lastIndexOf('/');
      if (i === -1) {
        label = dir;
      } else {
        // use basename as label
        label = dir.substring(i + 1);
      }
    }

    let dirs = (localStorage.dirs) ? JSON.parse(localStorage.dirs) : [];
    dirs.push({label: label, dir: dir});
    localStorage.dirs = JSON.stringify(dirs);
  }

  // how are we going to send this torrent to transmission?
  let args = (typeof request.data !== 'undefined') ? '"metainfo": "' + request.data + '"' : '"filename": "' + request.url + '"';
  // where are we going to download it to? empty dir means default
  if (typeof request.dir !== 'undefined' && request.dir !== '') {
    args += ', "download-dir": "' + request.dir + '"';
  }

  if (request.paused) {
    args += ', "paused": true';
  }
  if (request.high && request.high.length) {
    args += ', "priority-high": [' + request.high.join(',') + ']';
  }

  if (request.normal && request.normal.length) {
    args += ', "priority-normal": [' + request.normal.join(',') + ']';
  }

  if (request.low && request.low.length) {
    args += ', "priority-low": [' + request.low.join(',') + ']';
  }

  if (request.blacklist && request.blacklist.length) {
    args += ', "files-unwanted": [' + request.blacklist.join(',') + ']';
  }

  // send the torrent to transmission
  rpcTransmission(args, 'torrent-add', '', function (response) {
    // show a badge on the browser icon depending on the response from Transmission
    // show a badge on the browser icon depending on the response from Transmission
    if (response.arguments['torrent-duplicate']) {
      showBadge('dup', [
        0,
        0,
        255,
        255,
      ]);
      showNotification('Duplicate torrent', '');
    } else if (response.arguments['torrent-added']) {
      showBadge('add', [
        0,
        255,
        0,
        255,
      ]);
      showNotification('Torrent added successfully', response.arguments['torrent-added'].name);
    } else {
      showBadge('fail', [
        255,
        0,
        0,
        255,
      ]);
      showNotification('Adding torrent failed', '');
    }
  });
}

/**
 * attempt to download url as a torrent file
 * @param {String} url - URL to download
 */
function getTorrent(url) {
  var dirs = (localStorage.dirs) ? JSON.parse(localStorage.dirs) : [];
  // show download popup?
  if (localStorage.dlPopup === 'false') {
    dlTorrent({url: url, paused: (localStorage.start_paused === 'true')});
  } else if (url.toLowerCase().indexOf('magnet:') === 0) { // it's a magnet
  // don't use base64 on magnet links
    torrentInfo['magnet'] = {dirs: dirs, url: url};
    chrome.windows.create({
      url    : 'downloadMagnet.html',
      type   : 'popup',
      width  : 852,
      height : 190,
      left   : screen.width / 2 - 852 / 2,
      top    : screen.height / 2 - 160 / 2,
    });
  } else { // it's a .torrent
    getFile(url, function (file) {
      parseTorrent(file, function (torrent) {
        if (torrent !== null) {
          encodeFile(file, function (data) {
            torrentInfo['torrent'] = {torrent: torrent, data: data, dirs: dirs};
            chrome.windows.create({
              url    : 'downloadTorrent.html',
              type   : 'popup',
              width  : 850,
              height : 610,
              left   : (screen.width / 2) - 425,
              top    : (screen.height / 2) - 300,
            });
          });
        } else {
          // This isn't a torrent file?
        }
      });
    });
  }
}

/**
 * Request a minimal list of torrents with recent activity (30s timer)
 */
function notificationRefresh() {
  rpcTransmission('"fields": [ "id", "name", "status", "leftUntilDone" ], "ids": "recently-active"', 'torrent-get', 10, function (response) {
    for (let i = 0; i < response.arguments.torrents.length; i++) {
      let torrent = response.arguments.torrents[i];
      if ((torrent.status === TR_STATUS_SEED_WAIT || torrent.status === TR_STATUS_SEED || torrent.status === TR_STATUS_STOPPED) &&
          torrent.leftUntilDone === 0 && completedTorrents.indexOf(torrent.id) < 0) {
        showNotification('Torrent Download Complete', torrent.name + ' has finished downloading.');
        // mark the completed torrent so another notification isn't displayed for it
        completedTorrents += torrent.id + ',';
      }
    }
  });

  notificationTimer = setTimeout(notificationRefresh, 30000);
}

/*
 * receive messages from other parts of the script
 */
chrome.runtime.onConnect.addListener(function (port) {
  switch (port.name) {
    case 'popup':
      port.onMessage.addListener(function (msg) {
        switch (msg.method) {
          case 'torrent-get':
          case 'session-get':
            rpcTransmission(msg.args, msg.method, msg.tag, function (response) {
              port.postMessage({args: response.arguments, tag: response.tag});
            });
            break;
          default:
            rpcTransmission(msg.args, msg.method);
        }
      });
      break;
    case 'inject':
      port.onMessage.addListener(function (msg) {
        switch (msg.method) {
          case 'torrent-add':
            getTorrent(msg.url);
            break;
          default:
            break;
        }
      });
      break;
    case 'options':
      port.onMessage.addListener(function (msg) {
        switch (msg.method) {
          case 'settings-saved':
            // stop the notification timer
            clearTimeout(notificationTimer);

            // start it up again if it's enabled
            if (localStorage.notificationstorrentfinished === 'true') {
              notificationRefresh();
            }
            break;
          default:
            break;
        }
      });
      break;
    case 'downloadMagnet':
    case 'downloadTorrent':
      port.onMessage.addListener(function (msg) {
        switch (msg.method) {
          case 'session-get':
            rpcTransmission(msg.args, msg.method, msg.tag, function (response) {
              port.postMessage({args: response.arguments, tag: response.tag});
            });
            break;
          default:
            break;
        }
      });
      break;
    default:
      break;
  }
});

/**
 * recieve message to send torrent to transmission
 */
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.method === 'get-torrent-info') {
    sendResponse(torrentInfo[request.page]);
  } else {
    dlTorrent(request);
    sendResponse({}); // close connection cleanly
  }
});

/* start context menu */
/**
 * attempt to download the url from a context menu as a torrent
 * @param {Object} info Chrome info object
 */
function contextMenuClick(info) {
  getTorrent(info.linkUrl);
}

/**
 * Add link context menu option
 */
chrome.contextMenus.create({
  title    : 'Download with Remote Transmission',
  contexts : ['link'],
  onclick  : contextMenuClick,
  // TODO: watch this http://code.google.com/p/chromium/issues/detail?id=84024
  // , 'targetUrlPatterns': TORRENT_LINKS
});

/* end context menu */

(function () {
  // show notifications if they're enabled
  if (localStorage.notificationstorrentfinished === 'true') {
    notificationRefresh();
  }

  // make sure users are up-to-date with their config
  //                first install                                           upgraded extension major version
  if (typeof (localStorage.version) == 'undefined' || chrome.runtime.getManifest().version.split('.')[0] !== localStorage.version.split('.')[0]) {
    chrome.tabs.create({url: 'options.html?newver=true'});
  }

  // This function runs when the extension is first loaded.
  // If that's after tabs are already open, then we need to inject our script into them, or they won't pick up torrent/magnet link clicks.
  chrome.windows.getAll({populate: true}, function (windows) {
    for (let i = 0; i < windows.length; i++) {
      for (let j = 0; j < windows[i].tabs.length; j++) {
        if (windows[i].tabs[j].url.substr(0, 4) === 'http') {
          // Chrome will throw an error here if the user has the chrome://extensions window open,
          // despite the fact that we don't inject the script to that tab.
          chrome.tabs.executeScript(windows[i].tabs[j].id, {file: 'js/inject.js'});
        }
      }
    }
  });

}());
