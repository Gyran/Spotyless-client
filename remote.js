/* Spotify variables */
var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var player = models.player;
/*********************/

/* Remote variables */
BACKEND_HOST = 'http://192.168.1.101:1337';
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
// the request that is waiting for the command
var req;

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

	HTML_USER.innerText = 'Userkey: ' + user;


	setupButtons();


	logApp('Initialized');

	startApp();
}

// bind buttons to events
function setupButtons() {
	// Toggle button
	HTML_TOGGLE_BUTTON.click(toggleRemote);
	HTML_SEND_TRACK_BUTTON.click(sendCurrentTrack);
	
}

function stopApp() {
	logApp('Stopped');
	status = STATUS_STOPPED;
	updateStatus();
}

function startApp() {
	logApp('Started');
	status = STATUS_LISTENING;
	resetReconnect()
	waitForCommand();
	updateStatus();
}

function resetReconnect() {
	reconnectTimer = -1;
	reconnectAttempts = 0;
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
			HTML_TOGGLE_BUTTON.text('Start');
			break;
		case STATUS_LISTENING:
			HTML_STATUS.text('Listening');
			HTML_TOGGLE_BUTTON.text('Stop');
			break;
		case STATUS_OFFLINE:
			HTML_STATUS.text('Service offline');
			HTML_TOGGLE_BUTTON.text('Retry');
			break;
		default:
			HTML_STATUS.text('Unknown status');
			break;
	}
}

function parseCommand(command) {
	console.log("Getting command", command);

	switch (command) {
		case 'playpause':
			playpause();
			break;
		case 'next':
			nextTrack();
			break;
		case 'previous':
			previousTrack();
			break;

		default:
			logCommand("Unknown command");
			break;
	}
}

function serverDown() {
	if (reconnectAttempts > 3) {
		console.log("Server probably down!", reconnectAttempts);
		stopApp();
	} else {
		console.log("Reconnected!");
		resetReconnect();
	}
}

function waitForCommand() {
	if (status != STATUS_LISTENING) {
		return;
	}

	console.log(BACKEND_HOST + '/addSpotify');

	$.post(BACKEND_HOST + '/addSpotify',
			{
				user: user
			},
			function(data) {
				console.log("success", data);
				parseCommand(data);
				waitForCommand();
			}
		)
		.error(function(jqXHR, textStatus) {
			++reconnectAttempts;
  			if (reconnectTimer == -1) {
  				reconnectTimer = setTimeout(function() { serverDown(); }, 300);
  			}
  			waitForCommand();
		});
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
	console.log('Log', l);
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

function sendCurrentTrack() {
	console.log(player.track);
	sendUpdate('currentTrack', {track: player.track.name});

}

function sendUpdate(type, data) {
	var sendData = { type: type, data: data};
	$.post(BACKEND_HOST + '/sendClientUpdate',
		sendData,
		function() {
			console.log('Sent data', sendData);
		}
	);
}

/****************/

/* Commands */

function playpause() {
	player.playing = !(player.playing);
	if (player.playing) {
		logCommand('Play');
	} else {
		logCommand('Pause');
	}
}

function nextTrack() {
	player.next();
	logCommand('Next track');
}

function previousTrack() {
	player.previous();
	logCommand('Previous track');
}

/************/