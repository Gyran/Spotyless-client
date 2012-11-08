/* Spotify variables */
var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var player = models.player;
/*********************/

/* 'Static' variables */
var STATUS_STOPPED = 0;
var STATUS_LISTENING = 1;
var STATUS_OFFLINE = 2;
/**********************/

/* HTML */
var HTML_STATUS;
var HTML_USER;
var HTML_COMMAND_HISTORY;
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
	HTML_USER = document.getElementById('user');
	HTML_STATUS = document.getElementById('status');
	HTML_HISTORY = document.getElementById('history');
	HTML_TOGGLE_BUTTON = document.getElementById('btnToggle');
	HTML_SEND_TRACK_BUTTON = document.getElementById('btnSendTrack');

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
	HTML_TOGGLE_BUTTON.addEventListener('click', toggleRemote);
	HTML_SEND_TRACK_BUTTON.addEventListener('click', sendCurrentTrack);
	
}

function stopApp() {
	logApp('Stopped');
	status = STATUS_STOPPED;
	updateStatus();
	req.abort();
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
			HTML_STATUS.innerText = 'Not listening';
			HTML_TOGGLE_BUTTON.innerText = 'Start';
			break;
		case STATUS_LISTENING:
			HTML_STATUS.innerText = 'Listening';
			HTML_TOGGLE_BUTTON.innerText = 'Stop';
			break;
		case STATUS_OFFLINE:
			HTML_STATUS.innerText = 'Service offline';
			HTML_TOGGLE_BUTTON.innerText = 'Retry';
			break;
		default:
			HTML_STATUS.innerText = 'Unknown status';
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
	if (req) {
		req.abort();
	}	
	var lastIndex = 0;
	req = new XMLHttpRequest();
	req.timeout = 10;

	console.log("Waiting for command!");

	req.open('GET', 'http://192.168.1.101:1337/addSpotify?user=' + user, true);

	req.onreadystatechange = function() {
		console.log(req);
   		if (req.status == 200 && req.readyState == 4) {
   			
   			//var command = req.responseText.substr(lastIndex);
   			//lastIndex = req.responseText.length;
   			var command = req.responseText;
   			parseCommand(command);

   			waitForCommand();
   		}
  	};

  	req.onload = function() {
  		waitForCommand();
  	}

  	req.onerror = function() {
  		++reconnectAttempts;
  		if (reconnectTimer == -1) {
  			reconnectTimer = setTimeout(function() { serverDown(); }, 300);
  		}
  		waitForCommand();
  	};
/*
  	req.oncomplete = function() {
  		console.log('oncomplete');
  	}

  	req.onerror = function() {
  		console.log("onerror");
  		stopApp();
  	}
*/
	req.send();
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
	HTML_HISTORY.innerText = nowStr() + ' - ' + l + '\n' + HTML_HISTORY.innerText;
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
	var req = new XMLHttpRequest();

	req.open('GET', 'http://192.168.1.101:1337/sendClientUpdate?user=' + user 
		+ '&update=currentTrack&value=' +  player.track
		, true);

	req.send();

	console.log("sent track");
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