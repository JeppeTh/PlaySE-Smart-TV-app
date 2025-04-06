var MAX_WIDTH   = 1920;
var MAX_HEIGHT  = 1080;
var LINE_LENGTH = 45;
var THUMB_WIDTH = 480;
var THUMB_HEIGHT = 270;
var DETAILS_THUMB_FACTOR = 1200/THUMB_WIDTH;
var BACKGROUND_THUMB_FACTOR = MAX_WIDTH/THUMB_WIDTH;
var HIGHLIGHT_THUMB_WIDTH = 250;
var PREVIEW_THUMB_WIDTH = 444;
var PREVIEW_THUMB_HEIGHT = 250;
var recommendedLinks = [];
var isEmulator = false;
var isTizenEmulator = false;
var deviceYear  = null;
var Main = {
    loaded         : false,
    clockTimer     : null
};

Main.onLoad = function(refresh) {
    var Callback = function() {Main.onLoad(refresh);};
    if (!Preview.init(Callback) || !Config.init(Callback))
        // Need to wait
        return;

    Channel.init();
    Language.fixAButton();
    if (!refresh) {
        document.title = Channel.getMainTitle();
	Header.display(document.title);
    }
    if (!this.loaded) {
        this.loaded = true;
        $('#page-cover').hide();
        var model = webapis.productinfo.getRealModel();
        isTizenEmulator = (webapis.productinfo.getModel()=='TIZEN_SIM');
        isEmulator = (model === 'VALENCIA' || model === 'SDK' || !model);
        deviceYear = getDeviceYear();
        if (deviceYear > 2011)
            LINE_LENGTH = 36;
        Log('Model:' + model +  ' DeviceYear:' + deviceYear + ' IsEmulator:' + isEmulator + ' application:' + tizen.application.getCurrentApplication().appInfo.name + ' Cookies:' + document.cookie + ' version:' + webapis.productinfo.getSmartTVServerVersion() + ' firmware:' + webapis.productinfo.getFirmware() + ' tizen version:' + tizen.systeminfo.getCapabilities().platformVersion);
        loadingStart();
        Main.setClock();
        checkDateFormat();
        Footer.display();
        VideoJsPlayer.init();
	Search.init();
	Language.init();
	ConnectionError.init();
	Language.setLang();
	Resolution.displayRes();
        Player.enableScreenSaver();
        setOffsets();
        fixCss();
        Preview.checkLink(function() {Main.loadXml(refresh);});
	// Enable key event processing
	Buttons.enableKeys();
    } else if (!detailsOnTop) {
	this.loadXml(refresh);
    }
};

Main.onUnload = function() {
	Player.remove();
};

Main.setClock = function() {
    window.clearTimeout(Main.clockTimer);
    Main.clockTimer = setClock($('#footer-clock'), Main.setClock);
};

Main.loadXml = function(refresh){
    $('#content-scroll').hide();
    Channel.login(
        function() {
            var url = Channel.getUrl('main', {refresh:refresh});
            var postData = Channel.getPostData('main', {refresh:refresh});
            var cbComplete = function(status){loadFinished(status, refresh);};
            requestUrl(url,
                       function(status, data) {
                           Channel.decodeMain(data,
                                              {url:url,
                                               requestedLocation:data.requestedLocation,
                                               refresh:refresh,
                                               cbComplete:function(){cbComplete(status);}
                                              });
                           data = null;
                       },
                       {cbError:function(status){cbComplete(status);},
                        headers:Channel.getHeaders(),
                        postData:postData
                       });
        }
    );
};

