// global variables
var torrents = [];  // array of displayed torrents
var refresh;    // variable that holds refreshPopup() timeout
var port = chrome.runtime.connect({name: 'popup'});

const TAG_BASELINE    = 1;
const TAG_UPDATE    = 2;
const TAG_TURTLE_MODE  = 3;

// search for an id in the torrents array
// returns: index or -1
Array.prototype.getTorrentById = function (id) {
  for (var i = this.length - 1; i >= 0; i--) {
    if (this[i].id === id) {return i;}
  }
  return -1;
};

// credit to: http://web.elctech.com/2009/01/06/convert-filesize-bytes-to-readable-string-in-javascript/
// modified to allow for 0 bytes and removed extraneous Math.floor
function formatBytes(bytes) {

  var s = [
    'bytes',
    'KB',
    'MB',
    'GB',
    'TB',
    'PB',
  ];
  var e;

  if (bytes < 1) {return '0 bytes';}

  e = Math.floor(Math.log(bytes) / Math.log(1024));

  if (e > 2) {return (bytes / Math.pow(1024, e)).toFixed(2) + ' ' + s[e];}

  return (bytes / Math.pow(1024, e)).toFixed(1) + ' ' + s[e];
}

// display seconds in a human readable format
function formatSeconds(seconds) {

  var tmp;
  var time;
  var units = [
    {seconds: 86400, label: 'days'},
    {seconds: 3600, label: 'hr'},
    {seconds: 60, label: 'min'},
    {seconds: 1, label: 'seconds'},
  ];

  if (seconds < 1) {return 'unknown time';}

  // loop through units and display a max of two consecutive units
  for (let i = 0, unit; unit = units[i]; ++i) {
    if (seconds > unit.seconds) {
      tmp = Math.floor(seconds / unit.seconds);
      time = tmp + ' ' + unit.label;
      seconds -= unit.seconds * tmp;

      if (i < (units.length - 1)) {
        tmp = Math.floor(seconds / units[i + 1].seconds);

        if (tmp > 0) {time += ' ' + tmp + ' ' + units[i + 1].label;}
      }

      return time;
    }
  }
}

// update the global stats
function updateStats(uTorrents) {
  var stats      = [
    0,
    0,
    0,
  ];
  var totalDownload = 0;
  var totalUpload   = 0;
  var list          = jQuery('#list')[0];
  var status        = jQuery('#status')[0];

  // count how many of each status
  for (let i = 0, torrent; torrent = torrents[i]; ++i) {
    switch (torrent.status) {
      case 1:case 2:case 4:
        stats[0]++;
        break;
      case 8:
        stats[1]++;
        break;
      case 16:
        stats[2]++;
        break;
      default:
        break;
    }
  }

  // get the global speeds
  for (let i = 0, uTorrent; uTorrent = uTorrents[i]; ++i) {
    totalDownload += uTorrent.rateDownload;
    totalUpload += uTorrent.rateUpload;
  }

  // update the global status
  jQuery('#global_torrents').html(torrents.length);
  jQuery('#global_downloading').html(stats[0]);
  jQuery('#global_seeding').html(stats[1]);
  jQuery('#global_pausedcompleted').html(stats[2]);
  jQuery('#global_downloadrate').html(formatBytes(totalDownload));
  jQuery('#global_uploadrate').html(formatBytes(totalUpload));
}

// set the visibility of the no torrents status message
function setStatusVisibility() {
  if (list.hasChildNodes()) {
    jQuery(status).hide();
    jQuery(list).show();
  } else {
    jQuery(status).show();
    jQuery(list).hide();
  }
}

port.onMessage.addListener(function (msg) {
  switch (msg.tag) {
    case TAG_BASELINE:
      // remove all previous torrents
      for (var i = 0; torrent = torrents[i]; ++i) {
        torrents.splice(torrent, 1)[0].removeElem();
      }

      var uTorrents = msg.args.torrents.sort(function (a, b) { return b.addedDate - a.addedDate; });

      // add the torrent to the torrents array and set whether it's visible or not
      for (var i = 0, uTorrent; uTorrent = uTorrents[i]; ++i) {
        torrents[torrents.push(new Torrent()) - 1].createElem(uTorrent);
        torrents[i].filter();
      }

      setStatusVisibility();
      updateStats(uTorrents);
      break;
    case TAG_UPDATE:
      var rTorrents = msg.args.removed;
      var uTorrents = msg.args.torrents;
      var torrent;

      // remove torrents
      for (let i = 0, rTorrent; rTorrent = rTorrents[i]; ++i) {
        let torrent = torrents.getTorrentById(rTorrent);
        if (torrent > -1) {
          torrents.splice(torrent, 1)[0].removeElem();
        }
      }

      // add/update torrents
      for (let i = 0; i < uTorrents.length; i++) {
        let uTorrent = uTorrents[i];
        let torrent = torrents.getTorrentById(uTorrent.id);
        if (torrent < 0) {    // new
          torrents.unshift(new Torrent());
          torrents[0].createElem(uTorrent);
          torrents[0].filter(0);
        } else {        // existing
          torrents[torrent].updateElem(uTorrent);
        }
      }

      setStatusVisibility();
      updateStats(uTorrents);
      break;
    case TAG_TURTLE_MODE:
      jQuery('#turtle_button').toggleClass('on', Boolean(msg.args['alt-speed-enabled']));
      break;
    default:
      break;
  }
});

// keep refreshing the torrent list
function refreshPopup() {
  port.postMessage({
    args   : '"fields": [ "id", "status", "name", "downloadDir", "metadataPercentComplete", "sizeWhenDone", "leftUntilDone", "eta", "rateDownload", "rateUpload", "uploadedEver", "addedDate", "doneDate", "recheckProgress" ], "ids": "recently-active"',
    method : 'torrent-get',
    tag    : TAG_UPDATE,
  });

  port.postMessage({args: '', method: 'session-get', tag: TAG_TURTLE_MODE});

  refresh = setTimeout(refreshPopup, parseInt(localStorage.popuprefreshinterval, 10));
}

jQuery(function ($) {
  // persistent torrent type dropdown and filter textbox
  var filterValue = localStorage.torrentFilter || '';

  $('#filter_input').val(filterValue);
  $('#filter_clear').toggle(Boolean(filterValue));

  $('#filter_type').val(localStorage.torrentType || -1);

  // initial baseline of torrents, turtle mode, then start the refresh
  // setTimeout is here to workaround an issue on macOS where the popup
  // sometimes might end up with wrong size. For details see:
  // https://bugs.chromium.org/p/chromium/issues/detail?id=428044
  setTimeout(function () {
    port.postMessage({
      args   : '"fields": [ "id", "status", "name", "downloadDir", "metadataPercentComplete", "sizeWhenDone", "leftUntilDone", "eta", "rateDownload", "rateUpload", "uploadedEver", "addedDate", "doneDate", "recheckProgress" ]',
      method : 'torrent-get',
      tag    : TAG_BASELINE,
    });
    refreshPopup();
  }, 200);

  port.postMessage({args: '', method: 'session-get', tag: TAG_TURTLE_MODE});
});
