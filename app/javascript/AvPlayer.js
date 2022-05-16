var AvPlayer = {
    player: null,
    listener:  {
        onbufferingstart: function() {
            if (AvPlayer.delayed_skip) return;
            Player.OnBufferingStart();
        },

        onbufferingprogress: function(percent) {
            if (AvPlayer.delayed_skip) return;
            Player.OnBufferingProgress(percent);
        },

        onbufferingcomplete: function() {
            AvPlayer.stream_ensured = true;
            if (AvPlayer.delayed_skip !== null)
                return;
            Player.OnBufferingComplete();
            // Pause during skip doesn't work.
            AvPlayer.pause_failed = AvPlayer.isPauseOutOfSync();
            try {
            Player.OnBufferingComplete();
            if (webapis.avplay.getState() != 'IDLE') {
                Log('setSilentSubtitle(' + (subtitles.length > 0) + '): ' +
                    webapis.avplay.setSilentSubtitle(subtitles.length > 0));
            }
            Log('CURRENT_BANDWIDTH:' + AvPlayer.getStreamingProperty('CURRENT_BANDWIDTH'));
            Log('IS_LIVE:' + AvPlayer.getStreamingProperty('IS_LIVE'));
            Log('GET_LIVE_DURATION:' + AvPlayer.getStreamingProperty('GET_LIVE_DURATION'));
            Log('Tracks:' + JSON.stringify(webapis.avplay.getTotalTrackInfo()));
            Log('WIDEVINE:' + AvPlayer.getStreamingProperty('WIDEVINE'));
            } catch (err) {
                Log('onbufferingcomplete error:' + err);
            }

        },
        onstreamcompleted: function() {
            Player.OnRenderingComplete();
        },

        oncurrentplaytime: function(currentTime) {
            // Skip delayed events after reload.
            if (!AvPlayer.stream_ensured && AvPlayer.delayed_skip !== null) return;
            if (AvPlayer.time_offset === null) {
                if (videoData.use_offset)
                    AvPlayer.time_offset = currentTime;
                else
                    AvPlayer.time_offset = 0;
                Log('AvPlayer initial time: ' + currentTime + ' use_offset: ' + videoData.use_offset + ' time_offset:' + AvPlayer.time_offset);
            }
            Player.SetCurTime(currentTime-AvPlayer.time_offset);
            if (AvPlayer.delayed_skip) {
                AvPlayer.pause();
                AvPlayer.skip(AvPlayer.delayed_skip, webapis.avplay.play);
                AvPlayer.delayed_skip = 0;
                AvPlayer.stream_ensured = false;
                return;
            } else if (AvPlayer.delayed_skip === 0) {
                $('.video-background').hide();
                AvPlayer.delayed_skip = null
            };
            if (AvPlayer.pause_failed) {
                if (AvPlayer.isPauseOutOfSync())
                    AvPlayer.pause();
                else
                    AvPlayer.pause_failed = false
            }
        },

        onerror: function(eventType) {
            // Log('onerror:' + eventType.initEvent());
            // Log('onerror:' + JSON.stringify(eventType, ['message', 'arguments', 'type', 'name']));
            // for (var k in eventType) {
            //     alert(k + ':' + eventType[k])
            // }
            // Later models get error when pausing too long, ignore and reload.
            if (webapis.avplay.getState() == 'PAUSED')
                AvPlayer.error_during_pause = true;
            else
                Player.OnRenderError(eventType);
        },

        onevent: function(eventType, eventData) {
            try{
                switch (eventType) {
                case 'UNKNOWN_OTHER_EVENT_FROM_PLAYER':
                case 'PLAYER_MSG_NONE':
                    if (videoData.drm && videoData.drm.session_id)
                        break;
                case 'PLAYER_MSG_RESOLUTION_CHANGED':
                case 'PLAYER_MSG_BITRATE_CHANGE':
                    if (AvPlayer.delayed_skip === null)
                        Player.OnStreamInfoReady(true);
                    break;
                default:
                    Log('onevent:' + eventType);
                    break;
                }
            } catch(err) {
                Log('onevent error:' + err + ' for:' + eventType);
            }
        },

        onsubtitlechange: function(duration, text, type, attributes) {
            // Log('onsubtitlechange, duration: ' + duration + ' text:' + text + ' type: ' + type + ' attr:' + JSON.stringify(attributes));
            duration = +duration;
            if (subtitles.length > 0 || duration === 0)
                return;
            text = text.replace(/(<br *\/ *>)* *WEBVTT.*/g,'');
            text = text.replace(/align:.*(position|size|line):.*/g,'');
            text = text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<br ?(\/><\/br)?>/,'<br/>');
            text = text.replace(/< *\/br>/g, '<br/>').replace(/(<br( ?)*\/>)+/,'<br/>').replace(/<br ?\/>$/, '');
            Subtitles.set(text, duration+100);
        },
        ondrmevent: function(drmEvent, drmData) {
            Log('DRM callback: ' + drmEvent + ', data: ' + (drmData && drmData.name));
            if (drmData.name == 'Challenge') {
                installWidevineLicense(drmData);
            } else if (drmData.name == 'DrmError') {
                Log(JSON.stringify(drmData));
            }
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
              ],
    time_offset : 0,
    stream_ensured : false,
    delayed_skip : null,
    load_error : null,
    error_during_pause: false,
    pause_failed: null
};

function base64ToArrayBuffer(Base64) {
    var binaryString = atob(Base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function arrayBufferToBase64( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return btoa(binary);
}

function installWidevineLicense(drmData) {
    try {
        httpRequest(videoData.drm.license,
                    {cb:function(status,data,xhr) {
                        if (isHttpStatusOk(status)) {
                            var licenseParam =
                                drmData.session_id +
                                'PARAM_START_POSITION' +
                                arrayBufferToBase64(data) +
                                'PARAM_START_POSITION';
                            Log('setDrm widevine_license_data result:' + webapis.avplay.setDrm('WIDEVINE_CDM', 'widevine_license_data', licenseParam));
                        }
                    },
                     params: base64ToArrayBuffer(drmData.challenge),
                     responseType:'arraybuffer',
                     headers:[{key:'x-dt-auth-token', value:videoData.drm.customData},
                              {key:'Content-Type', value:'application/octet-stream'}
                             ]
                    }
                   )
    } catch (error) {
        Log('installWidevineLicense: ' + error);
    }
}

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
    try {
        if (this.player && webapis)
            webapis.avplay.stop();
    } catch (e) {
        Log('AvPlayer.remove:' + e);
    }
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
    try {
        AvPlayer.time_offset = null;
        AvPlayer.stream_ensured = false;
        AvPlayer.delayed_skip = null;
        AvPlayer.load_error = null;
        AvPlayer.error_during_pause = false;
        webapis.avplay.open(videoData.url);
        webapis.avplay.setDisplayRect(0, 0, MAX_WIDTH, MAX_HEIGHT);
        webapis.avplay.setListener(AvPlayer.listener);

        // Log('set PREBUFFER_MODE result: ' + webapis.avplay.setStreamingProperty('PREBUFFER_MODE ', 0));
        var headers = Channel.getHeaders() || [];
        for (var i=0; i < headers.length; i++) {
            if (headers[i].key.match(/user-agent/i)) {
                Log('set USER_AGENT: ' + headers[i].value + ' result: ' + webapis.avplay.setStreamingProperty('USER_AGENT', headers[i].value));
                break;
            }
        }
        AvPlayer.loadDrm();
        if (videoData.bitrates && videoData.bitrates != '')
            Log('set ADAPTIVE_INFO: ' + videoData.bitrates + ' result: ' + webapis.avplay.setStreamingProperty('ADAPTIVE_INFO', videoData.bitrates));
    } catch(err) {
        if (err.name) err = err.name;
        Log('Load error:' + err);
        AvPlayer.load_error = '' + err;
        AvPlayer.stop();
    }
};

AvPlayer.loadDrm = function() {
    if (videoData.drm) {
        if (videoData.drm.sessionId) {
            if (tizenVersion >= 55) {
                var drm = {'DataType':'MPEG-DASH',
                           'AppSession':videoData.drm.sessionId
                          };
                Log('setDrm DataType result:' + webapis.avplay.setDrm('WIDEVINE_CDM', 'SetProperties', JSON.stringify(drm)));
            } else {
                Log('setDrm Initialize result:' + webapis.avplay.setDrm('WIDEVINE_CDM', 'Initialize', ''));
                Log('setDrm widevine_app_session result:' + webapis.avplay.setDrm('WIDEVINE_CDM', 'widevine_app_session', videoData.drm.sessionId));
                Log('setDrm widevine_data_type result:' + webapis.avplay.setDrm('WIDEVINE_CDM', 'widevine_data_type', 'MPEG-DASH'));
            }
        } else {
            var drm = {'DeleteLicenseAfterUse':true,
                       'LicenseServer':videoData.drm.license,
                       'CustomData':videoData.drm.customData
                      };
            Log('setDrm Properties result:' + webapis.avplay.setDrm('PLAYREADY', 'SetProperties', JSON.stringify(drm)) + ' ' + videoData.drm.license);
        }
    }
};

AvPlayer.play = function(isLive, seconds) {
    if (AvPlayer.load_error) {
        window.setTimeout(function(){Player.PlaybackFailed(AvPlayer.load_error);},0);
    } else {
        if (seconds && seconds > 0) {
            if (isLive) {
                $('.video-background').show();
                AvPlayer.delayed_skip = seconds*1000;
            } else
                AvPlayer.skip(seconds*1000);
        }
        webapis.avplay.prepareAsync(webapis.avplay.play, Player.OnConnectionFailed);
    }
};

AvPlayer.resume = function() {
    if (AvPlayer.error_during_pause)
        Player.reloadVideo();
    else
        webapis.avplay.play();
};

AvPlayer.pause = function() {
    webapis.avplay.pause();
};

AvPlayer.isPauseOutOfSync = function() {
    return (Player.state==Player.PAUSED && webapis.avplay.getState()=='PLAYING');
};

AvPlayer.skip = function(milliSeconds, successCb) {
    var isLive = AvPlayer.isLive();
    milliSeconds = milliSeconds - Player.offset + AvPlayer.time_offset;
    if (isLive) {
        var liveWindow = AvPlayer.getStreamingProperty('GET_LIVE_DURATION').split('|');
        if (milliSeconds > +liveWindow[1]) {
            milliSeconds = +liveWindow[1] - 1000;
        }
        // Ignore startTime in case it seems invalid
        if (milliSeconds < +liveWindow[0] && +liveWindow[0] < +liveWindow[1]) {
            milliSeconds = +liveWindow[0]+100;
        }
    }
    successCb = (successCb) ? successCb : null;
    if (isLive && videoData.component == 'HAS') {
        AvPlayer.jump(milliSeconds, successCb);
    } else {
        webapis.avplay.seekTo(milliSeconds, successCb, AvPlayer.seekFailed);
    }
};

AvPlayer.jump = function(milliSeconds, successCb) {
    var now = webapis.avplay.getCurrentTime();
    if (now > milliSeconds) {
        webapis.avplay.jumpBackward(now-milliSeconds, successCb, AvPlayer.seekFailed);
    } else {
        webapis.avplay.jumpForward(milliSeconds-now, successCb, AvPlayer.seekFailed);
    }
};

AvPlayer.seekFailed = function(Error) {
    if (AvPlayer.isLive()) {
        Player.reloadVideo();
    } else {
        Player.OnRenderError(Error);
    }
};

AvPlayer.stop = function() {
    AvPlayer.remove();
};

AvPlayer.reload = function(videoData, isLive, seconds) {
    AvPlayer.stop();
    AvPlayer.load(videoData);
    AvPlayer.play(isLive, seconds);
};

AvPlayer.getResolution  = function() {
    var streamInfo = AvPlayer.GetCurrentVideoStreamInfo();
    return {width:  +(streamInfo.Width  || streamInfo.width),
            height: +(streamInfo.Height || streamInfo.height)
           };
};

AvPlayer.getDuration  = function() {
    var duration = webapis.avplay.getDuration();
    if (videoData.use_offset) return 0;
    return isNaN(duration) ? 0 : duration;
};

AvPlayer.getBandwith  = function() {
    var videoBw = AvPlayer.getStreamingProperty('CURRENT_BANDWIDTH');
    // Seems videoBw is not accurate for 2019
    if (!videoBw || deviceYear == 2019)
        videoBw = +(AvPlayer.GetCurrentVideoStreamInfo().Bit_rate ||
                    AvPlayer.GetCurrentVideoStreamInfo().bitrates
                   );
    return videoBw;
};

AvPlayer.getStreamingProperty  = function(Property) {
    try {
        return webapis.avplay.getStreamingProperty(Property);
    } catch (err) {
        return '' + err;
    }
};

AvPlayer.setAudioStream = function(index) {
    // Determine index offset for Audio.
    var tracks = webapis.avplay.getTotalTrackInfo();
    for (var i=0; i < tracks.length; i++) {
        if (tracks[i].type == 'AUDIO') {
            index += tracks[i].index;
            break;
        }
    }
    try {
        Log('Setting audio_idx: ' + index);
        webapis.avplay.setSelectTrack('AUDIO', index);
        return true;
    } catch(err) {
        Log('setAudioStream failed:' + err);
        return false;
    }
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

AvPlayer.hasSubtitles = function() {
    var tracks = webapis.avplay.getTotalTrackInfo();
    for (var i=0; i < tracks.length; i++) {
        if (tracks[i].type == 'TEXT') {
            return true;
        }
    }
    return false;
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

AvPlayer.isLive = function() {
    return AvPlayer.getStreamingProperty('IS_LIVE') == '1';
};
