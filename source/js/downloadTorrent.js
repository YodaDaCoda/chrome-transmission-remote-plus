var selectNewDirectoryIndex = 1;
const TAG_DOWNLOAD_DIR = 1;
var port = chrome.runtime.connect({name: 'downloadTorrent'});

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

function decodeBytes(bytes, encoding) {
  var i;
  var encodings = {
    // Windows code page 1252 Western European
    //
    cp1252: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\x0c\r\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7f\u20ac\ufffd\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\ufffd\u017d\ufffd\ufffd\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\ufffd\u017e\u0178\xa0\xa1\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xab\xac\xad\xae\xaf\xb0\xb1\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xbb\xbc\xbd\xbe\xbf\xc0\xc1\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xcb\xcc\xcd\xce\xcf\xd0\xd1\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xdb\xdc\xdd\xde\xdf\xe0\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xeb\xec\xed\xee\xef\xf0\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xfb\xfc\xfd\xfe\xff',

    // Windows code page 1251 Cyrillic
    //
    cp1251: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\x0c\r\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7f\u0402\u0403\u201a\u0453\u201e\u2026\u2020\u2021\u20ac\u2030\u0409\u2039\u040a\u040c\u040b\u040f\u0452\u2018\u2019\u201c\u201d\u2022\u2013\u2014\ufffd\u2122\u0459\u203a\u045a\u045c\u045b\u045f\xa0\u040e\u045e\u0408\xa4\u0490\xa6\xa7\u0401\xa9\u0404\xab\xac\xad\xae\u0407\xb0\xb1\u0406\u0456\u0491\xb5\xb6\xb7\u0451\u2116\u0454\xbb\u0458\u0405\u0455\u0457\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041a\u041b\u041c\u041d\u041e\u041f\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042a\u042b\u042c\u042d\u042e\u042f\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043a\u043b\u043c\u043d\u043e\u043f\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044a\u044b\u044c\u044d\u044e\u044f',
  };
  var enc = encodings[encoding];
  var n = bytes.length;
  var chars = new Array(n);
  for (i = 0; i < n; i++) {chars[i] = enc.charAt(bytes.charCodeAt(i));}
  return chars.join('');
}

function decodeString(s) {
  var r;
  try {
    r = decodeURIComponent(escape(s));
  } catch (e) {
    r = decodeBytes(s, 'cp1251');
  }
  return r;
}

function createCheckBox(id) {
  var chkBox = document.createElement('input');
  chkBox.type = 'checkbox';
  chkBox.name = 'chkFile' + id;
  chkBox.id = 'chkFile' + id;
  chkBox.defaultChecked = true;
  chkBox.className = 'listChkBox';
  return chkBox;
}

function createPriorityCheckboxes(id) {
  var list = [];

  var hi = document.createElement('input');
  hi.type = 'radio';
  hi.name = 'prio' + id;
  hi.value = 'high' + id;
  hi.id = 'prioHighFile' + id;
  hi.defaultChecked = false;
  hi.className = 'prioHighChkBox';

  var med = document.createElement('input');
  med.type = 'radio';
  med.value = 'medium' + id;
  med.name = 'prio' + id;
  med.id = 'prioMedFile' + id;
  med.defaultChecked = true;
  med.className = 'prioMedChkBox';

  var low = document.createElement('input');
  low.type = 'radio';
  low.value = 'low' + id;
  low.name = 'prio' + id;
  low.id = 'prioLowFile' + id;
  low.defaultChecked = false;
  low.className = 'prioLowChkBox';

  list.push(hi);
  list.push(med);
  list.push(low);

  return list;
}

function sortFiles(a, b) {
  var nameA = decodeString(a.path[0].split(' ')[0].toLowerCase());
  var nameB = decodeString(b.path[0].split(' ')[0].toLowerCase());

  if (nameA > nameB) {
    return 1;
  }
  if (nameA < nameB) {
    return -1;
  }
  return 0;
}

// populate the download popup with the torrent information
chrome.runtime.sendMessage({method: 'get-torrent-info', page: 'torrent'}, function (request) {
  var select = jQuery('#downloadLocations');
  var newLabel = jQuery('#newLabel');
  var newDirectory = jQuery('#newDirectory');
  var addToCustomLocations = jQuery('#addToCustomLocations');
  var option;
  var table = document.getElementById('files');
  var row;
  var boxes;

  var paused = jQuery('#downloadPauseTorrent');

  var name = decodeString(request.torrent.info.name);

  // add the name of the torrent
  jQuery('#torrentName').innerHTML = name;

  // add the list of download directories
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

  // how many files are in the torrent?
  if (typeof request.torrent.info.files === 'undefined') {		// 1
    row = table.insertRow(-1);
    row.insertCell(-1).appendChild(createCheckBox(0));
    row.insertCell(-1).appendChild(document.createTextNode(decodeString(name)));
    row.insertCell(-1).appendChild(document.createTextNode(formatBytes(request.torrent.info.length)));
    $('.priority').hide();
  } else {		// multiple
    var files = request.torrent.info.files.sort(sortFiles);
    for (var i = 0, file; file = files[i]; ++i) {
      row = table.insertRow(-1);
      row.insertCell(-1).appendChild(createCheckBox(i));
      row.insertCell(-1).appendChild(document.createTextNode(decodeString(file.path.join('/'))));
      row.insertCell(-1).appendChild(document.createTextNode(formatBytes(file.length)));
      var list = createPriorityCheckboxes(i);
      var cell = row.insertCell(-1);
      cell.appendChild(list[0]);
      cell.appendChild(list[1]);
      cell.appendChild(list[2]);
    }
  }

  boxes = document.querySelectorAll('input.listChkBox');
  prioHighBoxes = document.querySelectorAll('input.prioHighChkBox');
  prioMedBoxes = document.querySelectorAll('input.prioMedChkBox');
  prioLowBoxes = document.querySelectorAll('input.prioLowChkBox');

  // TODO: replace array with string
  function getNotSelectedFilesIds() {
    var list = [];

    for (var i = 0, l = boxes.length; i < l; i++) {
      if (!boxes.item(i).checked) {
        list.push(i);
      }
    }
    return list;
  }

  function getPrioHighFields() {
    var list = [];

    for (var i = 0; i < prioHighBoxes.length; i++) {
      if (prioHighBoxes.item(i).checked) {
        list.push(i);
      }
    }

    return list;
  }

  function getPrioMedFields() {
    var list = [];

    for (var i = 0; i < prioMedBoxes.length;  i++) {
      if (prioMedBoxes.item(i).checked) {
        list.push(i);
      }
    }

    return list;
  }

  function getPrioLowFields() {
    var list = [];

    for (var i = 0; i < prioLowBoxes.length; i++) {
      if (prioLowBoxes.item(i).checked) {
        list.push(i);
      }
    }

    return list;
  }

  // Toggle all select boxes

  jQuery('#checkAll').change(function (e) {
    for (var i = 0, l = boxes.length; i < l; i++) {
      boxes.item(i).checked = e.target.checked;
    }
  });

  // events
  jQuery('#save').click(function (e) {
    message = {
      data      : request.data,
      paused    : paused.checked,
      high      : getPrioHighFields(),
      normal    : getPrioMedFields(),
      low       : getPrioLowFields(),
      blacklist : getNotSelectedFilesIds(), // "files-wanted" not work for some reason
    };
    if (select.prop('selectedIndex') == selectNewDirectoryIndex) {
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

  jQuery('#cancel').click(function (e) {
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
