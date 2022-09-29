var http = require('http');
var seqNo = 0;
var messagePortName = 'PLAYSE_SERVICE_PORT';
var localPort = '';

//Mandatory Callbacks for Service application
//onStart Callback
module.exports.onStart = function() {
    Log('onStart');
    try {
        initMessagePort();
    } catch (e) {
        Log('initMessagePort failed: ' + e);
    }
};

//onRequest Callback
module.exports.onRequest = function() {
    // Log('onRequest');
};

//onExit Callback
module.exports.onExit = function() {
    Log('onExit');
};

function setPreviewData(previewData) {
    Log('setPreviewData');
    webapis.preview.setPreviewData(
        JSON.stringify(previewData),
	function(){
	    // please terminate service after setting preview data
	    tizen.application.getCurrentApplication().exit();
	},
	function(e) {
	    Log('setPreviewData failed : ' + e.message);
	}
    );
}

// receive data from foreground application
function initMessagePort() {
    function onReceived(data, remotePort) {
	// Log('onReceived : ' + JSON.stringify(data) + ' remotePort : ' + remotePort);
	data.forEach(function(item) {
	    if (item.key == 'METADATA') {
                setPreviewData(JSON.parse(item.value));
	    }
	});
    }
    localPort = tizen.messageport.requestLocalMessagePort(messagePortName);
    localPort.addMessagePortListener(onReceived);
}

function httpRequest(url) {
    var req = http.request(url);
    req.end();
}

function Log(msg) {
    // httpRequest('http://<LOGSERVER>/log?msg=\'[' + tizen.application.getCurrentApplication().appInfo.name + '] ' + seqNo++ % 10 + ' : ' + msg + '\'');
    console.log(msg);
}
