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

/* 'Static' variables */
var STATUS_STOPPED = 0;
var STATUS_CONNECTED = 1;
var STATUS_LOGGED_IN = 2;
/**********************/

/* HTML */
var HTML_STATUS;
var HTML_USER;
var HTML_HISTORY;
var HTML_TOGGLE_BUTTON;
var HTML_SEND_TRACK_BUTTON;
/********/

/***/
var APP_loggedIn;
var APP_username;
var APP_hash;
var APP_registred;
/***/

// userid
var user;
// socket
var socket;
var firstTime = true;

// status for the app
var status;

// number of attempts to reconnect
var reconnectAttempts;
var reconnectTimer;

exports.init = init;

function init() {
	// Set app variables
	APP_loggedIn = false;
	/****************/

	$('#username').val(APP_username);

	APP_hash = sp.core.getAnonymousUserId();

	setupButtons();

	player.observe(models.EVENT.CHANGE, playerChanged);

	logApp('Initialized');

	startApp();
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

// bind buttons to events
function setupButtons() {
	// Toggle button
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
		default:
			log('Tried to use permission ' + type);
			return false;
			break;
	}
}

function gotCommand(command) {
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
			default:
				logCommand("Unknown command");
				break;
			}
		}
	}
}

function clientConnected(clientid) {
	logApp('client connected');
	sendPlayerUpdate(clientid);
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
	status = STATUS_STOPPED;
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
	status = STATUS_LOGGED_IN;

	socket.emit('register', APP_hash);

	updateStatus('Logged in', 'good');
}

function forcePlayerUpdate(clientid) {
	sendPlayerUpdate(clientid);
}

function registred() {
	APP_registred = true;
}

function connect() {
	socket = io.connect(BACKEND_HOST + '/spotify', {secure: true});	

	if (firstTime) {
		socket.on('connect', connectionEstablished);
		socket.on('gotCommand', gotCommand);
		socket.on('disconnect', disconnected);
		socket.on('wrong password', wrongPassword);
		socket.on('authenticated', authenticated);
		socket.on('registred', registred);
		socket.on('clientConnected', clientConnected);

		firstTime = false;
	}
}

function getPlayerObject() {
	return playerObj = {
		'track': player.track,
		'repeat': player.repeat,
		'shuffle': player.shuffle,
		'volume': player.volume,
		'playing': player.playing
	};
}

/* Logging */

function nowStr() {
	var datePad = function (i) {
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

/************/