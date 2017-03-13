
// global variables
var completedTorrents = '',		// string of completed torrents to prevent duplicate notifications
	notificationTimer,
	torrentInfo = {};			// timer for displaying notifications

/*=================================================================================
 showBadge(string text, RGBA color, milliseconds duration)

 displays a text badge on the browser icon

 parameters
	   text: (required) text to display
	  color: (required) color of badge
   duration: (required) how long to show badge for

 returns
	nothing
=================================================================================*/
function showBadge(text, color, duration) {

	duration = (duration == undefined) ? localStorage.browserbadgetimeout : duration;

	chrome.browserAction.setBadgeBackgroundColor({ color: color });
	chrome.browserAction.setBadgeText({ text: text });

	setTimeout(function () { chrome.browserAction.setBadgeText({ 'text': '' }); }, duration);
}

/*=================================================================================
 showNotification(string title, string message)

 displays a text badge on the browser icon

 parameters
	message: (required) title of notification
	   text: (required) text to display

 returns
	nothing
=================================================================================*/
function showNotification(title, message) {

	var options = {
		type: "basic",
		title: title,
		message: message,
		iconUrl: "images/icon128.png"
	};

	var creationCallback = function() { /* Error checking goes here */ };

	if (localStorage.notificationsnewtorrent == "true") {
		chrome.notifications.create("tadd"+Math.random(), options, creationCallback);
	}
}

/*=================================================================================
 rpcTransmission(object args, string method, int tag, function callback)

 send a request to a remote Transmission client

 parameters
		args: (required) data to pass to the Transmission client
	  method: (required) tells the Transmission client how to handle the data
		 tag: makes it easy to know what to do with the response
	callback: function to reference with the response

 returns
		nothing
=================================================================================*/
function rpcTransmission(args, method, tag, callback) {
	$.ajax(
		{
			url: localStorage.server + localStorage.rpcPath,
			type: 'POST',
			beforeSend: function (xhr) {
					if ( localStorage.user != '')
					{
						xhr.setRequestHeader('Authorization ', 'Basic ' + btoa(localStorage.user +':' + localStorage.pass));
					}
		   		},
			headers: {'X-Transmission-Session-Id': localStorage.sessionId},
			data: '{ "arguments": {' + args + '}, "method": "' + method + '"' + (tag ? ', "tag": ' + tag : '') + '}'
		}
	).complete(
		function(jqXHR, textStatus) {
			var xSid = jqXHR.getResponseHeader('X-Transmission-Session-Id');
			if(xSid) {	//X-Transmission-Session-Id should only be included if we didn't include it when we sent our request
				localStorage.sessionId = xSid;
				rpcTransmission(args, method, tag, callback);
				return;
			}
			if (textStatus == "error"){		//If the server is unreachable, get null request
				callback(JSON.parse(
					'{"arguments":{"torrents":[{"addedDate":0,"doneDate":0,"downloadDir":"","eta":0,"id":0,"leftUntilDone":0,"metadataPercentComplete":0,"name":"Unable to connect to '+localStorage.server+'.","rateDownload":0,"rateUpload":0,"recheckProgress":0,"sizeWhenDone":0,"status":0,"uploadedEver":0}]},"result":"Unable to connect to server.","tag":1}'
				));
				return;
			}
			if (callback) {
				callback(jqXHR.responseJSON);
			}
		}
	);
}

/*=================================================================================
 getTorrent(URL url)

 attempt to download url as a torrent file

 parameters
	url: (required) url to download

 returns
	nothing
=================================================================================*/
function getTorrent(url) {
	var dirs = (localStorage.dirs) ? JSON.parse(localStorage.dirs) : [];
	// show download popup?
	if (localStorage.dlPopup === 'false') {
		dlTorrent({ 'url': url, 'paused': localStorage.start_paused });
	} else {
		// don't use base64 on magnet links
		if (url.toLowerCase().indexOf('magnet:') == 0) {	//it's a magnet
			torrentInfo['magnet'] = { 'dirs': dirs, 'url': url };
			chrome.windows.create({
				'url': 'downloadMagnet.html',
				'type': 'popup',
				'width': 852,
				'height': 190,
				'left': screen.width/2 - 852/2,
				'top': screen.height/2 - 160/2
			});
		} else {	//it's a .torrent
			getFile(url, function(file) {
				parseTorrent(file, function(torrent) {
					if (torrent !== null) {
						encodeFile(file, function(data) {
							torrentInfo['torrent'] = { 'torrent': torrent, 'data': data, 'dirs': dirs };
							chrome.windows.create({
								'url': 'downloadTorrent.html',
								'type': 'popup',
								'width': 850,
								'height': 610,
								'left': (screen.width/2) - 425,
								'top': (screen.height/2) - 300,
							});
						});
					} else {
						alert('This isn\'t a torrent file.')
					}
				});
			});
		}
	}
}

/*=================================================================================
 dlTorrent(Object request)

 download the torrent

 parameters
	request: (required) object containg data needed to download torrent

 returns
	nothing
=================================================================================*/
function dlTorrent(request) {
	if (request.add_to_custom_locations) {
		var dir = request.dir;
		var label = request.new_label;
		if (label == "") {
			var i = dir.lastIndexOf("/");
			if (i == -1) {
				label = dir;
			} else {
				// use basename as label
				label = dir.substring(i+1);
			}
		}

		var dirs = (localStorage.dirs) ? JSON.parse(localStorage.dirs) : [];
		dirs.push({ "label": label, "dir": dir });
		localStorage.dirs = JSON.stringify(dirs);
	}

	// how are we going to send this torrent to transmission?
	var args = (typeof request.data !== 'undefined') ? '"metainfo": "' + request.data + '"' : '"filename": "' + request.url + '"';
	// where are we going to download it to? empty dir means default
	if (typeof request.dir !== 'undefined' && request.dir != '') {
		args += ', "download-dir": "' + request.dir + '"';
	}
	
	if (request.paused) {
		args += ', "paused": true';
	}
	if(request.high && request.high.length) {
		args += ', "priority-high": [' + request.high.join(',') + ']';
	}

	if(request.normal && request.normal.length) {
		args += ', "priority-normal": [' + request.normal.join(',') + ']';
	}

	if(request.low && request.low.length) {
		args += ', "priority-low": [' + request.low.join(',') + ']';
	}

	if(request.blacklist && request.blacklist.length) {
		args += ', "files-unwanted": [' + request.blacklist.join(',') + ']';
	}

	// send the torrent to transmission
	rpcTransmission(args, 'torrent-add', '', function (response) {
		// show a badge on the browser icon depending on the response from Transmission
		// show a badge on the browser icon depending on the response from Transmission
		if (response.arguments["torrent-duplicate"]) {
			showBadge('dup', [0, 0, 255, 255]);
			showNotification("Duplicate torrent", "");
		} else if (response.arguments["torrent-added"]) {
			showBadge('add', [0, 255, 0, 255]);
			showNotification("Torrent added successfully", response.arguments["torrent-added"].name);
		} else {
			showBadge('fail', [255, 0, 0, 255]);
			showNotification("Adding torrent failed", "");
			alert('Torrent download failed!\n\n' + response.result);
		}
	});
}

/*=================================================================================
 notificationRefresh()

 request a minimal list of torrents with recent activity (30s timer)

 parameters
	none

 returns
	nothing
=================================================================================*/
function notificationRefresh() {
	rpcTransmission('"fields": [ "id", "name", "status", "leftUntilDone" ], "ids": "recently-active"', 'torrent-get', 10, function (response) {
		var notification;

		for (var i = 0, torrent; torrent = response.arguments.torrents[i]; ++i) {
			if (torrent.status === 16 && torrent.leftUntilDone === 0 && completedTorrents.indexOf(torrent.id) < 0) {
				notification = webkitNotifications.createNotification(
					'images/icon48.png',
					'Torrent Download Complete',
					torrent.name + ' has finished downloading.'
				);
				notification.show();

				// hide the notification after 30 seconds
				setTimeout(function() { notification.cancel(); }, '30000');

				// mark the completed torrent so another notification isn't displayed for it
				completedTorrents += torrent.id + ',';
			}
		}
	});

	notificationTimer = setTimeout(notificationRefresh, 30000);
}

// receive messages from other parts of the script
chrome.extension.onConnect.addListener(function(port) {
	switch(port.name) {
		case 'popup':
			port.onMessage.addListener(function(msg) {
				switch(msg.method) {
					case 'torrent-get':
					case 'session-get':
						rpcTransmission(msg.args, msg.method, msg.tag, function (response) {
							port.postMessage({ 'args': response.arguments, 'tag': response.tag });
						});
					break;
					default:
						rpcTransmission(msg.args, msg.method);
				}
			});
		break;
		case 'inject':
			port.onMessage.addListener(function(msg) {
				switch(msg.method) {
					case 'torrent-add':
						getTorrent(msg.url);
					break;
				}
			});
		break;
		case 'options':
			port.onMessage.addListener(function(msg) {
				// stop the notification timer
				clearTimeout(notificationTimer);

				// start it up again if it's enabled
				if (msg.notifications) notificationRefresh();
			});
		break;
		case 'downloadMagnet':
		case 'downloadTorrent':
			port.onMessage.addListener(function(msg) {
				switch(msg.method) {
					case 'session-get':
						rpcTransmission(msg.args, msg.method, msg.tag, function (response) {
							port.postMessage({ 'args': response.arguments, 'tag': response.tag });
						});
					break;
				}
			});

                break;
	}
});

// recieve message to send torrent to transmission
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
	if(request.method == "get-torrent-info") {
		sendResponse(torrentInfo[request.page]);
	}else{
		dlTorrent(request);
		sendResponse({});	// close connection cleanly
	}
});

/*=================================================================================
 start context menu
=================================================================================*/
// attempt to download the url from a context menu as a torrent
function contextMenuClick(info, tab) {
	getTorrent(info.linkUrl);
}

// only add to context menu for links
chrome.contextMenus.create({
		'title': 'Download with Remote Transmission'
	,	'contexts': [ 'link' ]
	,	'onclick': contextMenuClick
	//TODO: watch this http://code.google.com/p/chromium/issues/detail?id=84024
	//,	'targetUrlPatterns': TORRENT_LINKS
});
/*=================================================================================
 end context menu
=================================================================================*/

(function() {
	// show notifications if they're enabled
	if (localStorage.notificationstorrentfinished === 'true') {
		notificationRefresh();
	}

	// make sure users are up-to-date with their config
	//                first install                                           upgraded extension major version
	if (typeof(localStorage.version) == "undefined" || chrome.runtime.getManifest().version.split(".")[0] !== localStorage.version.split(".")[0] ) {
		chrome.tabs.create({ url: "options.html?newver=true" });
	}

	//This function runs when the extension is first loaded.
	//If that's after tabs are already open, then we need to inject our script into them, or they won't pick up torrent/magnet link clicks.
	chrome.windows.getAll({populate:true}, function(windows) {
		for (var i = 0; i < windows.length; i++) {
			for (var j = 0; j < windows[i].tabs.length; j++) {
				if (windows[i].tabs[j].url.substr(0,4) == "http") {
					//Chrome will throw an error here if the user has the chrome://extensions window open,
					// despite the fact that we don't inject the script to that tab.
					chrome.tabs.executeScript(windows[i].tabs[j].id, {file: "js/inject.js"});
				}
			}
		}
	});

})();
