var VideoJsPlayer = {
    player: null,

    state:0,
    STATE_INIT : 0,
    STATE_WAITING : 1,
    STATE_STARTED : 2,

    resuming: false,
    resume_seeking_started:false,
    split_seek:false,
    play_called:false,

    aborted:false,

    aspectMode: 0,
    ASPECT_AUTO : 0,
    ASPECT_FULL : 1,

    events: ['ready',
             'emptied',
             'sourceset',
             'loadstart',
             'loadedmetadata',
             'loadeddata',
             'canplay',
             'canplaythrough',
             'play',
             'pause',
             'playing',
             'timeupdate',
             'durationchange',
             'seeking',
             'seeked',
             'stalled',
             'suspend',
             'waiting',
             'ended',
             // 'progress',
             'error',
             'abort',
             'dispose',
             'audiotrackchange'
            ]
};

VideoJsPlayer.create = function() {
    if (VideoJsPlayer.player)
        return;

    var div = document.createElement('video-js');
    div.id = 'video-player';
    div.style.width = MAX_WIDTH + 'px';
    div.style.height = MAX_HEIGHT + 'px';
    div.style.top = '0px';
    div.style.left = '0px';
    div.style.position = 'absolute';
    document.getElementById('video-container').appendChild(div);

    var httpOptions = {preload:'auto',
                       hls:{
                           limitRenditionByPlayerDimensions:false,
                           overrideNative:true
                       },
                       nativeAudioTracks:false,
                       nativeVideoTracks:false
                      };
    VideoJsPlayer.player = videojs('video-player',
                              {
                                  fluid:true,
                                  autoplay:false,
                                  controls:false,
                                  enableSourceset:true,
                                  html5:httpOptions,
                                  flash:httpOptions
                              });

    // VideoJsPlayer.player.reloadSourceOnError();
    // videojs.log.level('all');
    videojs.log.level('error');
    videojs.log.history.disable();

    for (var i=0; i < VideoJsPlayer.events.length; i++) {
        VideoJsPlayer.subscribeEvent(VideoJsPlayer.events[i]);
    };

    // // Get the current player's AudioTrackList object.
    // var audioTrackList = VideoJsPlayer.player.audioTracks();

    // // Listen to the 'change' event.
    // audioTrackList.addEventListener('change', function() {
    //     alert('audio change');
    // });

    VideoJsPlayer.tech().on('usage', function(e){
        VideoJsLog('usage:' + e.name);
    });

    VideoJsPlayer.player.qualityLevels().on('addqualitylevel', function(event) {
        VideoJsLog('addqualitylevel: ' + JSON.stringify(event.qualityLevel));
    });

    VideoJsPlayer.player.qualityLevels().on('change', function() {
        VideoJsLog('change, selectedIndex:' + VideoJsPlayer.player.qualityLevels().selectedIndex_);
        Player.OnStreamInfoReady(true);
    });
};

VideoJsPlayer.subscribeEvent = function(Event) {
    VideoJsPlayer.player.on(Event, function(e) {
        VideoJsPlayer.On(Event, e);
    });
};

VideoJsPlayer.On = function (Event, e) {

    if (Event != 'timeupdate')
        VideoJsLog(Event);

    if (VideoJsPlayer.aborted)
        return;

    if (Event == 'loadedmetadata')
        VideoJsPlayer.metaDataLoaded();

    if (VideoJsPlayer.state == VideoJsPlayer.STATE_INIT) {
        if (VideoJsPlayer.player.readyState() > 1) {
            VideoJsPlayer.state = VideoJsPlayer.STATE_WAITING;
        } else if (Event == 'stalled') {
            // retry
            Log("stalled - retry");
            VideoJsPlayer.player.play();
        }
        return;
    } else if (VideoJsPlayer.state == VideoJsPlayer.STATE_WAITING) {
        if (VideoJsPlayer.play_called)
            VideoJsPlayer.startPlayback();
        else
            VideoJsPlayer.player.pause();
        return;
    }

    switch (Event) {

    case 'seeking':
        if (VideoJsPlayer.resuming || Player.skipState != -1)
            Player.OnBufferingStart();
        if (VideoJsPlayer.resuming) {
            if (VideoJsPlayer.player.currentTime() == 0)
                VideoJsPlayer.skip(VideoJsPlayer.resuming);
            else
                VideoJsPlayer.resume_seeking_started = true;
        }
        break;

    case 'seeked':
        if (Player.skipState != -1) {
            Player.OnBufferingComplete();
        }
        if (VideoJsPlayer.resume_seeking_started) {
            if (VideoJsPlayer.split_seek) {
                // Seek rest
                VideoJsPlayer.skip(VideoJsPlayer.resuming, true);
            } else {
                VideoJsPlayer.resume_seeking_started = false;
                VideoJsPlayer.resuming = false;
                VideoJsPlayer.player.play();
                Player.OnBufferingComplete();
            }
        }
        break;

    case 'timeupdate':
        if (!VideoJsPlayer.resuming && VideoJsPlayer.state==VideoJsPlayer.STATE_STARTED)
            Player.SetCurTime(VideoJsPlayer.player.currentTime()*1000);
        break;

    case 'abort':
        VideoJsPlayer.abort(function(){Player.OnConnectionFailed('abort');});
        break;

    case 'error':
        Log('Error: ' + JSON.stringify(e));
        for (var k in e) {
            Log(k + ':' + e[k]);
        }
        Log('Error: ' + e.code + ' ' + e.message);
        Log('Error: ' + VideoJsPlayer.player.error.code + ' ' + VideoJsPlayer.player.error.message);
        if (e.currentTarget)
            Log('Error: ' + e.currentTarget.error);
        VideoJsPlayer.abort(function(){Player.OnRenderError(e);});
        break;

    case 'ended':
        VideoJsPlayer.abort(function(){Player.OnRenderingComplete();});
        break;

    default:
        break;
    }
};

VideoJsPlayer.metaDataLoaded = function() {
    // Why are levels sometimes empty?
    VideoJsLog('metaDataLoaded, levels:' + VideoJsPlayer.player.qualityLevels().length);
    // VideoJsLog('loadedmetadata, levels:' + VideoJsPlayer.tech().hls.representations().length);
    // Log('media:' + VideoJsPlayer.tech().hls.playlists.media().attributes.BANDWIDTH);
    // Log('master:' + JSON.stringify(VideoJsPlayer.tech().hls.playlists.master));


    // if (VideoJsPlayer.player.qualityLevels().length == 0) {
    //     // Add manually
    //     var representations = VideoJsPlayer.tech().hls.representations();
    //     for (var i=0; i < representations.length; i++)
    //         VideoJsPlayer.player.qualityLevels().addQualityLevel(representations[i]);
    //     Log('rep: ' + representations.length + ' new levels:' + VideoJsPlayer.player.qualityLevels().length)
    // }
    var wantedBr = videoData.bitrates && videoData.bitrates.match(/BITRATES=([0-9]+):[0-9]/);
    wantedBr = wantedBr && +wantedBr[1];
    // var levels = VideoJsPlayer.player.qualityLevels();
    // for (var i=0; wantedBr && i < levels.length; i++) {
    //     levels[i].enabled = (levels[i].bitrate == wantedBr);
    // }
    var levels = VideoJsPlayer.tech().hls.representations();
    for (var i=0; wantedBr && i < levels.length; i++) {
        levels[i].enabled((levels[i].bandwidth == wantedBr));
    }
    Player.OnStreamInfoReady(true);
    VideoJsPlayer.initMetaDataChange();
};

VideoJsPlayer.remove = function() {
    if (VideoJsPlayer.player) {
        VideoJsPlayer.player.pause();
        VideoJsPlayer.player.reset();
        VideoJsPlayer.player.dispose();
        VideoJsPlayer.player = null;
    }
};

VideoJsPlayer.load = function(videoData) {
    videojs.log.history.clear();
    VideoJsPlayer.state = VideoJsPlayer.STATE_INIT;
    VideoJsPlayer.play_called = false;
    VideoJsPlayer.resuming = false;
    VideoJsPlayer.split_seek = false;
    VideoJsPlayer.resume_seeking_started = false;
    VideoJsPlayer.aborted = false;
    var type = 'application/x-mpegURL';
    if (videoData.component == 'HAS')
        type = 'application/dash+xml';
    VideoJsPlayer.player.src({src:videoData.url,
                              type:type,
                              withCredentials:true,
                              handleManifestRedirects:true,
                              cacheEncryptionKeys:true
                             });

    var headers = Channel.getHeaders() || [];
    var ua = null;
    for (var i=0; i < headers.length; i++) {
        if (headers[i].key.match(/user-agent/i)) {
            ua = headers[i].value;
            break;
        }
    }
    VideoJsPlayer.player.ready(function() {
        if (ua)
            VideoJsPlayer.tech().hls.xhr.beforeRequest = function(options) {
                options.headers = {'User-Agent':ua};
                return options;
            };
        VideoJsPlayer.player.load();
        VideoJsPlayer.player.play();
    });
};

VideoJsPlayer.play = function(isLive, seconds) {

    var milliSeconds = (seconds) ? seconds*1000 : seconds;
    if (!milliSeconds && isLive && !videoData.use_offset) {
        milliSeconds = 'end';
    }

    if (milliSeconds) {
        VideoJsPlayer.resuming = milliSeconds;
    };

    if (VideoJsPlayer.state == VideoJsPlayer.STATE_WAITING)
        VideoJsPlayer.startPlayback();
    else
        VideoJsPlayer.play_called = true;
};

VideoJsPlayer.startPlayback = function() {
    if (VideoJsPlayer.resuming)
        VideoJsPlayer.skip(VideoJsPlayer.resuming);
    else
        VideoJsPlayer.player.play();
    VideoJsPlayer.state = VideoJsPlayer.STATE_STARTED;
    VideoJsPlayer.play_called = false;
};

VideoJsPlayer.resume = function() {
    VideoJsPlayer.player.play();
};

VideoJsPlayer.pause = function() {
    VideoJsPlayer.player.pause();
};

VideoJsPlayer.skip = function(milliSeconds, remainder) {
    var seek = VideoJsPlayer.player.seekable();
    var seekEnd = (seek.length > 0) ? seek.end(seek.length-1) : 0;
    VideoJsLog('start:' + seek.start(0) + ' end:' + seekEnd + ' l:' + seek.length + ' milliSeconds:' + milliSeconds);
    VideoJsPlayer.split_seek = false;
    if (milliSeconds == 'end') {
        milliSeconds = 0;
        if (seekEnd >= 5) {
            // Skip 5 seconds from end to avoid "ended" immediately
            milliSeconds = (seekEnd-5)*1000;
            // For some reason there seem to be some limit when duration is above approx 13 hours
            // or similar. Need to seek in steps.
            if (!remainder && milliSeconds > 13*3600*1000) {
                milliSeconds = 13*3600*1000;
                VideoJsPlayer.split_seek = true;
            }
        } else if (seekEnd < 0){
            // Something is wrong - trigger fault
            milliSeconds = seekEnd;
        }
    } else if (milliSeconds/1000 > seek.end(seek.length-1))
        milliSeconds = seek.end(seek.length-1)*1000;
    else if (milliSeconds/1000 < seek.start(0))
        milliSeconds = seek.start(0)*1000;
    if (milliSeconds < 0)
        VideoJsPlayer.abort(function(){Player.OnConnectionFailed('Skip failed');});
    else
        VideoJsPlayer.player.currentTime(milliSeconds/1000);
};

VideoJsPlayer.stop = function() {
    if (VideoJsPlayer.player) {
        // Log('hls.stats:' + JSON.stringify(VideoJsPlayer.tech().hls.stats));
        // var history = videojs.log.history();
        // videojs.log.history.clear();
        // for (var i=0;i < history.length;i++) {
        //     if (!JSON.stringify(history[i]).match(/DEBUG/))
        //         Log('history:' + JSON.stringify(history[i]));
        // }
        this.remove();
    }
};

VideoJsPlayer.reload = function(videoData, isLive, seconds) {
    Log('VideoJsPlayer.reload');
    this.remove();
    this.create();
    this.load(videoData),
    this.play(isLive, seconds);
};

VideoJsPlayer.getResolution  = function() {
    return VideoJsPlayer.tech().hls.playlists.media().attributes.RESOLUTION;
    // return {width:+VideoJsPlayer.player.videoWidth(), height:+VideoJsPlayer.player.videoHeight()};
};

VideoJsPlayer.getDuration  = function() {
    var duration = VideoJsPlayer.player.duration();
    if (duration == 'Infinity') {
        return 0;
    }
    return duration*1000;
};

VideoJsPlayer.getBandwith  = function() {
    // var representations = VideoJsPlayer.tech().hls.representations();
    // for (var i=0; i < representations.length; i++) {
    //     if (representations[i].enabled())
    //         Log("selected bw: " + representations[i].bandwidth);
    //     else
    //         Log("disabled bw: " + representations[i].bandwidth);
    // };
    return VideoJsPlayer.tech().hls.playlists.media().attributes.BANDWIDTH;
    var levels = VideoJsPlayer.player.qualityLevels();
    if (levels.selectedIndex_ >= 0)
        return levels.levels_[levels.selectedIndex_].bitrate;
};

VideoJsPlayer.toggleAspectRatio = function() {
    // this.aspectMode = (this.aspectMode+1) % (VideoJsPlayer.ASPECT_FULL+1);
};

VideoJsPlayer.setAspectRatio = function(resolution) {
    // alert(this.aspectMode);
    // alert(this.player.aspectRatio());
    // this.player.fill(this.aspectMode == VideoJsPlayer.ASPECT_FULL);
    // this.player.fluid(this.aspectMode == VideoJsPlayer.ASPECT_AUTO);
    // if (this.aspectMode == VideoJsPlayer.ASPECT_FULL)
    //     this.player.aspectRatio('16:9');
    // else
    //     this.player.aspectRatio('4:3');

};

VideoJsPlayer.getAspectModeText = function() {
    switch (this.aspectMode) {
        case VideoJsPlayer.ASPECT_AUTO:
        return '';

        case VideoJsPlayer.ASPECT_FULL:
        return 'FULL';
    }
};

VideoJsPlayer.initMetaDataChange = function() {
    var tracks = VideoJsPlayer.player.textTracks();
    for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].on && tracks[i].label==='segment-metadata') {
            tracks[i].on('cuechange', function() {
                VideoJsLog('cuechange: ' + VideoJsPlayer.getBandwith());
                Player.OnStreamInfoReady(true);
            });
            break;
        }
    }
};

VideoJsPlayer.tech = function() {
    return VideoJsPlayer.player.tech({IWillNotUseThisInPlugins:true});
};

VideoJsPlayer.abort = function(Function) {
    VideoJsPlayer.aborted = true;
    window.setTimeout(Function, 0);
};

function VideoJsLog(Message) {
    Log(Message + ' State:' + VideoJsPlayer.player.readyState() + ' Currenttime:' + VideoJsPlayer.player.currentTime() + ' VS:' + VideoJsPlayer.state);
}
