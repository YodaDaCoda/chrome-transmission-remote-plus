// array of regular expressions that dictate what is a valid torrent download url
var TORRENT_LINKS = [
  /^magnet:/i,
  /\.torrent$/i,
  /torrents\.php\?action=download/i,
  /\?.*info_hash=/i,
  /bt-chat\.com.*download/i,
  /torrentreactor\.net.*download/i,
  /vertor\.com.*download/i,
  /seedpeer\.com.*download/i,
  /torrentzap\.com.*download/i,
  /limetorrents\.com.*download/i,
  /h33t\.com.*download/i,
  /ahashare\.com.*download/i,
  /1337x\.org.*download/i,
  /bitenova\.nl.*download/i,
  /bibliotik\.org.*download/i,
  /demonoid\.me.*download\//i,
  /alivetorrents\.com\/dl\//i,
  /newtorrents\.info\/down\.php/i,
  /mininova\.org\/get/i,
  /kickasstorrents\.com\/torrents/i,
  /iptorrents\.com\/download\.php\/*\//i,
];

// open up a session with the background page
var port = chrome.runtime.connect({name: 'inject'});

/* =================================================================================
 clickTorrent(event e)

 // checks the link to see if it's a torrent download link, and sends it to be downloaded if so

 parameters
	e: event variable sent by the event that was triggered

 returns
	nothing
================================================================================= */
function clickTorrent(e) {
  var url = this.href;
  for (let i = 0; i < TORRENT_LINKS.length; i++) {
    if (TORRENT_LINKS[i].test(url)) {
      // begin download of torrent
      port.postMessage({url: url, method: 'torrent-add'});

      // stop any further events and the default action of downloading locally
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }
}

jQuery(function ($) {
  $('body').on('click', 'a', clickTorrent);
});
