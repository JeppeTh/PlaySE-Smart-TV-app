var VideoJsPlayer = {
    player: null,
    // Seems data isn't loaded until after play for live streams
    delayed_seek: null,
    delayed_seek_started:false,
    aspectMode: 0,
    ASPECT_AUTO : 0,
    ASPECT_FULL : 1
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

    // alert('body:' + $('body').html());

    VideoJsPlayer.player = videojs('video-player',
                              {
                                  fluid:true,
                                  autoplay:false,
                                  controls:false,
                                  preload:'auto',
                                  html5:{
                                      hls:{overrideNative:true},
                                      nativeAudioTracks:false,
                                      nativeVideoTracks:false
                                  }
                              });

    VideoJsPlayer.player.reloadSourceOnError();
    // videojs.log.level('all');

    // // Get the current player's AudioTrackList object.
    // var audioTrackList = VideoJsPlayer.player.audioTracks();

    // // Listen to the 'change' event.
    // audioTrackList.addEventListener('change', function() {
    //     alert('audio change');
    // });

    // Doesn't seem to work...
    // VideoJsPlayer.player.on('ready', function() {
    //     VideoJsLog('ready');
    // });

    VideoJsPlayer.player.on('loadedmetadata', function() {
        // Why are levels sometimes empty?
        VideoJsLog('loadedmetadata, levels:' + VideoJsPlayer.player.qualityLevels().length);
        var wantedBr = videoData.bitrates && videoData.bitrates.match(/BITRATES=([0-9]+):[0-9]/);
        wantedBr = wantedBr && +wantedBr[1];
        var levels = VideoJsPlayer.player.qualityLevels();
        for (var i=0; wantedBr && i < levels.length; i++) {
            levels[i].enabled = (levels[i].bitrate == wantedBr);
        }
        Player.OnStreamInfoReady(true);
        VideoJsPlayer.checkDelayedSeek();
    });

    VideoJsPlayer.player.qualityLevels().on('change', function() {
        VideoJsLog('change, selectedIndex:' + VideoJsPlayer.player.qualityLevels().selectedIndex_);
        Player.OnStreamInfoReady(true);
    });

    VideoJsPlayer.player.on('audiotrackchange', function() {
        alert('audiotrackchange');
    });

    VideoJsPlayer.player.on('abort', function(e) {
        VideoJsLog('abort: ' + JSON.stringify(e));
    });

    VideoJsPlayer.player.on('canplay', function() {
        VideoJsLog('canplay');
    });

    VideoJsPlayer.player.on('canplaythrough', function() {
        VideoJsLog('canplaythrough');
    });

    VideoJsPlayer.player.on('loadstart', function() {
        VideoJsLog('loadstart');
    });

    VideoJsPlayer.player.on('loadeddata', function() {
        VideoJsLog('loadeddata');
        // Log('Audiotracks: ' + JSON.stringify(VideoJsPlayer.player.audioTracks()));
        // Log('DefaultMute: ' + JSON.stringify(VideoJsPlayer.player.defaultMuted()));
        // Log('Quality: ' + JSON.stringify(VideoJsPlayer.player.getVideoPlaybackQuality()));
    });

    // VideoJsPlayer.player.on('emptied', function() {
    //     VideoJsLog('emptied');
    // });

    VideoJsPlayer.player.on('play', function() {
        VideoJsLog('play currenttime:' + VideoJsPlayer.player.currentTime());
    });

    VideoJsPlayer.player.on('playing', function() {
        VideoJsLog('playing');
    });

    VideoJsPlayer.player.on('waiting', function(e) {
        VideoJsLog('waiting');
    });

    // VideoJsPlayer.player.on('progress', function(e) {
    //     // Player.OnBufferingProgress(Math.round(VideoJsPlayer.player.bufferedPercent()*100));
    //     // VideoJsLog('Progress: ' + JSON.stringify(e));
    // });

    VideoJsPlayer.player.on('error', function(e) {
        VideoJsLog('Error: ' + JSON.stringify(e));
        Log('Error: ' + e.code + ' ' + e.message);
        Log('Error: ' + VideoJsPlayer.player.error.code + ' ' + VideoJsPlayer.player.error.message);
        Player.PlaybackFailed(e);
    });

    VideoJsPlayer.player.on('seeking', function() {
        VideoJsLog('seeking:' + Player.skipState);
        if (Player.skipState != -1)
            Player.OnBufferingStart();
    });

    VideoJsPlayer.player.on('seeked', function(e) {
        VideoJsLog('seeked, skipState:' + Player.skipState + ' delayed_seek_started:'  + VideoJsPlayer.delayed_seek_started + ' currentTime:' + VideoJsPlayer.player.currentTime());
        if (Player.skipState != -1) {
            Player.OnBufferingComplete();
        } else if (VideoJsPlayer.delayed_seek_started) {
            VideoJsPlayer.delayed_seek_started = false;
            VideoJsPlayer.enableTimeUpdate();
        }
    });

    VideoJsPlayer.player.on('stalled', function() {
        alert('Video stalled');
    });

    VideoJsPlayer.player.on('suspended', function() {
        alert('suspended');
    });

    VideoJsPlayer.player.on('ended', function() {
        VideoJsLog('Video ended');
        Player.OnRenderingComplete();
    });

    VideoJsPlayer.player.tech().on('usage', function(e){
        VideoJsLog('usage:' + e.name);
    });

    // VideoJsPlayer.player.qualityLevels().on('addqualitylevel', function(event) {
    //     VideoJsLog('addqualitylevel: ' + JSON.stringify(event.qualityLevel));
    // });

};

VideoJsPlayer.remove = function() {
    if (VideoJsPlayer.player) {
        VideoJsPlayer.player.pause();
        VideoJsPlayer.player.reset();
        VideoJsPlayer.player.dispose();
        // alert('body:' + $('body').html());
        VideoJsPlayer.player = null;
    }
};

VideoJsPlayer.load = function(videoData) {
    VideoJsPlayer.delayed_seek = null;
    VideoJsPlayer.delayed_seek_started = false;
    var type = 'application/x-mpegURL';
    if (videoData.component == 'HAS')
        type = 'application/dash+xml';
    VideoJsPlayer.player.src({src:videoData.url,
                              withCredentials:true,
                              handleManifestRedirects:true,
                              cacheEncryptionKeys:true,
                              // smoothQualityChange:true,
                              type:type// ,
                              // allowSeeksWithinUnsafeLiveWindow:true
                             });
    VideoJsPlayer.player.load();
    // alert('settings:' + JSON.stringify(VideoJsPlayer.player.settings()));
};

VideoJsPlayer.play = function(isLive, seconds) {
    VideoJsPlayer.player.ready(function() {
        VideoJsLog('Player ready, seconds:' + seconds);
        var milliSeconds = (seconds) ? seconds*1000 : seconds;
        if (!milliSeconds && isLive && !videoData.use_offset) {
            // var seek = VideoJsPlayer.player.seekable();
            // milliSeconds = seek.end(seek.length-1)*1000;
            milliSeconds = 'end';
        }
        if (milliSeconds) {
            if (VideoJsPlayer.player.readyState())
                VideoJsPlayer.skip(milliSeconds);
            else
                VideoJsPlayer.delayed_seek = milliSeconds;
        }
        if (!VideoJsPlayer.delayed_seek)
            VideoJsPlayer.enableTimeUpdate();
        VideoJsPlayer.player.play();
    });
};

VideoJsPlayer.enableTimeUpdate = function() {
    VideoJsPlayer.player.on('timeupdate', function() {
        Player.SetCurTime(VideoJsPlayer.player.currentTime()*1000);
    });
};

VideoJsPlayer.checkDelayedSeek = function() {
    // if (VideoJsPlayer.delayed_seek && VideoJsPlayer.player.readyState() >= 4) {
    if (VideoJsPlayer.delayed_seek) {
        VideoJsPlayer.skip(VideoJsPlayer.delayed_seek);
        VideoJsPlayer.delayed_seek_started = true;
        VideoJsPlayer.delayed_seek = null;
    }
};

VideoJsPlayer.resume = function() {
    VideoJsPlayer.player.play();
};

VideoJsPlayer.pause = function() {
    VideoJsPlayer.player.pause();
};

VideoJsPlayer.skip = function(milliSeconds) {
    var seek = VideoJsPlayer.player.seekable();
    VideoJsLog('start:' + seek.start(0) + ' end:' + seek.end(seek.length-1) + ' milliSeconds:' + milliSeconds);
    if (milliSeconds == 'end')
        milliSeconds = seek.end(seek.length-1)*1000;
    else if (milliSeconds/1000 > seek.end(seek.length-1))
        milliSeconds = seek.end(seek.length-1)*1000;
    else if (milliSeconds/1000 < seek.start(0))
        milliSeconds = seek.start(0)*1000;
    Log('adjusted milliSeconds:' + milliSeconds);
    VideoJsPlayer.player.currentTime(milliSeconds/1000);
};

VideoJsPlayer.stop = function() {
    if (VideoJsPlayer.player) {
        // Log('hls.stats:' + JSON.stringify(VideoJsPlayer.player.hls.stats));
        // var history = VideoJsPlayer.player.log.history();
        // videojs.log.history.clear();
        // for (var i=0;i < history.length;i++)
        //     Log('history:' + JSON.stringify(history[i]));
        this.remove();
    }
};

VideoJsPlayer.reload = function(videoData, isLive, seconds) {
    this.remove();
    this.create();
    this.load(videoData),
    this.play(isLive, seconds);
};

VideoJsPlayer.getResolution  = function() {
    return {width:+VideoJsPlayer.player.videoWidth(), height:+VideoJsPlayer.player.videoHeight()};
};

VideoJsPlayer.getDuration  = function() {
    var duration = VideoJsPlayer.player.duration();
    if (duration == 'Infinity') {
        duration = VideoJsPlayer.player.seekable();
        return duration.end(duration.length-1);
    }
    return duration;
};

VideoJsPlayer.getBandwith  = function() {
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

VideoJsLog = function(Message) {
    Log(Message + ' State:' + VideoJsPlayer.player.readyState())
}
