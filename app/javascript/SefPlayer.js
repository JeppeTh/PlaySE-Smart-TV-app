var SefPlayer = {
    player: null,
    is_new: false,
    stream: null,
    is_hls: false,

    resume_jump: null,
    check_resolution_changes: false,
    resolution: null,

    aspectMode: 0,
    ASPECT_NORMAL : 0,
    ASPECT_H_FIT : 1,
    ASPECT_ZOOM : 2
};

SefPlayer.create = function() {
    if (SefPlayer.player)
        return;
    else if (deviceYear > 2010) {
        SefPlayer.player = document.getElementById('pluginSef');
        Log('SefPlayer Open:' + SefPlayer.player.Open('Player', '1.112', 'Player'));
        SefPlayer.player.OnEvent = SefPlayer.OnEvent;
        SefPlayer.is_new = true;

        Log('SefPlayer version: ' + SefPlayer.player.Execute('GetPlayerVersion'));
        // Log('Frame Rate Option (1=fixed): ' + SefPlayer.player.Execute('GetOption', 36));
    } else
        SefPlayer.createOld();
};

SefPlayer.createOld = function() {
    SefPlayer.player = document.getElementById('pluginPlayer');
    SefPlayer.player.Execute = function(Name) {
        try{
            var args=[];
            if (Name == 'StartPlayback') {
                Name = 'ResumePlay';
                args.push('"' + SefPlayer.stream + '"');
            } else if (Name == 'GetVideoResolution') {
                return SefPlayer.player.GetVideoWidth() + '|' + SefPlayer.player.GetVideoHeight();
            }
            Name = 'SefPlayer.player.' + Name;
            if (eval(Name)) {
                for (var i=1; i < arguments.length; i++) {
                    if (typeof(arguments[i]) === 'string') {
                        args.push('"' + arguments[i]+'"');
                    // } else if (arguments[i] != undefined)
                    } else
                        args.push(arguments[i]);
                };
                args.join(',');
                Name = Name  + '(' + args + ');';
                return eval(Name);
            } else
                Log('ignoring: ' + Name);
        } catch (err) {
            Log('SefPlayer.player.Execute failed:' + err);
        }
    };
    SefPlayer.player.OnCurrentPlayTime = 'SefPlayer.SetCurTime';
    SefPlayer.player.OnStreamInfoReady = 'Player.OnStreamInfoReady';
    SefPlayer.player.OnBufferingStart = 'Player.OnBufferingStart';
    SefPlayer.player.OnBufferingProgress = 'Player.OnBufferingProgress';
    SefPlayer.player.OnBufferingComplete = 'SefPlayer.OnBufferingComplete'
    SefPlayer.player.OnRenderingComplete  = 'Player.OnRenderingComplete';
    SefPlayer.player.OnNetworkDisconnected = 'Player.OnNetworkDisconnected';
    SefPlayer.player.OnConnectionFailed = 'Player.OnConnectionFailed';
    SefPlayer.player.OnStreamNotFound   = 'Player.OnStreamNotFound';
    SefPlayer.player.OnRenderError      = 'Player.OnRenderError';
    SefPlayer.player.OnAuthenticationFailed = 'Player.OnAuthenticationFailed';
    SefPlayer.is_new = false;
}

SefPlayer.remove = function() {
    SefPlayer.player.Execute('Stop');
};

SefPlayer.load = function(videoData) {
    if (SefPlayer.is_new)
        SefPlayer.setFullscreen();
    else
        SefPlayer.player.Execute('SetDisplayArea', 0, 0, 1, 1);
    SefPlayer.player.Execute('InitPlayer', videoData.url);
    if (videoData.license) {
        if (videoData.custom_data) {
            SefPlayer.player.Execute('SetPlayerProperty', 3, videoData.custom_data, videoData.custom_data.length);
        }
        SefPlayer.player.Execute('SetPlayerProperty', 4, videoData.license, videoData.license.length);
    }
    SefPlayer.stream = videoData.url;
    SefPlayer.is_hls = (videoData.component == 'HLS');
    SefPlayer.resume_jump = null;
    SefPlayer.check_resolution_changes = false;

    // TODO must perhaps invoked after OnStreamInfoReady - ignore until needed.
    // if (videoData.audio_idx)
    //     Log('SetStreamID Audio: ' + videoData.audio_idx + ' res: ' + SefPlayer.player.Execute('SetStreamID', 1, videoData.audio_idx));
    // if (Subtitles.exists()) {
    //     // Log('StartSubtitle res: ' + Execute('StartSubtitle', videoData.url.replace(/\|.+$/, '')));
    //     Log('Number of Subtitles:' + SefPlayer.player.Execute('GetTotalNumOfStreamID',5));
    //     if (videoData.subtitles_idx != null && subtitles.length == 0)
    //         Log('SetStreamID Subtitles: ' + videoData.subtitles_idx + ' res: ' + Execute('SetStreamID', 5, videoData.subtitles_idx));
    // }
};

SefPlayer.play = function(isLive, seconds) {
    if (!seconds) seconds = 0;
    if (Resolution.getTarget(isLive) == 'Auto') {
        // Seems Auto and at least HLS has issues with resume...
        if (seconds && SefPlayer.is_hls) {
            SefPlayer.resume_jump = seconds;
            seconds = 0;
        }
        if (!SefPlayer.is_new) {
            // Seems OnStreamInfoReady isn't invoked at resolution changes. Need manual check.
            SefPlayer.check_resolution_changes = true;
            SefPlayer.resolution = SefPlayer.getResolution();
        }
    }
    SefPlayer.player.Execute('StartPlayback', seconds);
};

SefPlayer.resume = function() {
    SefPlayer.player.Execute('Resume');
};

SefPlayer.pause = function() {
    SefPlayer.player.Execute('Pause');
};

SefPlayer.skip = function(milliSeconds) {
    var seconds = +milliSeconds/1000;
    if (seconds > 0)
        SefPlayer.player.Execute('JumpForward', seconds);
    else
        SefPlayer.player.Execute('JumpBackward', -seconds);
};

SefPlayer.stop = function() {
    SefPlayer.remove();
};

SefPlayer.reload = function(videoData, isLive, seconds) {
    SefPlayer.stop();
    SefPlayer.load(videoData);
    SefPlayer.play(isLive, seconds);
};

SefPlayer.getResolution  = function() {
    var res = SefPlayer.player.Execute('GetVideoResolution').split('|');
    return {width:Number(res[0]), height:Number(res[1])};
};

SefPlayer.getDuration  = function() {
    return SefPlayer.player.Execute('GetDuration');
};

SefPlayer.getBandwith  = function() {
    return SefPlayer.player.Execute('GetCurrentBitrates');
};

SefPlayer.setAudioStream = function(index) {
    var result = SefPlayer.player.Execute('SetStreamID', 1, index);
    Log('SetStreamID Audio: ' + index + ' res: ' + result);
    return result == 1;
};

SefPlayer.toggleAspectRatio = function() {
    if (!Player.IsAutoBwUsedFor2011()) {
        this.aspectMode = (this.aspectMode+1) % (SefPlayer.ASPECT_ZOOM+1);
    } else {
        this.aspectMode = SefPlayer.ASPECT_NORMAL;
    }
};

SefPlayer.setAspectRatio = function(resolution) {
    // During 'AUTO Bandwith' resolution can change which doesn't seem to be
    // reported to 2011 devices. So then Crop Area would be all wrong.
    if (resolution.width > 0 && resolution.height > 0 && !Player.IsAutoBwUsedFor2011()) {
        var aspect = resolution.width/resolution.height;
        if (SefPlayer.aspectMode === SefPlayer.ASPECT_H_FIT && aspect > 4/3) {
            var cropOffset = Math.floor((GetMaxVideoWidth() - (4/3*GetMaxVideoHeight()))/2);
            var cropX      = Math.round(resolution.width/GetMaxVideoWidth()*cropOffset);
            var cropWidth  = resolution.width-(2*cropX);
            SefPlayer.player.Execute('SetCropArea', cropX, 0, cropWidth, resolution.height);
        } else if (SefPlayer.aspectMode === SefPlayer.ASPECT_H_FIT) {
            SefPlayer.setFullscreen();
        } else {
            resolution.aspect = aspect;
            if (SefPlayer.aspectMode === SefPlayer.ASPECT_ZOOM) {
                SefPlayer.zoom(resolution);
            } else {
                SefPlayer.player.Execute('SetCropArea', 0, 0, resolution.width, resolution.height);
                SefPlayer.scaleDisplay(resolution);
            }
        }
    } else
        SefPlayer.setFullscreen();

    if (Player.state === Player.PAUSED) {
        SefPlayer.pause();
    }
};

SefPlayer.setFullscreen = function() {
    SefPlayer.player.Execute('SetDisplayArea', 0, 0, GetMaxVideoWidth(), GetMaxVideoHeight());
};

SefPlayer.scaleDisplay = function (resolution) {
    var factor = (resolution.aspect >= 16/9) ?
        // Wider than high - 'extend/limit' based on width
        GetMaxVideoWidth()/resolution.width :
        // Higher than wide - 'extend/limit' based on height
        GetMaxVideoHeight()/resolution.height;

    var width  = Math.min(GetMaxVideoWidth(),  resolution.width*factor);
    var height = Math.min(GetMaxVideoHeight(), resolution.height*factor);

    var x = Math.floor((GetMaxVideoWidth()-width)/2);
    var y = Math.floor((GetMaxVideoHeight()-height)/2);
    // Log('scaleDisplay:'+x+','+y+','+width+','+height + ' resolution:' + JSON.stringify(resolution));
    SefPlayer.player.Execute('SetDisplayArea', x, y, Math.floor(width), Math.floor(height));
};

SefPlayer.zoom = function(resolution) {

    var zoomFactor = SefPlayer.getZoomFactor();
    var cropY      = resolution.height*zoomFactor;
    var cropHeight = resolution.height-(2*cropY);
    var cropX      = 0;

    if (resolution.width/cropHeight > 16/9 && zoomFactor > 0) {
        // Must start cropping also in width
        cropX = (resolution.width-(16/9*cropHeight))/2;
    }
    var cropWidth = resolution.width-(2*cropX);

    if (resolution.aspect < 16/9) {
        SefPlayer.scaleDisplay({width:cropWidth, height:cropHeight, aspect:cropWidth/cropHeight});
    }
    // Log('SetCropArea:'+cropX+','+cropY+','+cropWidth+','+cropHeight+' resolution:'+JSON.stringify(resolution) + ' zoom:' + (SefPlayer.getZoomFactor()*100).toFixed(1) + '%');
    SefPlayer.player.Execute('SetCropArea', Math.round(cropX), Math.round(cropY), Math.round(cropWidth), Math.round(cropHeight));
};

SefPlayer.getZoomFactor = function () {
    var savedValue = Config.read('zoomFactor');
    if (savedValue != null) {
        return Number(savedValue);
    } else {
        return 0.125;
    }
};

SefPlayer.saveZoomFactor = function (value) {
    Config.save('zoomFactor', value);
};

SefPlayer.changeZoom = function(increase) {

    var oldZoomFactor = SefPlayer.getZoomFactor();
    if (increase)
        SefPlayer.saveZoomFactor(oldZoomFactor + 0.01);
    else if (oldZoomFactor >= 0.005)
        SefPlayer.saveZoomFactor(oldZoomFactor - 0.005);
};

SefPlayer.isZoomAspect = function () {
    return SefPlayer.aspectMode == SefPlayer.ASPECT_ZOOM;
};

SefPlayer.getAspectModeText = function() {
    if (this.aspectMode === SefPlayer.ASPECT_H_FIT) {
        return 'H-FIT';
    } else if (this.aspectMode === SefPlayer.ASPECT_ZOOM) {
        return 'ZOOM ' + (SefPlayer.getZoomFactor()*100).toFixed(1) + '%';
    } else
        return '';
};

SefPlayer.hasSubtitles = function() {
    // Not yet supported though...
    return videoData.subtitles_idx >=0;
};

SefPlayer.OnEvent = function(EventType, param1, param2) {
    switch (EventType) {
    case 1: //OnConnectionFailed();
        Player.OnConnectionFailed();
        break;
    case 2: //OnAuthenticationFailed();
        Player.OnAuthenticationFailed();
    case 3: //OnStreamNotFound();
        Player.OnStreamNotFound();
        break;
    case 4: //OnNetworkDisconnected();
        Player.OnNetworkDisconnected();
        break;
    case 6: //OnRenderError();
        Player.OnRenderError(param1);
        break;
    case 7: //OnRenderingStart();
        SefPlayer.OnRenderingStart();
        break;
    case 8: //OnRenderingComplete();
        Player.OnRenderingComplete();
        break;
    case 9: //OnStreamInfoReady();
        Player.OnStreamInfoReady();
        break;
    case 11: //OnBufferingStart();
        Player.OnBufferingStart();
        break;
    case 12: //OnBufferingComplete();
        Player.OnBufferingComplete();
        break;
    case 13: //OnBufferingProgress();
        Player.OnBufferingProgress(param1);
        break;
    case 14: //SetCurTime(param1);
        Player.SetCurTime(param1);
        break;
        //'15' : 'AD_START',
        //'16' : 'AD_END',
    case 17: // 'RESOLUTION_CHANGED'
        Player.OnStreamInfoReady(true);
        break;
    case 18: // 'BITRATE_CHANGED'
        // Ignore BW since it seems it reacts on new data instead of buffered data. 
        // I.e. it's updated before resolution... 
        break;
    case 19: // 'SUBTITLE'
        Subtitles.set(param1.replace(/< *\/br>/g, '<br />').replace(/<br \/>$/, ''));
        break;
    case 100: // LICENSE_FAILURE?'
        Player.OnRenderError('DRM License failed');
        break;
        //'19' : 'SUBTITLE'
    default:
        Log('SefPlayer event ' + EventType + '(' + param1 + ', ' + param2 + ')');
        break;
    }
};

SefPlayer.OnBufferingComplete = function() {
    Player.OnBufferingComplete();
    // OnRenderingStart is not triggered by old player
    SefPlayer.OnRenderingStart();
};

SefPlayer.OnRenderingStart = function() {
    if (SefPlayer.resume_jump) {
        Log('SefPlayer.resume_jump:' + SefPlayer.resume_jump);
        SefPlayer.skip(SefPlayer.resume_jump*1000);
        SefPlayer.resume_jump = null;
    } else {
        Player.OnRenderingStart();
    }
};

SefPlayer.SetCurTime = function(time) {
    if (SefPlayer.check_resolution_changes) {
        var resolution = SefPlayer.getResolution();
        if (resolution != SefPlayer.resolution) {
            SefPlayer.resolution = resolution;
            Player.OnStreamInfoReady(true);
        }
    }
    Player.SetCurTime(time);
};

function GetMaxVideoWidth() {
    // Seems 1280x720 doesn't really work for HD variants either...
    // if (deviceYear > 2011) 
    //     return MAX_WIDTH;
    return 960;
}

function GetMaxVideoHeight() {
    // Seems 1280x720 doesn't really work for HD variants either...
    // if (deviceYear > 2011) 
    //     return MAX_HEIGHT;
    return 540;
}
