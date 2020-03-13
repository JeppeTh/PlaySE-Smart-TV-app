var AvPlayer = {
    player: null,
    listener:  {
        onbufferingstart: function() {
            Player.OnBufferingStart();
        },

        onbufferingprogress: function(percent) {
            Player.OnBufferingProgress(percent);
        },

        onbufferingcomplete: function() {
            Player.OnBufferingComplete();
            try {
            Log('CURRENT_BANDWIDTH:' + webapis.avplay.getStreamingProperty('CURRENT_BANDWIDTH'));
            Log('IS_LIVE:' + webapis.avplay.getStreamingProperty('IS_LIVE'));
            Log('GET_LIVE_DURATION:' + webapis.avplay.getStreamingProperty('GET_LIVE_DURATION'));
            Log('WIDEVINE:' + webapis.avplay.getStreamingProperty('WIDEVINE'));
            } catch (err) {
                Log('getstreamingproperty error:' + err);
            }

        },
        onstreamcompleted: function() {
            Player.OnRenderingComplete();
        },

        oncurrentplaytime: function(currentTime) {
            Player.SetCurTime(currentTime);
        },

        onerror: function(eventType) {
            // Log('onerror:' + eventType.initEvent());
            // Log('onerror:' + JSON.stringify(eventType, ['message', 'arguments', 'type', 'name']));
            // for (var k in eventType) {
            //     alert(k + ':' + eventType[k])
            // }
            Player.OnRenderError(eventType);
        },

        onevent: function(eventType, eventData) {
            try{
                Log('onevent:' + eventType);
                switch (eventType) {
                case 'PLAYER_MSG_RESOLUTION_CHANGED':
                case 'PLAYER_MSG_BITRATE_CHANGE':
                    Player.OnStreamInfoReady(true);
                    break;
                default:
                    break;
                }
            } catch(err) {
                Log('onevent error:' + err + ' for:' + eventType);
            }
        },

        onsubtitlechange: function(duration, text, data3, data4) {
            if (subtitles.length > 0)
                return;
            text = text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace('<br/></br>','<br/>');
            Subtitles.set(text.replace(/< *\/br>/g, '<br />').replace(/<br ?\/>$/, ''));
        },
        ondrmevent: function(drmEvent, drmData) {
            Log('DRM callback: ' + drmEvent + ', data: ' + drmData);
            if (drmData.name == 'Challenge') {
                var i = {ResponseMessage: drmData.message};
                webapis.avplay.setDrm('PLAYREADY', 'InstallLicense', JSON.stringify(i));
            }
            // Player.OnDrmEvent(drmEvent, drmData);

        },
        onchanged: function (resolution, type) {
            Log('Videoresolution onchanged:' + type);
            Log('Videoresolution onchanged:' + JSON.stringify(resolution));
        }
    },
    aspectMode: 0,
    ASPECT_AUTO : 0,
    ASPECT_FULL : 1,
    ASPECT_LETTER : 2,
    aspects : ['PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO',
               'PLAYER_DISPLAY_MODE_FULL_SCREEN',
               'PLAYER_DISPLAY_MODE_LETTER_BOX'
              ]
};

AvPlayer.create = function() {
    if (this.player)
        return;

    this.player = document.createElement('object');
    this.player.type = 'application/avplayer';
    this.player.style.left = '0px';
    this.player.style.top = '0px';
    this.player.style.width = MAX_WIDTH + 'px';
    this.player.style.height = MAX_HEIGHT + 'px';
    document.getElementById('video-container').appendChild(this.player);

    if (tizen.tvwindow)
        tizen.tvwindow.addVideoResolutionChangeListener(AvPlayer.listener.onchanged);
};

AvPlayer.remove = function() {
    webapis.avplay.stop();
    // webapis.avplay.close();
    // // alert('body:' + $('body').html());
    // if (AvPlayer.player) {
    //     // alert(AvPlayer.player.type);
    //     var videoContainer = document.getElementById('video-container');
    //     videoContainer.removeChild(videoContainer.childNodes[0]);
    //     // document.getElementById('video-container').removeChild(AvPlayer.player);
    //     delete AvPlayer.player;
    //     AvPlayer.player = null;
    //     // alert('body:' + $('body').html());
    // }
};

AvPlayer.load = function(videoData) {
    webapis.avplay.open(videoData.url);
    webapis.avplay.setListener(AvPlayer.listener);
    webapis.avplay.setDisplayRect(0, 0, MAX_WIDTH,MAX_HEIGHT);

    Log('set PREBUFFER_MODE result: ' + webapis.avplay.setStreamingProperty('PREBUFFER_MODE ', 0));

    var headers = Channel.getHeaders() || [];
    for (var i=0; i < headers.length; i++) {
        if (headers[i].key.match(/user-agent/i)) {
            Log('set USER_AGENT: ' + headers[i].value + ' result: ' + webapis.avplay.setStreamingProperty('USER_AGENT', headers[i].value));
            break;
        }
    }
    if (videoData.license)
        Log('setDrm result:' + webapis.avplay.setDrm('PLAYREADY', 'SetProperties', JSON.stringify({'DeleteLicenseAfterUse':true, 'LicenseServer':videoData.license, 'CustomData':videoData.custom_data})));
    if (videoData.bitrates && videoData.bitrates != '')
        Log('set ADAPTIVE_INFO: ' + videoData.bitrates + ' result: ' + webapis.avplay.setStreamingProperty('ADAPTIVE_INFO', videoData.bitrates));
};

AvPlayer.play = function(isLive, seconds) {
    if (seconds)
        AvPlayer.skip(seconds*1000);
    webapis.avplay.prepareAsync(webapis.avplay.play,Player.OnConnectionFailed);
};

AvPlayer.resume = function() {
    webapis.avplay.play();
};

AvPlayer.pause = function() {
    webapis.avplay.pause();
};

AvPlayer.skip = function(milliSeconds) {
    webapis.avplay.seekTo(milliSeconds, null, Player.OnRenderError);
};

AvPlayer.stop = function() {
    AvPlayer.remove();
};

AvPlayer.reload = function(videoData, isLive, seconds) {
    AvPlayer.load(videoData);
    AvPlayer.play(isLive, seconds);
};

AvPlayer.getResolution  = function() {
    var streamInfo = AvPlayer.GetCurrentVideoStreamInfo();
    return {width:+streamInfo.Width, height:+streamInfo.Height};
};

AvPlayer.getDuration  = function() {
    var duration = webapis.avplay.getDuration();
    return isNaN(duration) ? 0 : duration;
};

AvPlayer.getBandwith  = function() {
    var videoBw = webapis.avplay.getStreamingProperty('CURRENT_BANDWIDTH');
    if (!videoBw)
        videoBw = +AvPlayer.GetCurrentVideoStreamInfo().Bit_rate;
    return videoBw;
};

AvPlayer.toggleAspectRatio = function() {
    this.aspectMode  = (this.aspectMode+1) % (AvPlayer.ASPECT_LETTER+1);
};

AvPlayer.setAspectRatio = function(resolution) {
    webapis.avplay.setDisplayMethod(AvPlayer.aspects[this.aspectMode]);
};

AvPlayer.getAspectModeText = function() {
    switch (this.aspectMode) {
        case AvPlayer.ASPECT_AUTO:
        return '';

        case AvPlayer.ASPECT_FULL:
        return 'FULL';

        case AvPlayer.ASPECT_LETTER:
        return 'LETTER';
    }
};

AvPlayer.GetCurrentVideoStreamInfo = function() {
    var streamInfo = webapis.avplay.getCurrentStreamInfo();
    for (var i=0; i < streamInfo.length; i++)
        if (streamInfo[i].type == 'VIDEO') {
            // Log('VideoStreamInfo: ' + streamInfo[i].extra_info);
            return JSON.parse(streamInfo[i].extra_info);
        }
    Log('GetCurrentVideoStreamInfo failed: ' + JSON.stringify(streamInfo));
    return {};
};
