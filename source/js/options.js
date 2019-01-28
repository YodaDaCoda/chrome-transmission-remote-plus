// communication port with background page
var port = chrome.runtime.connect({name: 'options'});

// add custom download directory to table
/* =================================================================================
 addDir (string label, string dir)

 adds a custom download location to the end of the customdirs table

 parameters
  label: (required) the lable to call the download location
    dir: (required) the path for the download location

 returns
  nothing
================================================================================= */
function addDir(label, dir) {

  var table;
  var rowElem;
  var col1Elem;
  var col2Elem;
  var col3Elem;
  var labelElem;
  var dirElem;
  var upButton;
  var downButton;
  var removeButton;

  // missing information
  if (label === '' || dir === '') {
    return;
  }

  table = document.getElementById('customdirs');

  // duplicate label
  for (let i = 1; i < table.rows.length - 1; ++i) {
    if (table.rows[i].childNodes[0].childNodes[0].value === label) {return;}
  }

  rowElem = table.insertRow(table.rows.length - 1);
  col1Elem = rowElem.insertCell(-1);
  col2Elem = rowElem.insertCell(-1);
  col3Elem = rowElem.insertCell(-1);
  labelElem = document.createElement('input');
  dirElem = document.createElement('input');
  upButton = document.createElement('div');
  downButton = document.createElement('div');
  removeButton = document.createElement('div');

  col1Elem.appendChild(labelElem);
  col2Elem.appendChild(dirElem);
  col3Elem.appendChild(upButton);
  col3Elem.appendChild(downButton);
  col3Elem.appendChild(removeButton);

  labelElem.setAttribute('type', 'text');
  labelElem.setAttribute('class', 'label');
  labelElem.setAttribute('value', label);
  dirElem.setAttribute('type', 'text');
  dirElem.setAttribute('class', 'dir');
  dirElem.setAttribute('value', dir);

  upButton.setAttribute('class', 'button up');
  upButton.addEventListener('click', function () { if (rowElem.rowIndex > 2) { table.tBodies[0].insertBefore(rowElem, rowElem.previousSibling); } }, false);

  downButton.setAttribute('class', 'button down');
  downButton.addEventListener('click', function () { if (rowElem.rowIndex < (table.rows.length - 1)) { table.tBodies[0].insertBefore(rowElem, rowElem.nextSibling.nextSibling); } }, false);

  removeButton.setAttribute('class', 'button remove');
  removeButton.addEventListener('click', function () { table.tBodies[0].removeChild(rowElem); }, false);

  // clear the add inputs
  document.getElementById('customlabel').value = '';
  document.getElementById('customdir').value = '';
}

function save() {
  localStorage.server = jQuery('#protocol').val() + '://' + jQuery('#ip').val() + ':' + jQuery('#port').val();

  if (jQuery('#path').val() !== '') {
    localStorage.server += '/' + jQuery('#path').val();
  }

  localStorage.rpcPath = (jQuery('#rpcPath').val() !== '') ? '/' + jQuery('#rpcPath').val() : '';
  localStorage.webPath = (jQuery('#webPath').val() !== '') ? '/' + jQuery('#webPath').val() + '/' : '';

  localStorage.user = jQuery('#user').val();
  localStorage.pass = jQuery('#pass').val();

  localStorage.notificationstorrentfinished = jQuery('#notificationstorrentfinished').prop('checked');
  localStorage.notificationsnewtorrent = jQuery('#notificationsnewtorrent').prop('checked');

  localStorage.browserbadgetimeout = jQuery('#browserbadgetimeout').val();
  localStorage.popuprefreshinterval = jQuery('#popuprefreshinterval').val();

  localStorage.start_paused = jQuery('#start_paused').prop('checked');

  // whether to handle the torrent click (i.e. download remotely) or leave to chrome to handle (download locally)
  localStorage.clickAction = jQuery('input[name=\'clickaction\']:checked').val();

  // whether or not to show the download popup
  localStorage.dlPopup = jQuery('#dlpopup').prop('checked');

  // loop through the custom directories and save them
  let table = document.getElementById('customdirs');
  let dirs = [];
  for (let i = 1; i < table.rows.length - 1; ++i) {
    dirs.push({label: table.rows[i].childNodes[0].childNodes[0].value, dir: table.rows[i].childNodes[1].childNodes[0].value});
  }
  localStorage.dirs = JSON.stringify(dirs);

  localStorage.version = chrome.runtime.getManifest().version;

  // send message to background that options were saved
  port.postMessage({method: 'settings-saved'});

  jQuery('#saved').fadeIn(100);
  jQuery('#saved').fadeOut(1000);
}

jQuery(function ($) {

  var VERCONFIG = 6;  // This value must be updated in background.js too
  var defaults = {
    verConfig                    : VERCONFIG,
    server                       : 'http://localhost:9091/transmission',
    rpcPath                      : 'rpc',
    webPath                      : 'web',
    user                         : '',
    pass                         : '',
    notificationstorrentfinished : true,
    notificationsnewtorrent      : false,
    browserbadgetimeout          : 1000,
    popuprefreshinterval         : 3000,
    start_paused                 : false,
    clickAction                  : 'dlremote',
    dlPopup                      : true,
    dirs                         : '[]',
    sessionId                    : '',
    torrentType                  : -1,
    torrentFilter                : '',
  };

  /*
    Credit to Quentin at StackOverflow for this trick
    http://stackoverflow.com/questions/979975/how-to-get-the-value-from-url-parameter
  */
  var QueryString = (function () {
    // This function is anonymous, is executed immediately and
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (let i = 0; i < vars.length; i++) {
      let pair = vars[i].split('=');
      // If first entry with this name
      if (typeof query_string[pair[0]] === 'undefined') {
        query_string[pair[0]] = pair[1];
        // If second entry with this name
      } else if (typeof query_string[pair[0]] === 'string') {
        let arr = [
          query_string[pair[0]],
          pair[1],
        ];
        query_string[pair[0]] = arr;
        // If third or later entry with this name
      } else {
        query_string[pair[0]].push(pair[1]);
      }
    }
    return query_string;
  }());

  //                       first install              big settings change
  if (typeof localStorage.verConfig === 'undefined' || localStorage.verConfig < VERCONFIG) {
    console.log('Upgrading configuration from ' + localStorage.verConfig + ' to ' + VERCONFIG);
    // Reset everything to defaults
    for (let i in defaults) {
      if ({}.hasOwnProperty.call(defaults, i)) {
        localStorage[i] = defaults[i];
      }
    }
  } else {  // user opened it, or it's been automatically opened
    // set default options for any unset options - may be triggered on minor additions that don't require a full reconfiguration by the user
    for (let i in defaults) {
      if (typeof (localStorage[i]) === 'undefined') {
        console.log('Adding new config option ' + i + ' from defaults');
        localStorage[i] = defaults[i];
      }
    }
    // always update config version
    localStorage.verConfig = VERCONFIG;
  }

  let dirs = JSON.parse(localStorage.dirs);
  let server = localStorage.server.match(/(.*?):\/\/(.+):(\d+)\/(.*)/);

  // server
  $('#protocol').val(server[1]);
  $('#ip').val(server[2]);
  $('#port').val(server[3]);
  $('#path').val(server[4]);

  $('#rpcPath').val(localStorage.rpcPath.replace(/\//g, ''));
  $('#webPath').val(localStorage.webPath.replace(/\//g, ''));

  $('#user').val(localStorage.user);
  $('#pass').val(localStorage.pass);

  // notifications
  $('#notificationstorrentfinished').prop('checked', (localStorage.notificationstorrentfinished === 'true'));
  $('#notificationsnewtorrent').prop('checked', localStorage.notificationsnewtorrent === 'true');

  // badge timeout
  $('#browserbadgetimeout').val(localStorage.browserbadgetimeout);

  // popup refresh interval
  $('#popuprefreshinterval').val(localStorage.popuprefreshinterval);

  // Start paused?
  $('#start_paused').val(localStorage.start_paused);

  // download
  document.getElementById(localStorage.clickAction).checked = true;
  $('#dlpopup').prop('checked', (localStorage.dlPopup === 'true'));

  // display the list of custom download directories
  for (let i = 0, dir; dir = dirs[i]; ++i) {
    addDir(dirs[i].label, dirs[i].dir);
  }
  $('#save').on('click', save);
  $('#user,#pass').on('focus', function () {this.type = 'text';});
  $('#user,#pass').on('blur', function () {this.type = 'password';});
});


jQuery(function ($) {
  $('#dldefault').on('click', function () {
    $('#dlpopup').disabled = false;
  });
  $('#dlcustom').on('click', function () {
    $('#dlpopup').disabled = true;
  });
  $('#adddir').on('click', function () {
    addDir($('#customlabel').val(), $('#customdir').val());
  });
});
