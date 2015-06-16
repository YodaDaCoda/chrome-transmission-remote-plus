// open up a session with the background page
var port = chrome.extension.connect({ name: 'inject' });

/*=================================================================================
 clickTorrent(event e)

 send the torrent link that was clicked to the background page

 parameters
	e: event variable sent by the event that was triggered

 returns
	nothing
=================================================================================*/
function clickTorrent(e) {
	// begin download of torrent
	port.postMessage({ 'url': e.currentTarget.href, 'method': 'torrent-add' });

	// stop any further events and the default action of downloading locally
	e.preventDefault();
	e.stopPropagation();
}

// torrent link has been verified as being valid, add click event to it
port.onMessage.addListener(function(msg) {
	switch (msg.method) {
		case 'checkLink':
			document.links[msg.num].addEventListener('click', clickTorrent, true);
			break;
		case 'checkClick':
			var links = document.links;
			// send each link to the background page for torrent validation
			for (var i = 0, link; link = links[i]; ++i) {
				port.postMessage({ 'url': link.href, 'num': i, 'method': 'checkLink' });
			}
			break;
	}
});

// checks each link on the page to see if it's a torrent download link
(function() {
	// check to see if we should be hijacking torrent links
	port.postMessage({ 'method': 'checkClick' });
	document.body.addEventListener('DOMSubtreeModified', function() {
		port.postMessage({'method': 'checkClick'});
	}, true);
})();
