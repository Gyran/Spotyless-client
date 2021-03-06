/**
By Gyran!
**/

/* Spotify variables */
var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var player = models.player;
/*********************/

/* Remote variables */
var BACKEND_HOST = 'https://gyran.se:9004';
/********************/

// userid
var user;
// socket
var socket;
var firstTime = true;

// status for the app
var APP_username;
var APP_registred;
var APP_hash;
var APP_loggedIn;
var APP_playlist;



// number of attempts to reconnect
var reconnectAttempts;
var reconnectTimer;

exports.init = init;

function init() {
	// Set app variables
	APP_loggedIn = false;
	APP_playlist = new models.Playlist();
	/****************/

	console.log(APP_playlist);

	APP_username = 'Gyran';
	$('#username').val(APP_username);

	APP_hash = sp.core.getAnonymousUserId();

	setupButtons();

	player.observe(models.EVENT.CHANGE, playerChanged);
	APP_playlist.observe(models.EVENT.CHANGE, playlistChanged);

	logApp('Initialized');

	startApp();
}

function updatePlaylistTable() {
	console.log('updating playlist');
	$('#playlist').html('');

	$.each(APP_playlist.tracks, function(key, track) {
		var row = $('<tr>');
		$('<td>', { text: track.data.name }).appendTo(row);
		$('#playlist').append(row);
	});
}

function playlistChanged() {
	updatePlaylistTable();
	sendPlaylist();
}

function playerChanged(e) {
	var update = false;
	$.each(e.data, function (key, value) {
		if (value) {
			update = true;
			return;
		}
	});
	if (update) {
		sendPlayerUpdate();
	}
}


/** Utils **/
function stripTracksInfo(tracks) {
	var newTracks = [];
	$.each(tracks, function (key, track) {
		var newTrack = {
			artist: getArtistString(track),
			name: track.data.name,
			uri: track.data.uri
		};
		newTracks.push(newTrack);
	});

	return newTracks;
}

function getArtistString(track) {
	var s = '';
	$.each(track.data.artists, function (key, artist) {
		s += ', ' + artist.name;
	});

	return s.substr(2);
}

/***********/

// bind buttons to events
function setupButtons() {
	$('#btnLogin').click(login);
	$('#btnLogout').click(logout);
}

function login() {
	$('#password').removeClass('wrong');
	$('#btnLogin').attr('disabled', 'disabled');
	$('#btnLogout').removeAttr('disabled');
	var username = $('#username').val();
	var password = $('#password').val();

	socket.emit('login', username, password);
}

function logout() {
	$('#btnLogout').attr('disabled', 'disabled');
	$('#btnLogin').removeAttr('disabled');
	updateStatus('Connected', 'good');
	socket.emit('logout');
	APP_loggedIn = false;
	APP_registred = false;
	$('#logout').hide();
	$('#login').show();
}

function stopApp() {
	socket.disconnect();
}

function startApp() {
	logApp('Starting');
	connect();
}

function hasPermission(type) {
	switch (type) {
		case 'player':
			return true;
			break;
		case 'playlist':
			return true;
			break;
		default:
			log('Tried to use permission ' + type);
			return false;
			break;
	}
}

function gotCommand(command) {
	// TODO get seek command ms
	console.log("Getting command", command);

	if (hasPermission(command.type)) {
		if (command.type == 'player') {
			switch (command.action) {
			case 'playpause':
				cmdPlaypause();
				break;
			case 'next':
				cmdNext();
				break;
			case 'previous':
				cmdPrevious();
				break;
			case 'shuffle':
				cmdShuffle();
				break;
			case 'repeat':
				cmdRepeat();
				break;
			case 'playTrack':
				cmdPlayTrack(command.uri);
				break;
			case 'playSpotylessPlaylist':
				cmdPlaySpotylessPlaylist();
				break;

			default:
				logCommand("Unknown command");
				break;
			}
		} else if (command.type == 'playlist') {
			switch (command.action) {
			case 'delTrack':
				cmdDelTrack(command.uri);
				break;
			case 'addTrack':
				cmdAddTrack(command.uri);
				break;
			default:
				logCommand("Unknown command");
				break;
			}
		}
	}
}

function getPermissions(clientid) {
	return {
		canPlayPause: true,
		canPlayNext: true,
		canPlayPrevious: true,
		canSearch: true,
		canAdd: true,
		canPlayNew: true,
		canRemove: true
	};
}

function sendPermissions(clientid) {
	socket.emit('sendPermissions', clientid, getPermissions(clientid));
}

function clientConnected(clientid) {
	logApp('client connected');
	sendPlayerUpdate(clientid);
	sendPlaylist(clientid);
	sendPermissions(clientid);
}

function updateStatus(text, newClass) {
	$('#status').text(text).removeClass('good bad').addClass(newClass);
}

function connectionEstablished() {
	logApp("Socket connected");
	updateStatus('Connected', 'good');
}

function disconnected() {
	logApp('Socket disconnected');
	updateStatus('Disconnected', 'bad');
}

function wrongPassword() {
	$('#password').val('');
	$('#password').addClass('wrong');
	$('#btnLogin').removeAttr('disabled');
}

function authenticated(username) {
	APP_loggedIn = true;
	APP_username = username;
	$('#login').hide();
	$('#loggedinAs').text('Logged in as ' + APP_username);
	$('#logout').show();

	socket.emit('register', APP_hash);

	updateStatus('Logged in', 'good');
}

function doSearch(needle, callback) {
	console.log('searching for', needle);
	var search = new models.Search(needle);
	search.localResults = models.LOCALSEARCHRESULTS.APPEND;
	search.searchPlaylists = false;
	search.searchAlbums = false;
	search.searchArtists = false;

	search.observe(models.EVENT.CHANGE, function() {
		callback(search);
	});

	search.appendNext();

}

function clientSearch(clientid, needle) {
	console.log('client is searching for', needle);
	doSearch(needle, function(search) {
		socket.emit('searchDone', clientid, stripTracksInfo(search.tracks));
	});
}

function registred() {
	APP_registred = true;
}

function connect() {
	socket = io.connect(BACKEND_HOST + '/spotify', { secure: true });	

	if (firstTime) {
		socket.on('connect', connectionEstablished);
		socket.on('gotCommand', gotCommand);
		socket.on('disconnect', disconnected);
		socket.on('wrong password', wrongPassword);
		socket.on('authenticated', authenticated);
		socket.on('registred', registred);
		socket.on('clientConnected', clientConnected);

		socket.on('search', clientSearch);

		firstTime = false;
	}
}

function getPlayerObject() {
	return playerObj = {
		'track': player.track,
		'repeat': player.repeat,
		'shuffle': player.shuffle,
		'volume': player.volume,
		'playing': player.playing,
		'context': player.context
	};
}

function getPlaylistTracks() {
	return stripTracksInfo(APP_playlist.tracks);
}

/* Logging */

function nowStr() {
	function datePad(i) {
		if (i < 10) {
			return '0' + i;
		}
		return i;
	};

	var now = new Date();
	now = now.getFullYear() + '-' + datePad(now.getMonth() + 1) + '-'
		+ datePad(now.getDate()) + ' ' + datePad(now.getHours()) + ':'
		+ datePad(now.getMinutes()) + ':' + datePad(now.getSeconds());

	return now;
}

function log(l) {
	$('#history').prepend(nowStr() + ' - ' + l + '<br>');
}

function logCommand(command) {
	log('Command: ' + command);
}

function logApp(message) {
	log('Application: ' + message);
}

/***********/

/* Send updates */

function sendPlayerUpdate(clientid) {
	if (APP_registred) {
		socket.emit('playerUpdated', getPlayerObject(), clientid);
	}
}

function sendPlaylist(clientid) {
	if (APP_registred) {
		console.log('sending playlist');
		socket.emit('playlistChanged', getPlaylistTracks(), clientid);
	}
}

/****************/

/* Commands */

function cmdPlaypause() {
	if (!player.canPlayPause) {
		return;
	}
	player.playing = !player.playing;
	if (player.playing) {
		logCommand('Play');
	} else {
		logCommand('Pause');
	}
}

function cmdNext() {
	if (!player.canPlayNext) {
		return;
	}
	player.next();
	logCommand('Next track');
}

function cmdPrevious() {
	if (!player.canPlayPrevious) {
		return;
	}
	player.previous();
	logCommand('Previous track');
}

function cmdShuffle() {
	if (!player.canChangeShuffle) {
		return;
	}
	player.shuffle = !player.shuffle;
	if (player.shuffle) {
		logCommand('Activate shuffle');
	} else {
		logCommand('Deactivate shuffle');
	}
}

function cmdRepeat() {
	if (!player.canChangeRepeat) {
		return;
	}

	player.repeat = !player.repeat;
	if (player.repeat) {
		logCommand('Activate repeat');
	} else {
		logCommand('Deactivate repeat');
	}
}

function cmdPlayTrack(uri) {
	if (player.context != APP_playlist.data.uri) {
		player.play(APP_playlist.data.uri);
	}
	player.play(uri);
}

function cmdAddTrack(uri) {
	APP_playlist.add(uri);
}

function cmdPlaySpotylessPlaylist() {
	player.play(APP_playlist.data.uri);
}

function cmdDelTrack(uri) {
	APP_playlist.remove(uri);
}

/************/