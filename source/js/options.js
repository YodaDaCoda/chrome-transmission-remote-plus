// communication port with background page
var port = chrome.extension.connect({ name: 'options' });

// add custom download directory to table
/*=================================================================================
 addDir (string label, string dir)

 adds a custom download location to the end of the customdirs table

 parameters
	label: (required) the lable to call the download location
	  dir: (required) the path for the download location

 returns
	nothing
=================================================================================*/
function addDir(label, dir) {
	// missing information
	if (label === '' || dir === '') return;

	var table = document.getElementById('customdirs');

	// duplicate label
	for (var i = 2, row; row = table.rows[i]; ++i) {
		if (row.childNodes[0].childNodes[0].value === label) return;
	}

	var rowElem = table.insertRow(-1),
		col1Elem = rowElem.insertCell(-1),
		col2Elem = rowElem.insertCell(-1),
		col3Elem = rowElem.insertCell(-1),
		labelElem = document.createElement('input'),
		dirElem = document.createElement('input'),
		upButton = document.createElement('div'),
		downButton = document.createElement('div'),
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
	upButton.addEventListener('click', function() { if (rowElem.rowIndex > 2) { table.tBodies[0].insertBefore(rowElem, rowElem.previousSibling); } }, false);

	downButton.setAttribute('class', 'button down');
	downButton.addEventListener('click', function() { if (rowElem.rowIndex < (table.rows.length - 1)) { table.tBodies[0].insertBefore(rowElem, rowElem.nextSibling.nextSibling); } }, false);

	removeButton.setAttribute('class', 'button remove');
	removeButton.addEventListener('click', function() { table.tBodies[0].removeChild(rowElem); }, false);

	// clear the add inputs
	document.getElementById('customlabel').value = '';
	document.getElementById('customdir').value = '';
}

function save() {
	localStorage.server = document.getElementById('protocol').value + '://' +
		document.getElementById('ip').value + ':' +
		document.getElementById('port').value;

	if (document.getElementById('path').value !== '') {
		localStorage.server += '/' + document.getElementById('path').value;
	}

	localStorage.rpcPath = (document.getElementById('rpcPath').value !== '') ? '/' + document.getElementById('rpcPath').value : '';
	localStorage.webPath = (document.getElementById('webPath').value !== '') ? '/' + document.getElementById('webPath').value + '/': '';

	localStorage.user = document.getElementById('user').value;
	localStorage.pass = document.getElementById('pass').value;

	localStorage.notifications = document.getElementById('notifications').checked;
	localStorage.browsernotificationtimeout = document.getElementById('browsernotificationtimeout').value;

	// send message to background page to en/disable notifications
	port.postMessage({ notifications: document.getElementById('notifications').checked });

	localStorage.clickAction = (document.getElementById('dlremote').checked) ? 'dlremote' : 'dllocal';

	localStorage.dlPopup = document.getElementById('dlpopup').checked;

	localStorage.dLocation = (document.getElementById('dldefault').checked) ? 'dldefault' : 'dlcustom';

	// loop through the custom directories and save them
	var table = document.getElementById('customdirs'), dirs = [];
	for (var i = 2, row; row = table.rows[i]; ++i) {
		dirs.push({ label: row.childNodes[0].childNodes[0].value, dir: row.childNodes[1].childNodes[0].value });
	}

	localStorage.dirs = JSON.stringify(dirs);

	$("#saved").fadeIn(100);
	$("#saved").fadeOut(1000);
}

$(function() {
	// set default options if this is a first time user or a new version
	if (typeof localStorage.verConfig === 'undefined' || localStorage.verConfig < 5) {
		if (typeof localStorage.server === 'undefined') localStorage.server = 'http://localhost:9091/transmission';
		if (typeof localStorage.rpcPath === 'undefined') localStorage.rpcPath = '/rpc';
		if (typeof localStorage.webPath === 'undefined') localStorage.webPath = '/web/';
		if (typeof localStorage.user === 'undefined') localStorage.user = '';
		if (typeof localStorage.pass === 'undefined') localStorage.pass = '';
		if (typeof localStorage.notifications === 'undefined') localStorage.notifications = true;
		if (typeof localStorage.browsernotificationtimeout === 'undefined') localStorage.browsernotificationtimeout = '1000';
		if (typeof localStorage.clickAction === 'undefined') localStorage.clickAction = 'dlremote';
		if (typeof localStorage.dlPopup === 'undefined') localStorage.dlPopup = true;

		if (typeof localStorage.dLocation === 'undefined') {
			if (typeof localStorage.dlocation !== 'undefined') {
				localStorage.dLocation = localStorage.dlocation;
			} else {
				localStorage.dLocation = 'dldefault';
				localStorage.dirs = '[]';
			}
		}

		if (typeof localStorage.sessionId === 'undefined') localStorage.sessionId = '';
		if (typeof localStorage.torrentType === 'undefined') localStorage.torrentType = 0;
		if (typeof localStorage.torrentFilter === 'undefined') localStorage.torrentFilter = '';

		// updated to the latest version
		localStorage.verConfig = 5;
	}

	var dirs = JSON.parse(localStorage.dirs),
		server = localStorage.server.match(/(https?):\/\/(.+):(\d+)\/?(.*)/);

	// server
	document.getElementById('protocol').value = server[1];
	document.getElementById('ip').value = server[2];
	document.getElementById('port').value = server[3];
	document.getElementById('path').value = server[4];

	document.getElementById('rpcPath').value = localStorage.rpcPath.replace(/\//g, '');
	document.getElementById('webPath').value = localStorage.webPath.replace(/\//g, '');

	document.getElementById('user').value = localStorage.user;
	document.getElementById('pass').value = localStorage.pass;

	// general
	document.getElementById('notifications').checked = (localStorage.notifications === 'true') ? true : false;
	document.getElementById('browsernotificationtimeout').value = localStorage.browsernotificationtimeout;

	// download
	document.getElementById(localStorage.clickAction).checked = true;
	document.getElementById('dlpopup').checked = (localStorage.dlPopup === 'true') ? true : false;

	document.getElementById(localStorage.dLocation).checked = true;
	if (localStorage.dLocation === 'dlcustom') {
		document.getElementById('dlpopup').disabled = true;
	}

	// display the list of custom download directories
	for (var i = 0, dir; dir = dirs[i]; ++i) {
		addDir(dirs[i].label, dirs[i].dir);
	}
	$("#save").bind("click", save);
	$("#user,#pass").bind("focus", function(){this.type = 'text';});
	$("#user,#pass").bind("blur", function(){this.type = 'password';});
});


$(function() {
	$('#dldefault').bind("click", function() {
		document.getElementById('dlpopup').disabled = false;
	});
	$('#dlcustom').bind("click", function() {
		document.getElementById('dlpopup').disabled = true;
	});
	$('#adddir').bind("click", function() {
		addDir(document.getElementById('customlabel').value, document.getElementById('customdir').value);
	});
});