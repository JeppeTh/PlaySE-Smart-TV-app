var skipTime = 0;
var skipTimeInProgress = false;
var highlightsIndex = 0;
var osdTimer;
var actionTimer;
var topOsdLocked = false;
var clockTimer;
var skipTimer;
var detailsTimer;
var delayedPlayTimer = 0;
var pluginAPI = new Common.API.Plugin();
var fpPlugin;
var ccTime = 0;
var resumeTime = 0;
var bufferCompleteCount = 0;
var videoBw = null;
var lastPos = 0;
var videoUrl;
var videoData = {};
var videoActions = {};
var detailsUrl;
var requestedUrl = null;
var backgroundLoading = false;
var startup = false;
var smute = 0;
var retries = 0;
var SEPARATOR = '&nbsp;&nbsp;&nbsp;&nbsp;';
var useSef=true;

var Player = {
    plugin : null,
    state : -1,
    skipState : -1,
    srtState : -1,
    stopCallback : null,    /* Callback function to be set by client */
    originalSource : null,
    sourceDuration: 0,
    pluginDuration: 0,
    infoActive:false,
    detailsActive:false,
    helpActive:false,
    isLive:false,
    start: null,
    offset:0,
    durationOffset:0,
    audioIdx:0,

    bw:'',

    repeat:0,
    REPEAT_OFF:0,
    REPEAT_BACK:1,
    REPEAT_ALL:2,
    REPEAT_ONE:3,

    STOPPED : 0,
    PLAYING : 1,
    PAUSED : 2,  
    FORWARD : 3,
    REWIND : 4,

    // BD-Player Front Display
    FRONT_DISPLAY_PLAY:  100,
    FRONT_DISPLAY_STOP:  101,
    FRONT_DISPLAY_PAUSE: 102
};

Player.setFrontPanelTime = function (hours, mins, secs) {
    try {
        if (Player.state == Player.PLAYING)
            // Log('Setting frontPanelTime');
            fpPlugin.DisplayVFD_Time(hours, mins, secs);
    }
    catch (err) {
        // Log('setFrontPanelTime failed' + err);
    }

};

Player.setFrontPanelText = function (text) {
    try {
        fpPlugin.DisplayVFD_Show(text);
    }
    catch (err) {
        // Log('setFrontPanelText failed:' + err);
    }
};

Player.remove = function() {
    if (Player.plugin) {
        Player.plugin.remove();
        Player.plugin = null;
    }
    Player.disableScreenSaver();
    Player.storeResumeInfo();
    var mwPlugin = document.getElementById('pluginObjectTVMW');

    if (mwPlugin && (this.originalSource != null) ) {
        /* Restore original TV source before closing the widget */
        mwPlugin.SetSource(this.originalSource);
        Log('Restore source to ' + this.originalSource);
    }
};

Player.setVideoURL = function(master, url, srtUrl, extra) {
    if (!extra) extra = {};
    videoData = {srt_url:srtUrl, hls_subs:extra.hls_subs};

    if (extra.bw) {
        this.bw = ' ' + Player.BwToString(extra.bw);
    } else {
        this.bw = '';
    }
    videoData.key = {url:master.replace(/\|.+/, '').replace(/\?.+/,'')};
    var myTitle = itemSelected.find('.ilink').attr('href').match(/[?&](mytitle[^&]+)/);
    if (myTitle) {
        myTitle = myTitle[1];
        videoData.key.id = myTitle.replace(/mytitle=/,'');
    } else {
        // Happens when Show Info is missing.
        Log('No myTitle in link!!');
        myTitle = escape($('.topoverlaybig').html().replace(/[^:]+: /, ''));
        myTitle = 'mytitle=' + myTitle;
    }
    if (extra.redirect_mpd)
        url = Channel.redirectMpd(url);

    videoUrl                = url;
    videoData.component     = videoUrl.match(/\|COMPONENT=([^|]+)/);
    videoData.component     = videoData.component && videoData.component[1];
    videoData.bitrates      = videoUrl.replace(/\|COMPONENT=[^|]+/,'').replace(/^[^|]+\|?/,'');
    videoData.url           = videoUrl;
    videoData.audio_streams = extra.audio_streams;
    videoData.audio_idx     = extra.audio_idx;
    videoData.subtitles_idx = extra.subtitles_idx;
    videoData.use_offset    = extra.use_offset;
    videoData.license       = extra.license;
    videoData.custom_data   = extra.customdata;
    if (deviceYear > 2011) {
        if (extra.previewThumb)
            videoData.previewThumb = extra.previewThumb;
        else if (extra.previewThumbStream)
            videoData.previewThumbStream = extra.previewThumbStream;
    }
    Log('VIDEO URL: ' + videoUrl);
    Player.audioIdx = (videoData.audio_idx) ? -1 : 0;
    // Log('LICENSE URL: ' + videoData.license);
    // Log('CustomData:' + videoData.custom_data);
};

Player.setDuration = function(duration) {
    if (duration*1 == duration) {
        this.sourceDuration = duration * 1000;
    } else if (duration && duration.length > 0) {
        if (duration.match(/^[0-9]+$/)) {
            this.sourceDuration = duration;
        }
        var h = this.GetDigits('h', duration);
        var m = this.GetDigits('min', duration);
        var s = this.GetDigits('sek', duration);
        // Log('decoded duration ' + h + ':' + m + ':' + s);
        this.sourceDuration = (h*3600 + m*60 + s*1) * 1000;
    }
    else {
        this.sourceDuration = 0;
    }
    // Log('Player.sourceDuration: ' + this.sourceDuration);
};

Player.setNowPlaying = function (Name) {
    var nowPlaying = 'Now playing';
    if(Language.getisSwedish()) {
        nowPlaying = 'Nu visas';
    }
    $('.topoverlaybig').html(nowPlaying+': ' + Name);
};

Player.GetDigits = function(type, data) {

    var regexp1 = new RegExp('^(\\d+) ' + type + '.*');
    var regexp2 = new RegExp('^.*\\D+(\\d+) ' + type + '.*');
    if (data.search(regexp1) != -1)
        return data.replace(regexp1, '$1');
    else if (data.search(regexp2) != -1)
        return data.replace(regexp2, '$1');
    else
        return '0';
};

Player.getHlsVersion = function(url, callback) {
    var prefix = getUrlPrefix(url);
    httpRequest(url,
                {cb:function(status, data) {
                    var hls_version = data.match(/^#.*EXT-X-VERSION:\s*([0-9]+)/m);
                    if (hls_version)
                        hls_version = +hls_version[1];
                    else if (data.match(/^([^#].+\.m3u8.*$)/m)) {
                        url = data.match(/^([^#].+\.m3u8.*$)/m)[1];
                        if (!url.match(/^http/))
                            url = prefix + url;
                        return Player.getHlsVersion(url, callback);
                    }
                    else
                        hls_version = null;
                    callback(hls_version);
                },
                 timeout:2000
                });
};

Player.playVideo = function() {
    // Check requestedUrl to avoid race when Playback has been aborted.
    if (videoUrl == null || requestedUrl == null) {
    // if (videoUrl == null) {
        Log('No videos to play');
    } else {
        Player.plugin.load(videoData);
        Player.setFrontPanelText(Player.FRONT_DISPLAY_PLAY);
        Player.disableScreenSaver();
        Player.initPreviewThumb();

        // Player.plugin.Execute('SetInitialBuffer', 640*1024);
        // Player.plugin.Execute('SetPendingBuffer', 640*1024);
        // Player.plugin.Execute('SetTotalBufferSize', 640*1024);
        if(Audio.plugin.GetUserMute() == 1){
                $('.muteoverlay').show();
        	smute = 1;
        }
        else{
            $('.muteoverlay').hide();
            smute = 0;
        }

        resumeTime = this.getStoredResumeTime();

        delayedPlayTimer = 0;
        if (resumeTime) {
            $('.bottomoverlaybig').html('Press ENTER to resume');
            // Give some extra seconds to resume
            window.clearTimeout(delayedPlayTimer);
            delayedPlayTimer = window.setTimeout(function() {
                                                     delayedPlayTimer = -1;
                                                     Player.playIfReady();
                                                 }, 
                                                 2000
                                                );
        }
        // Fetch subtitles before playback.
        // Seems http requests interfer with start of playback
        Player.srtState = 1;
        Channel.fetchSubtitles(
            videoData.srt_url,
            videoData.hls_subs,
            requestedUrl,
            function() {
                Player.srtState = -1;
                Player.playIfReady();
            }
        );
        this.state = this.PLAYING;

        // work-around for samsung bug. Video player start playing with sound independent of the value of GetUserMute() 
        // GetUserMute() will continue to have the value of 1 even though sound is playing
        // so I set SetUserMute(0) to get everything synced up again with what is really happening
        // once video has started to play I set it to the value that it should be.
        Audio.plugin.SetUserMute(0);
       // Audio.showMute();
    }
};

Player.playIfReady = function() {
    if (Player.srtState == -1) {
        if (startup && startup !== true) {
            // Resuming
            window.clearTimeout(delayedPlayTimer);
            delayedPlayTimer = 0;
            // Can resume have been chosen after delayedPlayTimer expired?
            Player.startPlayback(startup);
        } else if (!delayedPlayTimer || delayedPlayTimer == -1) {
            Player.startPlayback();
        }
    }
};

Player.startPlayback = function(time) {
    Player.plugin.play(Player.isLive, time);
};

Player.togglePause = function() {
    if (this.state === this.PAUSED) {
        Player.resumeVideo();
    } else {
        Player.pauseVideo();
    }
};

Player.pauseVideo = function() {
	window.clearTimeout(osdTimer);
	this.showControls();
	var pp;
	if(Language.getisSwedish()){
		pp='Pausad';
	}else{
		pp='Pause';
	}
	$('.bottomoverlaybig').html(pp);

    Subtitles.pause();
    Player.enableScreenSaver();
    this.state = this.PAUSED;
    Player.setFrontPanelText(Player.FRONT_DISPLAY_PAUSE);
    Player.plugin.pause();
};

Player.stopVideo = function(keep_playing) {
    this.state = this.STOPPED;
    requestedUrl = null;
    Player.hideAction();
    videoActions = {};
    startup = false;
    Subtitles.stop();
    Player.storeResumeInfo();
    Subtitles.clear();
    Subtitles.hide();
    Player.hideVideoBackground();
    window.clearTimeout(delayedPlayTimer);
    loadingStop();
    Player.setFrontPanelText(Player.FRONT_DISPLAY_STOP);
    Player.enableScreenSaver();
    window.clearTimeout(detailsTimer);
    window.clearTimeout(skipTimer);
    this.skipState = -1;
    this.srtState = -1;
    if (Player.plugin)
        Player.plugin.stop();
    if (this.stopCallback) {
        this.stopCallback(keep_playing);
    }
};

Player.resumeVideo = function() {
    Player.disableScreenSaver();
    Player.setFrontPanelText(Player.FRONT_DISPLAY_PLAY);
    this.state = this.PLAYING;
    Player.plugin.resume();
    this.hideDetailedInfo();
    Subtitles.resume();
};

Player.reloadVideo = function(time) {
    if (Player.state == Player.STOPPED)
        return;

    retries = retries+1;
    if (time)
        ccTime = time;
    lastPos = Math.floor((ccTime-Player.offset) / 1000.0);
    Player.disableScreenSaver();
    Player.setFrontPanelText(Player.FRONT_DISPLAY_PLAY);
    Player.plugin.reload(videoData, Player.isLive, lastPos);
    Log('video reloaded url: ' + videoUrl + ' pos: ' + lastPos + ' org time:' + time + ' ccTime:' + ccTime);
    this.state = this.PLAYING;
};

Player.skipInVideo = function() {
    if (startup) {
        // Can't skip yet...
        skipTimer = -1;
        return null;
    }
    Subtitles.clear();
    window.clearTimeout(osdTimer);
    var timediff = +skipTime - +ccTime;

    // Workaround to avoid blocked device during skipBackward near the end.
    if (timediff < 0 && +ccTime > (0.90*Player.GetDuration())) {
        if (Channel.reloadRewind()) {
            skipTimeInProgress = skipTime;
            return Player.reloadVideo(+skipTime);
        }
    }

    Log('skip: ' + timediff);
    Player.plugin.skip(timediff);
    skipTimeInProgress = skipTime;
    Player.hidePreviewThumb();
};

Player.skipForward = function(time) {
    var duration = this.GetDuration();
    if(this.skipState == -1) {
        if (((+ccTime + time) > +duration) && (+ccTime <= +duration)) {
            return this.showInfo(true);
        }
        skipTime = ccTime;
    }
    else if (((+skipTime + time) > +duration) && (+ccTime <= +duration)) {
        // Just restart skipTimer, time will be re-added below
        skipTime = +skipTime - time;
    }
    window.clearTimeout(skipTimer);
    this.showControls();
    skipTime = +skipTime + time;
    this.skipState = this.FORWARD;
    // Log('forward skipTime: ' + skipTime);
    this.updateSeekBar(skipTime, time);
    skipTimer = window.setTimeout(this.skipInVideo, 2000);
};

Player.skipForwardVideo = function() {
    this.skipForward(10*1000);
};

Player.skipLongForwardVideo = function(longMinutes) {
    this.skipForward(longMinutes*60*1000);
};

Player.skipBackward = function(time) {
    window.clearTimeout(skipTimer);
    this.showControls();
    if(this.skipState == -1){
	skipTime = ccTime;
    }
    skipTime = +skipTime - time;
    if(+skipTime < Player.offset){
	skipTime = Player.offset;
    }
    this.skipState = this.REWIND;
    this.updateSeekBar(skipTime, -time);
    skipTimer = window.setTimeout(this.skipInVideo, 2000);
};

Player.skipBackwardVideo = function() {
    this.skipBackward(10*1000);
};

Player.skipLongBackwardVideo = function(longMinutes) {
    this.skipBackward(longMinutes*60*1000);
};

// Global functions called directly by the player 

Player.SetBufferingText = function(percent) {
    var buff = (Language.getisSwedish()) ? 'Buffrar' : 'Buffering';
    buff = (percent) ?  buff + ': ' + percent + '%' : buff;
    $('.bottomoverlaybig').html(buff);
};

Player.OnBufferingStart = function() {
    Log('OnBufferingStart');
    loadingStart();
    this.showControls();
    if ($('.bottomoverlaybig').html().match(/Press ENTER/)) {
        // No Resume
        resumeTime = 0;
    }
    Player.SetBufferingText();
};

Player.OnBufferingProgress = function(percent) {
    Log('OnBufferingProgress: ' + percent + '%');
    // Ignore if received without onBufferingStart. Seems sometimes 
    // it's received after onBufferingComplete.
    if (!Player.infoActive)
        return;
    this.showControls();
    Player.SetBufferingText(percent);
};

Player.OnBufferingComplete = function() {
    Log('OnBufferingComplete');
    $('.bottomoverlaybig').html('');
    retries = 0;
    if (startup && startup !== true && bufferCompleteCount == 0) {
        // Resuming - wait for next buffering complete
        bufferCompleteCount = bufferCompleteCount + 1;
        return;
    }

    Player.selectInitialAudio();

    // Only reset in case no additional skip is in progess
    if (skipTime == skipTimeInProgress) {
        Player.hidePreviewThumb(); // Just in case...
        this.skipState = -1;
        if (this.state == this.PAUSED) ccTime = skipTime;
        skipTime = 0;
        skipTimeInProgress = false;
    }
    if (this.skipState == -1) {
        loadingStop();
        this.hideControls();

        if ($('.video-background').is(':visible'))
            Player.playbackStarted();
    }
};

Player.OnRenderingStart = function() {
    Log('OnRenderingStart');
    if (skipTime && skipTimer == -1)
        skipTimer = window.setTimeout(this.skipInVideo, 0);
    History.addShow(Details.fetchedDetails);
};

Player.OnRenderingComplete = function() {
    Log('OnRenderingComplete');
    Player.storeResumeInfo();
    var keepPlaying = false;
    if (Player.repeat == Player.REPEAT_ONE) {
        keepPlaying = true;
        Player.stopVideo(keepPlaying);
        keepPlaying = (Buttons.playItem() != -1);
    } else if (Player.repeat != Player.REPEAT_OFF) {
        // playNextItem will stop video if there's a next
        keepPlaying = Player.playNext();
    }
    // Check if we need to stop. E.g. no repeat or repeat reached the end.
    if (!keepPlaying)
        Player.stopVideo(keepPlaying);
};

Player.playNext = function() {
    return Buttons.playNextItem(Player.getNextDirection()) != -1;
};

Player.getNextDirection = function() {
    return (Player.repeat == Player.REPEAT_ALL) ? 1 : -1;
};

Player.getResumeList = function() {
    var resumeList = Config.read('resumeList');
    if (!resumeList)
        return [];
    return resumeList;
};

Player.removeResumeInfo = function(key) {
    var resumeList = Player.getResumeList();
    var oldLength = resumeList.length;
    for (var i = 0; i < resumeList.length; i++) {
        if ((key.id && resumeList[i].id==key.id) || resumeList[i].url==key.url) {
            resumeList.splice(i, 1);
            return resumeList;
        }
    }
    return resumeList;
};

Player.storeResumeInfo = function() {
    if (delayedPlayTimer > 0)
        return;
    if (videoData.key && resumeTime > 20 && !Player.isLive) {
        Log('Player.storeResumeInfo, resumeTime:' + resumeTime + ' duration:' + Player.GetDuration() + ' videoData.key:' + JSON.stringify(videoData.key) + ' !Player.isLive:' + !Player.isLive);
        var percentage = Math.floor(100*resumeTime/(Player.GetDuration()/1000));
        // Update history with resumeTime
        History.addShow(Details.fetchedDetails, percentage);
        var resumeList = Player.removeResumeInfo(videoData.key);
        if (percentage < 97) {
            resumeList.unshift({id:videoData.key.id, url:videoData.key.url, time:resumeTime});
            resumeList = resumeList.slice(0,30);
        }
        Config.save('resumeList', resumeList);
        resumeTime = 0;
    }
};

Player.getStoredResumeTime = function() {
    if (!Player.isLive && videoData.key) {
        var resumeList = Player.getResumeList();
        for (var i = 0; i < resumeList.length; i++) {
            if ((videoData.key.id && resumeList[i].id==videoData.key.id) ||
                resumeList[i].url == videoData.key.url) {
                return resumeList[i].time;
            }
        }
    }
    return null;
};

Player.showControls = function(){

    window.clearTimeout(osdTimer);
    if (Player.infoActive)
        return;

    // Refresh just in case
    Details.fetchData(detailsUrl, true);

    Player.pluginDuration = Player.plugin.getDuration();

    if (startup===false && !Player.bw && videoBw != Player.plugin.getBandwith())
        Player.OnStreamInfoReady(true);

    Player.markHighlights();
    Player.infoActive = true;
    if (!startup)
        Player.setResolutionText(Player.GetResolution());
    Player.hideAction();
    $('.topoverlayresolution').show();
    $('.video-wrapper').show();
    $('.video-footer').show();
    if (videoData.previewThumb && this.skipState != -1 && !skipTimeInProgress)
        $('.previewThumb').show();
    else
        Player.hidePreviewThumb();
    this.setClock();
    Subtitles.showControls();
  // Log('show controls');
};

Player.setClock = function() {
    window.clearTimeout(clockTimer);
    clockTimer = setClock($('.topoverlayclock'), Player.setClock);
};

Player.playbackStarted = function() {
    // Log('Player.playbackStarted')
    if (backgroundLoading) {
        $('#outer').hide();
    }
    Player.hideVideoBackground();
    loadingStop();
    this.hideControls();
};

Player.hideControls = function(){
    if (Player.detailsActive)
        return;
    window.clearTimeout(osdTimer);
    window.clearTimeout(clockTimer);
    $('.topoverlayresolution').hide();
    $('.video-wrapper').hide();
    $('.video-footer').hide();
    Player.hidePreviewThumb();
    $('.bottomoverlaybig').html('');
    Player.infoActive = false;
    Subtitles.hideControls();
    if (topOsdLocked) {
        topOsdLocked = false;
        Player.setTopOSDText();
    }
    Player.showAction();
    // Log('hide controls');
};

Player.showDetailedInfo = function(){
    if (Player.detailsActive)
        return;
    // Log('showDetailedInfo');
    Player.detailsActive = true;
    Player.setDetailsData(Details.fetchedDetails);
    $('.details-wrapper').show();
    Player.showControls();
    $('.topoverlaybig').hide();
};

Player.setDetailsData = function(details) {
    $('.detailstitle').html(details.title);
    var extra = '';
    if (details.air_date)
        extra = 'Sändes ' + dateToHuman(details.air_date).toLowerCase() + SEPARATOR;
    if (details.avail_date)
        extra = extra + 'Tillgänglig till ' + dateToHuman(details.avail_date).toLowerCase();
    if (extra != '')
        extra = '<br><br>' + extra;
    $('.detailsdescription').html(details.description + extra);
};

Player.keyReturn = function() {
    if (ccTime!=0 && (Player.detailsActive || Player.infoActive))
        Player.hideDetailedInfo();
    else if ($('.action').is(':visible'))
        Player.hideAction();
    else
	Player.stopVideo();
};

Player.keyEnter = function() {
    if ($('.bottomoverlaybig').html().match(/Press ENTER/)) {
        $('.bottomoverlaybig').html('Resuming');
        startup = resumeTime-10;
        Player.playIfReady();
    } else if (Player.isActionActive('intro')) {
        Player.hideAction();
        skipTime = videoActions.current.end*1000;
        Player.skipState = Player.FORWARD;
        Player.skipInVideo();
    } else if (Player.isActionActive('next')) {
        Player.hideAction();
        Player.playNext();
    } else if(!$('.bottomoverlaybig').html().match(/Resuming/)) {
        Player.togglePause();
    }
};

Player.hideDetailedInfo = function(keepControls){
    // Log('hideDetailedInfo');
    if (Player.detailsActive) {
        Player.detailsActive = false;
        Player.helpActive = false;
        $('.detailstitle').html('');
        $('.detailsdescription').html('');
        $('.details-wrapper').hide();
        $('.topoverlaybig').show();
    }
    if (!keepControls)
        Player.hideControls();
};

Player.GetResolution = function() {
    return Player.plugin.getResolution();
};

Player.SetCurTime = function(time) {
        if (this.state == this.STOPPED)
            return;
	if(startup) {
            if (startup !== true && (time/1000 < (startup-5))) {
                Log('SetCurTime waiting for resume, time:' + time + ' startup:' + startup);
                // resuming - wait
                return;
            }
            Player.playbackStarted();
	    startup = false;
            // work-around for samsung bug. Mute sound first after the player started.
	    Audio.setCurrentMode(smute);
            if (videoData.use_offset || Player.isLive) {
                Player.refreshDetailsTimer();
                if (videoData.use_offset && +Player.start != 0) {
                    Player.updateOffset(Player.start);
                }
            }
            Player.setResolution(Player.GetResolution());
            Player.cachePreviewThumbItems(time);
	} else
            resumeTime = +time/1000;
	ccTime = +time + Player.offset;
	if(this.skipState == -1 && !$('.highlightThumb').is(':visible')) {
	    this.updateSeekBar(ccTime);
	}

        // On 2010 device the device triggers this function even if video is paused
	if (this.state != this.PAUSED && skipTimeInProgress === false && !startup) {
	    Subtitles.setCur(ccTime);
        }
        Player.refreshStartData(Details.fetchedDetails);
        Player.checkActions(time);
        // Seem onStreamInfoReady isn't invoked in case new stream in playlist is chosen.
        // Ignore to check BW since it seems it reacts on new data instead of buffered data. 
        // I.e. it's updated before resolution... 
        // if (Player.GetResolution().width != videoWidth) {
        //     Player.OnStreamInfoReady(true);
        //     Player.updateTopOSD()
        // }
};

Player.updateSeekBar = function(time, skipStep) {
    var tsecs = time / 1000;
    var secs  = Math.floor(tsecs % 60);
    var mins  = Math.floor(tsecs / 60);
    var hours = Math.floor(mins / 60);
    var smins;
    var ssecs;
    var duration;

    mins  = Math.floor(mins % 60);

    if(mins < 10){
	smins = '0' + mins;
    }
    else{
	smins = mins;
    }
    if(secs < 10){
	ssecs = '0' + secs;
    }
    else{
	ssecs = secs;
    }

    $('.currentTime').text(hours + ':' + smins + ':' + ssecs);
    Player.setFrontPanelTime(hours, mins, secs);
    duration = Player.GetDuration();
    var progress = Math.floor(time/duration*100);
    if (progress > 100)
        progress = 100;
    $('.progressfull').css('width', progress + '%');
    Player.updatePreviewThumb(time, progress, skipStep);
    // Display.setTime(time);
    this.setTotalTime(duration);
};

Player.initPreviewThumb = function() {
    $('.previewThumb').hide();
    if (videoData.previewThumb && videoData.previewThumb.type == 'stream' ) {
        $('.previewThumb').css('left', 0);
        $('.previewThumbContainer').css('width', '100%');
        $('.previewThumbContainer').css('height', '100%');
        $('.previewThumbScale').css('zoom', 1);
        $('.previewThumbContainer .previewThumbImg').css('margin', 0);
        $('.previewThumbImg').attr('src', '');
    } else if (videoData.previewThumb) {
        $('.previewThumb').css('left', 0);
        $('.previewThumbContainer').css('width', videoData.previewThumb.width);
        $('.previewThumbContainer').css('height', videoData.previewThumb.height);
        var scale = $('.previewThumb').width()/videoData.previewThumb.width;
        $('.previewThumbScale').css('zoom', Math.round(scale*100)/100);
        $('.previewThumbContainer .previewThumbImg').css('margin', 0);
        if (videoData.previewThumb.src)
            $('.previewThumbImg').attr('src', videoData.previewThumb.src);
        else
            $('.previewThumbImg').attr('src', videoData.previewThumb.items[0].src);
    } else {
        $('.previewThumbImg').attr('src', '');
        if (videoData.previewThumbStream &&
            videoData.previewThumbStream.match('.vtt')) {
            Player.initVttPreviewThumb(videoData.previewThumbStream);
        } else if (videoData.previewThumbStream) {
            var thumbStream = videoData.previewThumbStream;
            httpRequest(thumbStream,
                        {cb:function(status, data) {
                            if (videoData.previewThumbStream == thumbStream)
                                videoData.previewThumbStream = null;
                            thumbStream =
                                Resolution.getHasStreams(thumbStream,
                                                         {responseText: data || ''},
                                                         getUrlPrefix(thumbStream)
                                                        );
                            if (thumbStream.thumb) {
                                videoData.previewThumb = thumbStream.thumb;
                                Player.initPreviewThumb();
                            }
                        }}
                       )
        }
    }
};

Player.initVttPreviewThumb = function(url) {
    httpRequest(url,
                {cb:function(status, data) {
                    var prefix = null;
                    var meta = {};
                    var entry, rows, columns, duration
                    var previous={}, thumb, start;
                    data = data.split(/\n\n/);
                    while (!data[0].match('xywh=')) data.shift();
                    entry = data[0].match(/(^[^  ]+)#xywh=[0-9]+,[0-9]+,([0-9]+),([0-9]+)/m);
                    thumb = entry[1];
                    if (!thumb.match(/^http/)) {
                        prefix = getUrlPrefix(url);
                    };
                    meta = {current:0, width:+entry[2], height:+entry[3]};
                    meta.items = [];
                    for (var i in data) {
                        thumb = data[i].match(/(^[^  ]+)#/m);
                        if (thumb)
                            thumb = thumb[1];
                        else
                            break;
                        if (prefix) thumb = prefix + thumb;
                        start = Subtitles.srtTimeToMS(data[i].split('\n')[0]);
                        if (thumb == previous.src) {
                            if (!meta.duration) {
                                meta.duration = start - previous.start;
                            }
                            continue;
                        }
                        previous = {start:start, src:thumb};
                        meta.items.push({start:start, src:thumb});
                    }
                    loadImage(meta.items[0].src,
                              function(img) {
                                  if (img && !img.failed) {
                                      meta.columns = img.width/meta.width;
                                      meta.rows    = img.height/meta.height;
                                      videoData.previewThumbStream = null;
                                      videoData.previewThumb = meta;
                                      if (meta.items.length > 1)
                                          loadImage(meta.items[1].src);
                                      Player.initPreviewThumb();
                                  }
                              },
                              1000
                             );
                }});
};

Player.updatePreviewThumb = function(time, progress, skipStep) {
    $('.highlightThumb').hide();
    if (videoData.previewThumb && this.skipState != -1) {
        $('.previewThumb').css('left', progress + '%');
        if (videoData.previewThumb.type == 'stream') {
            var img = Player.getPreviewThumStreamIndexUrl(videoData.previewThumb, time);
            if ($('.previewThumbImg').attr('src') == '') {
                loadImage(img,
                          function(data) {
                              if (data && !data.failed) {
                                  var scale = $('.previewThumb').width()/data.width;
                                  $('.previewThumbScale').css('zoom', Math.round(scale*100)/100);
                                  $('.previewThumbImg').attr('src', img);
                                  $('.previewThumb').show();
                              }
                          },
                          1000
                         );
            } else {
                $('.previewThumbImg').attr('src', img);
            }
            // Cache next
            if ((time+skipStep) > 0) {
                img = Player.getPreviewThumStreamIndexUrl(videoData.previewThumb,
                                                          time + skipStep
                                                         );
                loadImage(img);
            }
        } else {
            var preview = videoData.previewThumb;
            if (preview.items) {
                preview = Player.setPreviewThumbItem(time, preview);
                var previewItem = preview.items[preview.current];
                if ($('.previewThumbImg').attr('src') != previewItem.src)
                    $('.previewThumbImg').attr('src', previewItem.src);
                time = time - previewItem.start;
            }
            var index = Math.ceil(time/preview.duration);
            var row = Math.floor(index/preview.columns);
            var column = index % preview.columns;
            if (row < preview.rows) {
                var margin = (-row*preview.height) + 'px 0 0 ' + (-column*preview.width) + 'px';
                $('.previewThumbContainer .previewThumbImg').css('margin', margin);
            }
            $('.previewThumb').show();
        }
    }
};

Player.setPreviewThumbItem = function(time, preview) {
    var next = (preview.current < preview.items.length-1) ? preview.current+1 : null;
    if (time >= preview.items[preview.current].time &&
        (!next || time < preview.items[next].time))
        return preview;
    for (var i in preview.items) {
        if (time >= preview.items[i].start)
            preview.current = +i;
        else {
            loadImage(preview.items[i].src);
            break;
        }
    }
    if (preview.current > 0)
        loadImage(preview.items[preview.current-1].src);
    return preview;
};

Player.cachePreviewThumbItems = function(time) {
    if (videoData.previewThumb.items) {
        var preview = videoData.previewThumb;
        var current = preview.current;
        preview = Player.setPreviewThumbItem(time, preview);
        if (preview.current != current)
            $('.previewThumbImg').attr('src', preview.items[preview.current].src);
        var next = (preview.current < preview.items.length-1) ? preview.current+1 : null;
        if (next) {
            var currentUrl = requestedUrl;
            window.setTimeout(
                function() {
                    if (Player.checkPlayUrlStillValid(currentUrl))
                        Player.cachePreviewThumbItems(ccTime);
                },
                preview.items[next].start - time + 500
            );
        }
    }
};

Player.hidePreviewThumb = function() {
    $('.previewThumb').hide();
    if (videoData.previewThumb && videoData.previewThumb.type == 'stream')
        $('.previewThumbImg').attr('src', '');
};

Player.getPreviewThumStreamIndexUrl = function(previewThumb, time) {
    // Add one extra to ensure we end up before the preview
    var index = Math.round(time/1000/previewThumb.duration) + 1;
    return previewThumb.prefix + index + previewThumb.suffix;
};

Player.markHighlights = function() {
    if (Details.fetchedDetails && Details.fetchedDetails.highlights) {
        var highlights = Details.fetchedDetails.highlights;
        var html = '';
        var position;
        var duration = Player.GetDuration();
        for (var i in highlights) {
            loadImage(highlights[i].thumb);
            position = Math.floor(1000*highlights[i].seconds/duration*100);
            html += '<div class="highlight", style="left:' + position + '%"/>';
        }
        $('.progressempty').html(html);
    } else {
        $('.progressempty').html('');
    }
};

Player.showHighlights = function() {
    if (Player.infoActive && $('.progressempty').html() != '') {
        var highlights = Details.fetchedDetails.highlights;
        var time = skipTime || ccTime;
        for (var i in highlights) {
            if (highlights[i].seconds*1000 <= time)
                highlightsIndex = +i;
            else
                break;
        }
        Player.showHighlightThumb();
        Buttons.setKeyHandleID(3);
        return true;
    }
    return false;
};

Player.exitHighlights = function(no_update) {
    $('.highlightThumb').hide();
    if (Player.skipState == -1) {
        skipTime = 0;
        highlightsIndex = 0;
    }
    Player.refreshOsdTimer(3000);
    if (!no_update) Player.updateSeekBar(ccTime);
    Buttons.setKeyHandleID(2);
};

Player.nextHighlight = function() {
    if (Details.fetchedDetails.highlights[highlightsIndex+1]) {
        highlightsIndex++;
        Player.showHighlightThumb();
    }
};

Player.previousHighlight = function() {
    if (highlightsIndex > 0) {
        highlightsIndex--;
        Player.showHighlightThumb();
    }
};

Player.showHighlightThumb = function() {
    Player.hidePreviewThumb();
    window.clearTimeout(skipTimer);
    window.clearTimeout(osdTimer);
    Player.skipState = -1;
    var highlight = Details.fetchedDetails.highlights[highlightsIndex];
    $('.highlightThumbImg').attr('src', highlight.thumb);
    var name = highlight.name;
    if(name.length > 75){
	name = name.substring(0,75)+ '...';
    }
    $('.highlightThumbText').html(name);
    Player.updateSeekBar(highlight.seconds*1000);
    var progress = Math.floor(highlight.seconds*1000/Player.GetDuration()*100);
    $('.highlightThumb').css('left', progress + '%');
    $('.highlightThumb').show();
};

Player.selectHighlight = function() {
    $('.highlightThumb').hide();
    var highlight = Details.fetchedDetails.highlights[highlightsIndex];
    skipTime = highlight.seconds*1000;
    if (skipTime > ccTime)
        Player.skipState = Player.FORWARD;
    else
        Player.skipState = Player.BACKWARDS;
    Player.hideDetailedInfo(true);
    Player.skipInVideo();
    Player.exitHighlights(true);
};

Player.initActions = function() {
    if (Details.fetchedDetails && ! videoActions.url) {
        var url = requestedUrl;
        var cb = function(actions) {Player.setActions(url, actions);};
        Channel.getActions(Details.fetchedDetails, cb);
        videoActions.url = url
    }
};

Player.setActions = function(url, actions) {
    if (url == videoActions.url) {
        alert(JSON.stringify(actions));
        videoActions.list = actions;
    }
};

Player.checkActions = function(time) {
    Player.initActions();
    Player.checkActionStop(time);
    Player.checkActionStart(time);
};

Player.checkActionStop = function(time) {
    var current = videoActions.current;
    if (current) {
        if (! Player.isWithinAction(time,current)) {
            Player.hideAction();
            delete videoActions['current'];
        }
    }
};

Player.checkActionStart = function(time) {
    if (!videoActions.current && videoActions.list &&
        !Player.detailsActive && !Player.infoActive
       ) {
        for (var i in videoActions.list) {
            var action = videoActions.list[i];
            if (Player.isWithinAction(time, action)) {
                if (action.type == 'next' &&
                    !(myLocation.match('showList.html') &&
                      Buttons.hasNextItem(Player.getNextDirection(), true)
                     )
                   )
                    continue;
                videoActions.current = action;
                Player.showAction();
                break;
            }
        }
    }
};

Player.isWithinAction = function(time, action) {
    return time >= action.start*1000 &&
        (!action.end || time < action.end*1000);
}

Player.showAction = function() {
    if (videoActions.current) {
        window.clearTimeout(actionTimer);
        var text, timeout=10*1000;
        if (videoActions.current.type == 'intro')
            text = 'Skip';
        else if (videoActions.current.type == 'next') {
            if (Player.repeat == Player.REPEAT_ALL ||
                Player.repeat == Player.REPEAT_BACK
               )
                window.setTimeout(function() {
                    if (Player.isActionActive('next'))
                        Player.playNext();
                }, 3000);
            text = 'Next';
        }
        else if (videoActions.current.type == 'info') {
            text = videoActions.current.text;
            timeout = 5*1000;
        }
        $('.action').html(text);
        $('.action').show();
        actionTimer = window.setTimeout(Player.hideAction, timeout);
    }
};

Player.hideAction = function() {
    window.clearTimeout(actionTimer);
    $('.action').hide();
};

Player.isActionActive = function(type) {
    return $('.action').is(':visible') && videoActions.current &&
        videoActions.current.type == type;
};

Player.BwToString = function(bw) {
    if (!bw)
        return null;
    if (Number(bw) >= 1000000) {
        return (Number(bw)/1000000).toFixed(1) + ' mbps';
    } else
        return Math.round(Number(bw)/1000) + ' kbps';
};

Player.OnStreamInfoReady = function(forced) {
    Log('OnStreamInfoReady, forced:' + forced);
    var oldTopOsd = $('.topoverlayresolution').html();
    var resolution = Player.GetResolution();
    videoBw = Player.plugin.getBandwith();
    if (this.bw && videoBw && this.bw != (' ' + Player.BwToString(videoBw)))
        Log('videoBw difference:' + Player.BwToString(videoBw) + this.bw);
    this.setResolution(resolution);

    Player.pluginDuration = Player.plugin.getDuration();
    this.setTotalTime();
    Player.updateTopOSD(oldTopOsd);
    Player.selectInitialAudio();
    Player.initActions();
    Player.markHighlights();
};

Player.selectInitialAudio = function() {
    if (Player.audioIdx == -1) {
        if (Player.plugin.setAudioStream(videoData.audio_idx))
            Player.audioIdx = videoData.audio_idx;
    }
};

Player.setTotalTime = function(duration) {
        duration = duration || this.GetDuration();
	var tsecs = duration / 1000;
	var secs  = Math.floor(tsecs % 60);
	var mins  = Math.floor(tsecs / 60);
        var hours = Math.floor(mins / 60);
	var smins;
	var ssecs;

        mins = Math.floor(mins % 60);
	if(mins < 10){
		smins = '0' + mins;
	}
	else{
		smins = mins;
	}
	if(secs < 10){
		ssecs = '0' + secs;
	}
	else{
		ssecs = secs;
	}
	
	$('.totalTime').text(hours + ':' + smins + ':' + ssecs);
    //Display.setTotalTime(Player.GetDuration());
};

Player.showInfo = function(force) {
    if (!Player.infoActive || force) {
	this.showControls();
        Player.refreshOsdTimer(5000);
    }
    else {
        this.hideControls();
    }

};

Player.showDetails = function() {
    if (!Details.fetchedDetails || Details.fetchedDetails.name == '') {
        // See if update may help...
        Details.fetchData(detailsUrl);
        Player.showInfo();
    } else if (Player.helpActive || !Player.detailsActive) {
        // reset if help is active.
        Player.helpActive = false;
        Player.detailsActive = false;
	this.showDetailedInfo();
        window.clearTimeout(osdTimer);
    } else {
        this.hideDetailedInfo();
    }
};

Player.showHelp = function () {
    if (Player.helpActive) {
        this.hideDetailedInfo();
    } else {
        this.showDetailedInfo();
        $('.detailstitle').html('HELP');
        $('.detailsdescription').html(Player.GetHelpText());
        window.clearTimeout(osdTimer);
        Player.helpActive = true;
    }
};

Player.OnConnectionFailed = function() {
    Log('OnConnectionFailed'); 
    Player.checkHls(function(){Player.OnNetworkDisconnected('Connection Failed!');}, 'OnConnectionFailed');
};

Player.OnNetworkDisconnected = function(text) {
    if (!text) {
        Log('OnNetworkDisconnected'); 
        text = 'Network Error!';
    }
    // Avoid reload loop in case constant failure in the end....
    if (!startup && (Player.GetDuration()-ccTime) < 500)
        Player.OnRenderingComplete();
    else
        Player.retryVideo(text);
};

Player.retryVideo = function (text, max) {
    if (!max)
        max = 1;

    if (retries < max ) {
        // Check if we should reload or not.
        loadingStart();
        $.ajax({type: 'GET',
	        // url: 'http://188.40.102.5/recommended.ashx',
                url: 'http://www.svtplay.se',
	        timeout: 5000,
	        success: function(data, status, xhr) {
                    var time = (resumeTime) ? (resumeTime-10)*1000 : null;
		    Log('Success:' + this.url + ' resumeTime:' + time);
                    $('.bottomoverlaybig').html('Re-connecting'); 
                    Player.showControls();
                    Channel.refreshPlayUrl(function(){Player.reloadVideo(time);});
	        },
	        error: function(XMLHttpRequest, textStatus, errorThrown) {
		    Log('Failure:' + this.url);
                    Player.PlaybackFailed(text);
	        }
	       });
    } else {
        Player.PlaybackFailed(text);
    }

};

Player.OnStreamNotFound = function() {
    Player.PlaybackFailed('OnStreamNotFound');
};

Player.OnRenderError = function(number) {
    // Avoid reload loop in case constant failure in the end....
    if (!startup && (Player.GetDuration()-ccTime) < 500)
        Player.OnRenderingComplete();
    else {
        Log('Player.OnRenderError:' + number);
        var text = 'Can\'t play this. Error: ' + number;
        Player.checkHls(function(){Player.PlaybackFailed(text);}, text);
    }
};

Player.checkHls = function(OtherCalback, text) {
    // Seems stop before OnBufferingStart gives e.g. OnRenderError
    // Can also happen in case 'resume' is chosen too late...
    if (Player.state != Player.STOPPED && delayedPlayTimer != -1) {
        if (videoData.component=='HLS' && !videoUrl.match(/\/downgradehls\//)) {
            var thisVideoUrl = videoUrl;
            Player.getHlsVersion(videoUrl.replace(/\|.+/,''),
                                 function(hls_version) {
                                     if (hls_version && hls_version > 3) {
                                         var text = 'HLS Version ' + hls_version + ' unsupported.';
                                         Player.PlaybackFailed(text);
                                     } else {
                                         OtherCalback();
                                     }
                                 }
                                );
        } else {
            OtherCalback();
        }
    }
};

Player.OnAuthenticationFailed = function() {
    Player.PlaybackFailed('OnAuthenticationFailed');
};

Player.PlaybackFailed = function(text) {
    Log('Player.PlaybackFailed:' + text);
    $('.bottomoverlaybig').html(text);
    if (!Channel.tryAltPlayUrl(videoUrl,
                               function(){
                                   Log('Trying alternative');
                                   $('.bottomoverlaybig').html('Trying alternative stream');
                                   if (startup && startup !== true) {
                                       var altResumeTime = Player.getStoredResumeTime();
                                       if (altResumeTime && altResumeTime != resumeTime) {
                                           resumeTime = altResumeTime;
                                           startup = resumeTime-10;
                                       }
                                       Player.reloadVideo(startup*1000);
                                   } else
                                       Player.reloadVideo();
                               }
                              )) {
        loadingStop();
        Player.showControls();
        Player.enableScreenSaver();
    }
};

Player.GetDuration = function() {
    if (!this.sourceDuration && 
        Details.fetchedDetails && 
        Details.fetchedDetails.duration
       )
        Player.setDuration(Details.fetchedDetails.duration);

    var duration = this.sourceDuration;
    if (Player.plugin) {
        if (!Player.pluginDuration) {
            Player.pluginDuration = Player.plugin.getDuration() || 1;
        }
        duration = Player.pluginDuration - Player.durationOffset;
    }

    if (this.sourceDuration > duration)
        duration = this.sourceDuration;

    if (ccTime > duration) 
        duration = ccTime;

    return duration;
};

Player.toggleRepeat = function() {

    this.repeat = (this.repeat+1) % (Player.REPEAT_ONE+1);
    this.updateTopOSD();
};

Player.IsAutoBwUsedFor2011 = function() {
    // During 'AUTO Bandwith' resolution can change which isn't reported to 2011 devices.
    return (deviceYear == 2011 && Player.bw == '');
};

Player.setTopOSDText = function(init_text) {
    if (topOsdLocked) return;
    var resolution_text = init_text;
    if (Player.IsAutoBwUsedFor2011()) {
        resolution_text = '';
    } else if (resolution_text == undefined) {
        resolution_text = $('.topoverlayresolution').html().replace(/^([^)]+\)(.*bps)?)*.*/, '$1');
    }
    resolution_text = resolution_text + this.getAspectModeText() + this.getRepeatText();
    $('.topoverlayresolution').html(resolution_text.replace(/^(&nbsp;)+/,''));
};

Player.updateTopOSD = function(oldTopOsd) {
    Player.setTopOSDText();
    if (!oldTopOsd || (oldTopOsd != $('.topoverlayresolution').html())) {
        if ($('.topoverlayresolution').is(':hidden')) {
            $('.topoverlayresolution').show();
            Player.refreshOsdTimer(3000);
        }
    }
};

Player.lockTopOSDText = function(text) {
    $('.topoverlayresolution').html(text);
    $('.topoverlayresolution').show();
    topOsdLocked = true;
    Player.refreshOsdTimer(3000);
};

Player.toggleAspectRatio = function() {

    Player.plugin.toggleAspectRatio();
    this.setAspectRatio(Player.GetResolution());
    // Update OSD
    this.updateTopOSD();
    if (this.IsAutoBwUsedFor2011())
        $('.topoverlayresolution').html('ASPECT unsupported when AUTO BW');
};

Player.toggleAudio = function() {
    if (videoData.audio_streams && videoData.audio_streams.length > 0) {
        var result = '';
        if (videoData.audio_streams.length > 1) {
            Player.audioIdx = (Player.audioIdx+1) % videoData.audio_streams.length;
            if (!Player.plugin.setAudioStream(Player.audioIdx))
                result = ' failed';
        }
        Player.lockTopOSDText(videoData.audio_streams[Player.audioIdx]+result);
    }
};

Player.setResolution = function (resolution) {
    this.setAspectRatio(resolution);
    Player.setResolutionText(resolution);
};

Player.setResolutionText = function (resolution) {
    if (resolution.width  > 0 && resolution.height > 0) {
        var aspect = resolution.width / resolution.height;
        if (aspect == 16/9) {
            aspect = '16:9';
        } else if (aspect == 4/3) {
            aspect = '4:3';
        }
        else {
            aspect = aspect.toFixed(2) + ':1';
        }
        // Only use given bw in case of 'Auto-mode'
        var bw = (this.bw || !videoBw) ? this.bw : ' ' + Player.BwToString(videoBw);
        Player.setTopOSDText(resolution.width + 'x' + resolution.height + ' (' + aspect + ')' + bw);
    } else {
        Log('Missing resolution: ' + resolution.width + 'x' + resolution.height);
    }
};

Player.setAspectRatio = function(resolution) {
    Player.plugin.setAspectRatio(resolution);
};

Player.getAspectModeText = function() {
    var text = Player.plugin.getAspectModeText();
    if (text == '')
        return text;
    else
        return SEPARATOR + text;
};

Player.isZoomAspect = function() {
    return Player.plugin.isZoomAspect && Player.plugin.isZoomAspect();
};

Player.changeZoom = function(increase) {
    Player.plugin.changeZoom(increase);
    Player.setAspectRatio(Player.GetResolution());
    Player.updateTopOSD();
};

Player.getRepeatText = function() {
    if (this.repeat === Player.REPEAT_OFF) {
        return '';
    } else if (this.repeat === Player.REPEAT_ONE) {
        return SEPARATOR + 'Repeat ONE';
    } else if (this.repeat === Player.REPEAT_ALL) {
        return SEPARATOR + 'Repeat ALL';
    } else if (this.repeat === Player.REPEAT_BACK) {
        return SEPARATOR + 'Repeat BACKWARDS';
    }
};

Player.createPlugin = function() {
    if (!Player.plugin) {
        Player.plugin = SefPlayer;
        Player.plugin.create();
        fpPlugin = document.getElementById('pluginFrontPanel');

        var mwPlugin = document.getElementById('pluginObjectTVMW');
        if (mwPlugin) {
            /* Save current TV Source */
            this.originalSource = mwPlugin.GetSource();
            /* Set TV source to media player plugin */
            mwPlugin.SetMediaSource();
        }
    }
};

Player.startPlayer = function(url, isLive, start) {
    var oldKeyHandleID = Buttons.getKeyHandleID();
    var background     = itemSelected.find('.ilink').attr('data-background');

    Buttons.setKeyHandleID(2);

    startup = true;
    retries = 0;
    window.clearTimeout(detailsTimer);
    Player.start = start;
    Player.isLive = isLive;
    Player.offset = 0;
    Player.durationOffset = 0;
    Player.pluginDuration = 0;
    Player.audioIdx = 0;

    videoUrl = '';
    ccTime = 0;
    lastPos = 0;
    videoBw = null;
    videoData = {};
    videoActions = {};
    bufferCompleteCount = 0;
    Player.skipState = -1;
    Player.srtState = -1;
    skipTime = 0;
    skipTimeInProgress = false;
    skipTimer = null;
    highlightsIndex = 0;
    topOsdLocked = false;
    this.hideDetailedInfo();
    if (Player.plugin)
        Player.plugin.stop();
    Player.createPlugin();
    Player.setTopOSDText('');
    $('.currentTime').text('');
    $('.totalTime').text('');
    $('.progressfull').css('width', 0);
    $('.progressempty').html('');
    Player.setVideoBackground(background);
    if (!$('.bottomoverlaybig').html().match(/Trying alternative/))
        $('.bottomoverlaybig').html('');
    Player.stopCallback = function(keep_playing) {
        if (!keep_playing) {
	    $('#outer').show();
            Player.hideDetailedInfo();
        }
	Buttons.setKeyHandleID(oldKeyHandleID);
    };
    Player.initPlayback(url, isLive);
};

Player.initPlayback = function(url, isLive) {
    if (!Channel.redirectUrl(url, function(newUrl) {
        Player.initPlayback(newUrl, isLive);
    })) {
        requestedUrl = detailsUrl = url;
        Channel.getPlayUrl(url, isLive);
        Details.fetchData(url);
    }
};

Player.setVideoBackground = function(img) {

    Player.hideVideoBackground();
    var complete = function() {
        if (!$('.bottomoverlaybig').html().match(/error/i))
            // Avoid in case of internal errors.
            loadingStart();
        $('#outer').hide();
        Player.showControls();
    };
    if (img) {
        alert('Background:' + img);
        $('.video-background').html('<img class="image" src="' + img  + '"/>');
        backgroundLoading = true;
        window.setTimeout(function () {
            if (backgroundLoading)
                complete();
        }, 300);
        loadImage(img,
                  function() {
                      if (backgroundLoading) {
                          $('.video-background').show();
                          complete();
                          backgroundLoading = false;
                      }
                  },
                  1000
                 );
    } else
        complete();
};

Player.hideVideoBackground = function() {
    backgroundLoading = false;
    $('.video-background').hide();
    $('.video-background').html('');
};

Player.refreshStartData = function(details) {
    if (videoData.use_offset && details && details.start != 0 && details.start != Player.start) {
        Log('refreshStartData, new start:' + details.start + ' old start:' + Player.start);
        Player.setNowPlaying(details.title);
        Player.pluginDuration = Player.plugin.getDuration();
        Player.setDuration(details.duration);
        Player.updateOffset(details.start);
        Player.setDetailsData(details);
    } else if (!Player.sourceDuration && details.duration)
        Player.setDuration(details.duration);
};

Player.updateOffset = function (start) {
    var start_mins     = Player.startToMinutes(start);
    var old_start_mins = Player.startToMinutes(Player.start);
    var diff_mins      = 0;
    if (old_start_mins != 0) {
        diff_mins = start_mins - old_start_mins;
        if (old_start_mins > start_mins)
            // Time passed midnight
            diff_mins = diff_mins + 24*60;
    }
    if (diff_mins > 0) {
        Log('New start:' + start + ' old:' + Player.start + ' diff:' + diff_mins + ' offset:' + Player.offset + ' durationOffset:' + Player.durationOffset);

        Player.offset = Player.offset - (diff_mins*60*1000);
        Player.durationOffset = Player.durationOffset + (diff_mins*60*1000);
        Log('New offset:' + Player.offset + ' new durationOffset:' + Player.durationOffset);
    } else {
        var now = getCurrentDate();
        var now_secs = (now.getHours()*3600) + (now.getMinutes()*60) + now.getSeconds();

        if ((start_mins*60) > now_secs)
            // Time passed midnight
            now_secs = now_secs + (24*3600);
        Player.offset = (now_secs - (start_mins*60))*1000;
    }
    Player.start = start;
};

Player.startToMinutes = function (start) {
    if (!start)
        return 0;
    var start_mins = start.match(/([0-9]+)[:.]/)[1]*60;
    return (start_mins + start.match(/[:.]([0-9]+)/)[1]*1);
};

Player.checkPlayUrlStillValid = function(gurl) {
    if (requestedUrl != gurl) {
        Log('gurl skipped:' + gurl + ' requestedUrl:' + requestedUrl);
        return false;
    }
    return true;
};

Player.hasSubtitles = function() {
    return Player.plugin.hasSubtitles();
};

Player.refreshOsdTimer = function(value) {
    window.clearTimeout(osdTimer);
    if (!Player.detailsActive)
        osdTimer = window.setTimeout(this.hideControls, value);
};

Player.refreshDetailsTimer = function() {
    window.clearTimeout(detailsTimer);
    detailsTimer = window.setTimeout(function () {
        Details.fetchData(detailsUrl, true);
        Player.refreshDetailsTimer();
    }, 1*60*1000);
};

Player.enableScreenSaver = function() {
    pluginAPI.setOnScreenSaver(5*60);
};

Player.disableScreenSaver = function() {
    pluginAPI.setOffScreenSaver();
};

Player.internalError = function(err) {
    if (startup && !videoUrl)
        // Error during stream fetching?
        Player.PlaybackFailed('Internal Error:' + err);
};

Player.GetHelpText = function() {
    var help = '<table style="margin-bottom:40px;width:100%;border-collapse:collapse;margin-left:auto;margin-right:auto;">';
    help = InsertHelpRow(help, 'INFO', 'Details');
    help = InsertHelpRow(help, 'RED', 'Repeat');
    help = InsertHelpRow(help, 'GREEN', 'Audio');
    help = InsertHelpRow(help, 'YELLOW', 'Subtitles');
    help = InsertHelpRow(help, 'BLUE', 'Aspect');
    help = InsertHelpRow(help, 'UP/DOWN', 'Subtitles Position/Zoom Level');
    help = InsertHelpRow(help, '2/8', 'Subtitles Size');
    help = InsertHelpRow(help, '4/6', 'Subtitles Distance (when background is enabled)');
    return help + '</table>';
};

function InsertHelpRow(Html, Key, Text) {
    var style =' style="padding:4px;border: 1px solid white;"';
    return Html+'<tr><td'+style+'>'+Key+'</td><td'+style+'>'+Text+'</td></tr>';
}
