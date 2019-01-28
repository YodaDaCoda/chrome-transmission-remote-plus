/* global decodeBytes */

var selectNewDirectoryIndex = 1;
const TAG_DOWNLOAD_DIR = 1;
var port = chrome.runtime.connect({name: 'downloadMagnet'});

function decodeString(s) {
  var r;
  try {
    r = decodeURIComponent(escape(s));
  } catch (e) {
    r = decodeBytes(s, 'cp1251');
  }
  return r;
}

// populate the download popup with the torrent information
chrome.runtime.sendMessage({method: 'get-torrent-info', page: 'magnet'}, function (request) {
  var select = jQuery('#downloadLocations');
  var newLabel = jQuery('#newLabel');
  var newDirectory = jQuery('#newDirectory');
  var addToCustomLocations = jQuery('#addToCustomLocations');

  // add the list of download directories
  console.log(request.dirs.length);
  if (request.dirs.length === 0) {
    select.disabled = 'disabled';
  } else {
    for (let i = 0; i < request.dirs.length; i++) {
      select.append(jQuery('<option>', {
        text  : request.dirs[i].label + ' (' + request.dirs[i].dir + ')',
        value : request.dirs[i].dir,
      }));
    }
  }
  console.log('DIRS');

  // events
  jQuery('#save').click(function () {
    console.log(request);
    console.log(select);
    message = {url: request.url};
    if (select.prop('selectedIndex') === selectNewDirectoryIndex) {
      message.dir = newDirectory.val();
      if (addToCustomLocations.prop('checked')) {
        message.new_label = newLabel.val();
        message.add_to_custom_locations = true;
      }
    } else {
      message.dir = select.val();
    }
    chrome.runtime.sendMessage(message);
    window.close();
  });

  jQuery('#cancel').click(function () {
    window.close();
  });
});

jQuery(function ($) {
  var newElm = $('#new');
  var newDirectory = $('#newDirectory');
  $('#downloadLocations').on('change', function (e) {
    if (e.target.selectedIndex === selectNewDirectoryIndex) {
      newElm.show();
      newDirectory.focus();
    } else {
      newElm.hide();
    }
    newElm.toggle(e.target.selectedIndex === 1);
  });

  port.onMessage.addListener(function (msg) {
    switch (msg.tag) {
      case TAG_DOWNLOAD_DIR:
        var download_dir = msg.args['download-dir'];
        // new dir so be helpful and add a slash
        if (!download_dir.endsWith('/')) {
          download_dir += '/';
        }
        newDirectory.val(download_dir);
        break;
      default:
        break;
    }
  });
  port.postMessage({args: '', method: 'session-get', tag: TAG_DOWNLOAD_DIR});
});
