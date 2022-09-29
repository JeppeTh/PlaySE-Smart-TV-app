var Preview  = {
    isInitiated : false,
    isUpdating : false,
    aborted : false,
    bgService : tizen.application.getCurrentApplication().appInfo.id.replace(/\..+$/,'.service')
};

Preview.init = function(Callback) {
    if (Preview.isInitiated)
        return true;

    Preview.isInitiated = true;
    Preview.launchService(
        function() {
            window.addEventListener('appcontrol', Preview.checkLink);
            Callback && Callback();
        },
        Callback
    );
};

Preview.launchService = function(SuccessCallback, ErrorCallback) {
    tizen.application.launchAppControl(
    	new tizen.ApplicationControl(
            'http://tizen.org/appcontrol/operation/pick',
            null,
            'imag/jpeg',
            null,
            [new tizen.ApplicationControlData('caller',['ForegroundApp'])]
        ),
        Preview.bgService,
    	function () {
    	    //success callback
            SuccessCallback && SuccessCallback();
    	},
    	function (e) {
    	    Log('BgService ' + Preview.bgService  + ' launch failed: ' + e.message);
            ErrorCallback && ErrorCallback();
    	}
    );
};

Preview.checkLink = function(Callback) {
    var requestedAppControl = tizen.application.getCurrentApplication().getRequestedAppControl();
    var appControlData;
    var actionData;

    if (requestedAppControl) {
        appControlData = requestedAppControl.appControl.data;
        // Log('Preview.checkLink, appControlData : ' + JSON.stringify(appControlData));
        for (var i = 0; i < appControlData.length; i++) {
            if (appControlData[i].key == 'PAYLOAD') {
                if ($('.screensaver').is(':visible') || Player.state > Player.STOPPED) {
                    // App is running - keep it simple and ignore
                    return;
                }
                actionData = JSON.parse(appControlData[i].value[0]).values;
                actionData = parseInt(actionData);
                window.setTimeout(function() {
                    Buttons.changeChannel(History, {index:actionData});
                }, 0);
                return;
            }
        }
    }
    Preview.update();
    Callback && Callback();
};

Preview.update = function() {
    if (Preview.isUpdating) {
        Preview.aborted = true;
        return;
    }

    data = History.getPreviewData();
    var json = '';
    if (data && data.length > 0) {
        json = [];
        for (var i in data) {
            json.push({'title'       : data[i].title,
                       'image_ratio' : '16by9',
                       'image_url'   : data[i].thumb,
	               'action_data' : i,
                       'is_playable' : data[i].is_movie,
                       'position'    : i
                      });
        }
        json = JSON.stringify({'sections':[{'tiles':json}]});
    }
    Preview.isUpdating = true;
    // Log('Updating: ' + json);
    Finish = function(Failed) {
        Preview.isUpdating = false;
        if (Failed) {
            Preview.retry();
        } else if (Preview.aborted) {
            window.setTimeout(Preview.update, 0);
        }
        Preview.aborted = false;
    };
    try {
        Preview.launchService(
            function() {
                var failed = false;
                try {
                    var remotePort = tizen.messageport.requestRemoteMessagePort(Preview.bgService,
                                                                                'PLAYSE_SERVICE_PORT'
                                                                               );
                    remotePort.sendMessage([{key:'METADATA', value: json}]);
                } catch(e) {
                    failed = true;
                    Log('Preview.update send failed: ' + e);
                }
                Finish(failed);
            },
            function() {
                Log('Preview.update launch failed');
                Finish(true);
            }
        );
    } catch (e) {
        Log('Preview.update error towards: ' + Preview.bgService + ' ' + e);
        Finish(true);
    }
};

Preview.retry = function() {
    Log('Preview will retry');
    Preview.isUpdating = true;
    window.setTimeout(function() {
        Preview.isUpdating = false;
        Preview.aborted = false;
        Preview.update();
    }, 5*1000);
};
