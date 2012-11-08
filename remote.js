/* Spotify variables */
var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var player = models.player;
/*********************/

/* Remote variables */
BACKEND_HOST = 'http://gyran.se:9003';
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

	HTML_USER.text('Userkey: ' + user);
	$('#userinput').val(user);


	setupButtons();

	player.observe(models.EVENT.CHANGE, playerChanged);

	logApp('Initialized');

	startApp();
}

function playerChanged(event) {
	console.log(event);
	if (event.data.curtrack) {
		sendCurrentTrack();
	}
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

function parseCommand(command) {
	console.log("Getting command", command);

	if (hasPermission(command.type)) {
		if (command.type == 'player') {
			switch (command.action) {
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
			},
			'json'
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
	sendUpdate('currentTrack', {track: player.track});

}

function sendUpdate(type, data) {
	$.post(BACKEND_HOST + '/sendClientUpdate',
		{ user: user, type: type, data: JSON.stringify(data) },
		function(res) {
			console.log('Sent data', data);
			console.log('response', res);
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