/**
By Gyran!
**/

/* Spotify variables */
var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var player = models.player;
/*********************/

/* Remote variables */
var BACKEND_HOST = 'http://gyran.se:9004';
/********************/

/* 'Static' variables */
var STATUS_STOPPED = 0;
var STATUS_LISTENING = 1;
var STATUS_OFFLINE = 2;
/**********************/

/* HTML */
var HTML_STATUS;
var HTML_USER;
var HTML_HISTORY;
var HTML_TOGGLE_BUTTON;
var HTML_SEND_TRACK_BUTTON;
/********/

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
	/* setup html elements */
	HTML_USER = $('#user');
	HTML_STATUS = $('#status');
	HTML_HISTORY = $('#history');
	HTML_TOGGLE_BUTTON = $('#btnToggle');
	HTML_SEND_TRACK_BUTTON = $('#btnSendTrack');

	status = STATUS_STOPPED;

	updateStatus();

	user = sp.core.getAnonymousUserId();

	HTML_USER.text('Userkey: ' + user);
	$('#userinput').val(user);


	setupButtons();

	player.observe(models.EVENT.CHANGE, playerChanged);

	logApp('Initialized');

	startApp();
}

function playerChanged(event) {
	sendPlayerUpdate();
}

// bind buttons to events
function setupButtons() {
	// Toggle button
	HTML_TOGGLE_BUTTON.click(toggleRemote);
	HTML_SEND_TRACK_BUTTON.click(null);
	
}

function stopApp() {
	socket.disconnect();
}

function startApp() {
	logApp('Starting');
	connect();
}

function toggleRemote() {
	if (status == STATUS_OFFLINE) {
		return;
	} else if (status == STATUS_LISTENING) {
		stopApp();
	} else if (status == STATUS_STOPPED) {
		startApp();
	}

}

function updateStatus() {
	switch (status) {
	case STATUS_STOPPED:
		HTML_STATUS.text('Not listening');
		HTML_STATUS.removeClass('bad good').addClass('bad');
		HTML_TOGGLE_BUTTON.text('Start');
		break;
	case STATUS_LISTENING:
		HTML_STATUS.text('Listening');
		HTML_STATUS.removeClass('bad good').addClass('good');
		HTML_TOGGLE_BUTTON.text('Stop');
		break;
	case STATUS_OFFLINE:
		HTML_STATUS.text('Service offline');
		HTML_STATUS.removeClass('bad good').addClass('bad');
		HTML_TOGGLE_BUTTON.text('Retry');
		break;
	default:
		HTML_STATUS.text('Unknown status');
		HTML_STATUS.removeClass('bad good').addClass('bad');
		break;
	}
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

function clientConnected() {
	logApp('client connected');
	sendPlayerUpdate();
}

function connectionEstablished() {
	status = STATUS_LISTENING;
	updateStatus();
	logApp("Socket connected");
}

function disconnected() {
	logApp('Socket disconnected');
	status = STATUS_STOPPED;
	updateStatus();
}

function connect() {
	socket = io.connect(BACKEND_HOST + '/spotify');	

	if (firstTime) {
		socket.on('ready', connectionEstablished);
		socket.on('gotCommand', gotCommand);
		socket.on('clientConnected', clientConnected);
		socket.on('disconnect', disconnected);
		firstTime = false;
	}

	socket.emit('register', { user: user });
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
	HTML_HISTORY.prepend(nowStr() + ' - ' + l + '<br>');
}

function logCommand(command) {
	log('Command: ' + command);
}

function logApp(message) {
	log('Application: ' + message);
}

/***********/

/* Send updates */

function sendPlayerUpdate() {
	socket.emit('playerUpdated', getPlayerObject());
}

/****************/

/* Commands */

function cmdPlaypause() {
	if (!player.canPlayPause) {
		console.log('cnat playpause');
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