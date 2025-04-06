var VideoJsPlayer = {
    init_retries: 5,
    is_loaded: false,
    player: null,
    is_native: false,

    state: 0,
    STATE_INIT: 0,
    STATE_WAITING: 1,
    STATE_STARTED: 2,

    resuming: false,
    resume_seeking_started: false,
    split_seek: false,
    play_called: false,
    has_subtitles: false,
    seek_reload_timer: null,

    aborted: false,

    // Aspects
    aspectMode: 0,
    ASPECT_AUTO : 0,
    ASPECT_FULL : 1,
    ASPECT_ZOOM : 2,

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

VideoJsPlayer.init = function() {
    var resources;
    if (deviceYear > 2017) {
        resources =
            ['https://cdnjs.cloudflare.com/ajax/libs/video.js/8.22.0/video.min.js',
             'https://cdnjs.cloudflare.com/ajax/libs/videojs-flash/2.2.1/videojs-flash.min.js',
             'https://cdnjs.cloudflare.com/ajax/libs/m3u8-parser/7.2.0/m3u8-parser.min.js'
            ];
    } else {
        resources =
            ['https://cdnjs.cloudflare.com/ajax/libs/js-polyfills/0.1.43/polyfill.min.js',
             'https://cdnjs.cloudflare.com/ajax/libs/video.js/7.21.6/video.js',
             'https://unpkg.com/@videojs/http-streaming@3.17.0/dist/videojs-http-streaming.min.js',
             'https://cdnjs.cloudflare.com/ajax/libs/videojs-flash/2.2.1/videojs-flash.min.js',
             'https://cdnjs.cloudflare.com/ajax/libs/videojs-contrib-quality-levels/2.0.9/videojs-contrib-quality-levels.min.js',
             'https://cdnjs.cloudflare.com/ajax/libs/m3u8-parser/4.3.0/m3u8-parser.min.js'
            ];
    }
    VideoJsPlayer.loadResources(resources);
};

VideoJsPlayer.loadResources = function(resources) {
    $.ajax({
        dataType: 'script',
        cache: true,
        url: resources[0]
    }).done(function(script, textStatus ) {
            Log(this.url + ' loaded.');
            resources.shift();
            if (resources.length > 0)
                VideoJsPlayer.loadResources(resources);
            else {
                if (typeof videojs === 'function')
                    VideoJsPlayer.is_loaded = true;
                Log('Is videojs loaded:' + VideoJsPlayer.isLoaded());
                VideoJsPlayer.init_retries = 0;
            }
        })
        .fail(function(xhr, settings, exception) {
            Log(this.url + ' failed:' + exception);
            if (VideoJsPlayer.init_retries > 0) {
                VideoJsPlayer.init_retries -= 1;
                window.setTimeout(VideoJsPlayer.init, 5000);
            }
        });
};

VideoJsPlayer.isLoaded = function() {
    if (VideoJsPlayer.is_loaded)
        return true;
    else if (VideoJsPlayer.init_retries == 0) {
        VideoJsPlayer.init_retries = 1;
        VideoJsPlayer.init()
    }
    return false;
};

VideoJsPlayer.create = function(UseNative) {
    if (VideoJsPlayer.player) {
        if (VideoJsPlayer.is_native == UseNative)
            return;
        else
            VideoJsPlayer.remove();
    }

    var div = document.createElement('video-js');
    div.id = 'video-player';
    div.style.width = MAX_WIDTH + 'px';
    div.style.height = MAX_HEIGHT + 'px';
    div.style.top = '0px';
    div.style.left = '0px';
    div.style.position = 'absolute';
    // Need an exra level for Zoom to work.
    document.getElementById('video-plugin').appendChild(div);

    var streamOptions = {limitRenditionByPlayerDimensions:false,
                         overrideNative:!UseNative
                        };
    var httpOptions = {preload:'auto',
                       vhs:streamOptions,
                       nativeAudioTracks:UseNative,
                       nativeVideoTracks:UseNative
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
    VideoJsPlayer.is_native = UseNative;
    // VideoJsPlayer.player.reloadSourceOnError();
    // videojs.log.level('all');
    videojs.log.level('warn');
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

    VideoJsPlayer.tech({IWillNotUseThisInPlugins:true}).on('usage', function(e){
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

    if (VideoJsPlayer.state != VideoJsPlayer.STATE_STARTED) {
        // VideoJsPlayer.logStats();
        VideoJsPlayer.logHistory();
    }
    if (Event != 'timeupdate') {
        VideoJsLog(Event);
        window.clearTimeout(VideoJsPlayer.seek_reload_timer);
    }

    if (VideoJsPlayer.aborted) {
        alert('ABORTED');
        // Avoid loop - and also avoid aborting a reload...
        window.setTimeout(function() {
            if (VideoJsPlayer.aborted)
                VideoJsPlayer.stop()
        }, 0);
        return;
    }

    if (Event == 'loadedmetadata')
        VideoJsPlayer.metaDataLoaded();
    else if (Event == 'error') {
        e = VideoJsPlayer.player.error().code + '-' + VideoJsPlayer.player.error().message;
        return VideoJsPlayer.abort(function(){Player.OnRenderError(e);});
    };

    if (VideoJsPlayer.state == VideoJsPlayer.STATE_INIT) {
        if (VideoJsPlayer.player.readyState() > 1) {
            VideoJsPlayer.state = VideoJsPlayer.STATE_WAITING;
        } else if (Event == 'stalled') {
            // retry
            Log('stalled - retry');
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
        } else if (VideoJsPlayer.is_native) {
            VideoJsPlayer.seek_reload_timer = window.setTimeout(function() {
                VideoJsPlayer.reload(videoData, Player.isLive, VideoJsPlayer.player.currentTime());
            }, 5000);
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

    case 'ended':
        VideoJsPlayer.abort(function(){Player.OnRenderingComplete();});
        break;

    case 'playing':
        VideoJsPlayer.checkSubtitles();
        break;

    default:
        break;
    }
};

VideoJsPlayer.metaDataLoaded = function() {
    // Why are levels sometimes empty?
    VideoJsLog('metaDataLoaded, levels:' + VideoJsPlayer.player.qualityLevels().length);
    // VideoJsLog('loadedmetadata, levels:' + VhsTech().representations().length);
    // Log('media:' + VhsTech().playlists.media().attributes.BANDWIDTH);
    // Log('master:' + JSON.stringify(VhsTech().playlists.master));

    VideoJsPlayer.selectStream();

    Player.OnStreamInfoReady(true);
    VideoJsPlayer.initMetaDataChange();
};

VideoJsPlayer.selectStream = function() {
    // if (VideoJsPlayer.player.qualityLevels().length == 0) {
    //     // Add manually
    //     var representations = VhsTech().representations();
    //     for (var i=0; i < representations.length; i++)
    //         VideoJsPlayer.player.qualityLevels().addQualityLevel(representations[i]);
    //     Log('rep: ' + representations.length + ' new levels:' + VideoJsPlayer.player.qualityLevels().length)
    // }
    var wantedBr = videoData.bitrates && videoData.bitrates.match(/BITRATES=([0-9]+):[0-9]/);
    wantedBr = wantedBr && +wantedBr[1];
    var levels = VhsTech().representations();
    if (wantedBr && levels.length > 1) {
        // var levels = VideoJsPlayer.player.qualityLevels();
        // for (var i=0; wantedBr && i < levels.length; i++) {
        //     levels[i].enabled = (levels[i].bitrate == wantedBr);
        // }
        var bitrates = [];
        var doesLevelExist = false;
        for (var i=0; i < levels.length; i++) {
            bitrates.push(+levels[i].bandwidth);
            if (levels[i].bandwidth == wantedBr) {
                doesLevelExist = true;
                break;
            }
        }
        if (!doesLevelExist) {
            // Other bitrate levels - find out which one we actually want.
            bitrates.sort(function(a,b){return a - b;});
            wantedBr = Resolution.getTarget(Player.isLive);
            if (wantedBr == 'Min') wantedBr = bitrates[0];
            if (wantedBr == 'Max') wantedBr = bitrates[bitrates.length-1];
            for (var i=1; i < bitrates.length; i++) {
                if (bitrates[i] == wantedBr)
                    break;
                else if (bitrates[i] > wantedBr) {
                    wantedBr = bitrates[i-1];
                    break;
                } else if (i == (bitrates.length-1))
                    wantedBr = bitrates[i]
            }
        }
        for (var i=0; i < levels.length; i++)
            levels[i].enabled((levels[i].bandwidth == wantedBr));
    }
};

VideoJsPlayer.remove = function() {
    if (VideoJsPlayer.player) {
        VideoJsPlayer.player.pause();
        VideoJsPlayer.player.reset();
        VideoJsPlayer.player.dispose();
        VideoJsPlayer.player = null;
        $('#video-plugin').css('transform', '');
    }
};

VideoJsPlayer.load = function(videoData) {
    videojs.log.history.clear();
    VideoJsPlayer.state = VideoJsPlayer.STATE_INIT;
    VideoJsPlayer.play_called = false;
    VideoJsPlayer.resuming = false;
    VideoJsPlayer.split_seek = false;
    VideoJsPlayer.has_subtitles = false;
    VideoJsPlayer.resume_seeking_started = false;
    VideoJsPlayer.aborted = false;
    var src = videoData.url;
    var type = 'application/x-mpegURL';
    var parser = new m3u8Parser.Parser();

    if (videoData.stream_content) {
        parser.push(videoData.stream_content);
        parser.end();
        src = 'data:application/vnd.videojs.vhs+json,'+JSON.stringify(parser.manifest);
        type = 'application/vnd.videojs.vhs+json';
    } else if (videoData.component == 'HAS')
        type = 'application/dash+xml';
    VideoJsPlayer.player.src({src:src,
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
            VhsTech().xhr.beforeRequest = function(options) {
                options.headers = {'User-Agent':ua};
                return options;
            };
        VideoJsPlayer.player.load();
        VideoJsPlayer.player.play();
    });
};

VideoJsPlayer.play = function(isLive, seconds) {
    var milliSeconds = (seconds) ? seconds*1000 : seconds;
    if (!milliSeconds && isLive && !videoData.use_offset && deviceYear < 2018) {
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
        // VideoJsPlayer.logStats();
        // VideoJsPlayer.logHistory(true);
        this.remove();
    }
};

VideoJsPlayer.reload = function(videoData, isLive, seconds) {
    Log('VideoJsPlayer.reload');
    this.remove();
    this.create(VideoJsPlayer.is_native);
    this.load(videoData),
    this.play(isLive, seconds);
};

VideoJsPlayer.getResolution  = function() {
    try {
        var resolution = VhsTech().playlists.media().attributes.RESOLUTION;
        return (resolution) ? resolution : {width:0, height:0};
    } catch (err) {
        var levels = VideoJsPlayer.player.qualityLevels();
        if (levels && levels.selectedIndex_ >= 0) {
            return levels.levels_[levels.selectedIndex_];
        }
        return {width:+VideoJsPlayer.player.videoWidth(), height:+VideoJsPlayer.player.videoHeight()};
    }
};

VideoJsPlayer.getDuration  = function() {
    var duration = VideoJsPlayer.player.duration()*1000;
    if (isNaN(duration) || duration == 'Infinity')
        duration = 0;
    return duration;
};

VideoJsPlayer.getLiveDuration  = function() {
    var seek = VideoJsPlayer.player.seekable();
    return (seek && seek.length > 0) ? +seek.end(seek.length-1)*1000 : 0;
};

VideoJsPlayer.getBandwith  = function() {
    // var representations = VhsTech().representations();
    // for (var i=0; i < representations.length; i++) {
    //     if (representations[i].enabled())
    //         Log('selected bw: ' + representations[i].bandwidth);
    //     else
    //         Log('disabled bw: ' + representations[i].bandwidth);
    // };
    try {
        return VhsTech().playlists.media().attributes.BANDWIDTH;
        var levels = VideoJsPlayer.player.qualityLevels();
        if (levels.selectedIndex_ >= 0)
            return levels.levels_[levels.selectedIndex_].bitrate;
    } catch (error) {
        alert('VideoJsPlayer.getBandwith failed: ' + error);
    }
};

VideoJsPlayer.getAudioStreams = function() {
    var streams = [];
    var audioTracks = VideoJsPlayer.player.audioTracks();
    for (var i=0; i < audioTracks.length; i++)
        streams.push(audioTracks[i].label)
    return streams;
};

VideoJsPlayer.setAudioStream = function(index) {
    try {
        VideoJsPlayer.player.audioTracks()[index].enabled = true;
        return true;
    } catch (error) {
        Log('Failed to setAudioStream: ' + error);
        return false
    }
};

VideoJsPlayer.toggleAspectRatio = function() {
    this.aspectMode = (this.aspectMode+1) % (VideoJsPlayer.ASPECT_ZOOM+1);
};

VideoJsPlayer.setAspectRatio = function(resolution) {
    if (this.aspectMode == this.ASPECT_FULL)
        $('#video-plugin').css('transform', 'scaleX(calc(4/3))');
    else if (this.aspectMode == this.ASPECT_ZOOM) {
        var zoom = this.getZoomFactor();
        if (zoom < 1)
            $('#video-plugin').css('transform', '');
        else
            $('#video-plugin').css({'transform-origin':'center',
                                    'transform':'scale(' + zoom + ')'
                                   });
    } else
        $('#video-plugin').css('transform', '');
};

VideoJsPlayer.getAspectModeText = function() {
    switch (this.aspectMode) {
        case this.ASPECT_AUTO:
        return '';

        case this.ASPECT_FULL:
        return 'FULL';

        case this.ASPECT_ZOOM:
        return 'ZOOM ' + ((this.getZoomFactor()-1)*100).toFixed(1) + '%';
    }
};

VideoJsPlayer.isZoomAspect = function() {
    return this.aspectMode == this.ASPECT_ZOOM;
};

VideoJsPlayer.changeZoom = function(increase) {
    var oldZoomFactor = this.getZoomFactor();
    if (increase)
        this.saveZoomFactor(oldZoomFactor + 0.01);
    else if (oldZoomFactor >= 0.005)
        this.saveZoomFactor(oldZoomFactor - 0.005);
};

VideoJsPlayer.getZoomFactor = function () {
    var savedValue = Config.read('zoomFactor');
    if (savedValue != null) {
        return Number(savedValue);
    } else {
        return 1.125;
    }
};

VideoJsPlayer.saveZoomFactor = function (value) {
    if (value < 1) value = 1;
    Config.save('zoomFactor', value);
};

VideoJsPlayer.hasSubtitles = function() {
    return VideoJsPlayer.has_subtitles;
};

VideoJsPlayer.initMetaDataChange = function() {
    var tracks = VideoJsPlayer.player.textTracks();
    var lastBwChange = 0;
    for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].on && tracks[i].label==='segment-metadata') {
            tracks[i].on('cuechange', function() {
                // Seeems we get this over and over without any changes...
                if (VideoJsPlayer.getBandwith() != lastBwChange) {
                    lastBwChange = VideoJsPlayer.getBandwith();
                    VideoJsLog('cuechange: ' + VideoJsPlayer.getBandwith());
                    Player.OnStreamInfoReady(true);
                }
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

VideoJsPlayer.checkSubtitles = function() {
    var track = VideoJsPlayer.findSubtitleTrack('sv') ||
        VideoJsPlayer.findSubtitleTrack('en');
    if (track &&
        (VideoJsPlayer.has_subtitles || !Subtitles.exists())) {
        if (!VideoJsPlayer.has_subtitles)
            Log('VJS found subtitles:' + track.language);
        track.mode = 'hidden';
        VideoJsPlayer.has_subtitles = true;
        track.addEventListener('cuechange', function() {
            var text = '';
            if (this.activeCues.length > 0) {
                text = this.activeCues[0].text.replace('\n','<br />');
            }
            Subtitles.set(text);
        });
    }
};

VideoJsPlayer.findSubtitleTrack = function(language) {
    var tracks = VideoJsPlayer.player.textTracks();
    var track = null;
    for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].kind == 'subtitles') {
            tracks[i].mode = 'disabled';
            if (tracks[i].language == language)
                track = tracks[i];
        }
    }
    return track;
};

VideoJsPlayer.logHistory = function(debug) {
    var history = videojs.log.history();
    videojs.log.history.clear();
    for (var i=0;i < history.length;i++) {
        history[i] = JSON.stringify(history[i]).substring(0,150);
        if (debug || !history[i].match(/DEBUG/))
            Log(history[i])
    }
};

VideoJsPlayer.logStats = function() {
    var stats = VhsTech().stats;
    for (var k in stats) {
        if (k == 'master') {
            for (var i in stats[k]) {
                if (i == 'playlists') {
                    var playlists = stats[k][i];
                    for (var j = 0; j < playlists.length; j++) {
                        for (var l in playlists[j]) {
                            if (l == 'segments' && playlists[j][l].length > 1) {
                                Log('Stats->master->playlist->' + l + ':' + JSON.stringify(playlists[j][l][0]));
                                continue
                            }
                            Log('Stats->master->playlists->'  + l + ':' + JSON.stringify(playlists[j][l]));
                        }
                    }
                    continue;
                }
                Log('Stats->master->' + i + ':' + JSON.stringify(stats[k][i]));
            }
            continue;
        }
        Log('Stats->' + k + ':' + JSON.stringify(stats[k]));
    }
};

function VhsTech() {
    if (VideoJsPlayer.tech().vhs)
        return VideoJsPlayer.tech().vhs
    else
        return VideoJsPlayer.tech().hls
}

function VideoJsLog(Message) {
    Log(Message + ' State:' + VideoJsPlayer.player.readyState() + ' Currenttime:' + VideoJsPlayer.player.currentTime() + ' VS:' + VideoJsPlayer.state);
}
