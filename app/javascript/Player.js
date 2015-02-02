var buff;
var skipTime = 0;
var timeoutS;
var pluginAPI;
var ccTime = 0;
var lastPos = 0;
var videoUrl;
var startup = true;
var smute = 0;
var subtitles = [];
var subtitlesEnabled = false;
var currentSubTime = 0;
var currentSubtitle = -1;
var subtitleTimer = 0;
var seqNo = 0;

var Player =
{
    plugin : null,
    state : -1,
    skipState : -1,
    stopCallback : null,    /* Callback function to be set by client */
    originalSource : null,
    sourceDuration: 0,
    infoActive:false,
    
    STOPPED : 0,
    PLAYING : 1,
    PAUSED : 2,  
    FORWARD : 3,
    REWIND : 4
};

Player.init = function()
{
    var success = true;
    
    this.state = this.STOPPED;
    pluginAPI = new Common.API.Plugin();
    this.plugin = document.getElementById("pluginPlayer");
    
    if (!this.plugin)
    {
         success = false;
    }
    else
    {
        var mwPlugin = document.getElementById("pluginTVMW");
        
        if (!mwPlugin)
        {
            success = false;
        }
        else
        {
            /* Save current TV Source */
            this.originalSource = mwPlugin.GetSource();
            
            /* Set TV source to media player plugin */
            mwPlugin.SetMediaSource();
        }
    }
    
  //  this.setWindow();
    
    this.plugin.OnCurrentPlayTime = 'Player.setCurTime';
    this.plugin.OnStreamInfoReady = 'Player.onStreamInfoReady';
    this.plugin.OnBufferingStart = 'Player.onBufferingStart';
    this.plugin.OnBufferingProgress = 'Player.onBufferingProgress';
    this.plugin.OnBufferingComplete = 'Player.onBufferingComplete';           
    this.plugin.OnRenderingComplete  = 'Player.onRenderingComplete'; 
    this.plugin.OnNetworkDisconnected = 'Player.OnNetworkDisconnected';
    this.plugin.OnConnectionFailed = 'Player.OnNetworkDisconnected';
    return success;
};

Player.deinit = function()
{
        if (this.plugin)
            Player.plugin.Stop();
        var mwPlugin = document.getElementById("pluginTVMW");
        
        if (mwPlugin && (this.originalSource != null) )
        {
            /* Restore original TV source before closing the widget */
            mwPlugin.SetSource(this.originalSource);
            Log("Restore source to " + this.originalSource);
        }
};

Player.setWindow = function()
{
	//this.plugin.SetDisplayArea(0, 0, 960, 540);
    this.plugin.SetDisplayArea(0, 0, 1, 1);
};

Player.setFullscreen = function()
{
    this.plugin.SetDisplayArea(0, 0, 960, 540);
};

Player.setVideoURL = function(url, srtUrl)
{
    videoUrl = url;
    Log("URL = " + videoUrl);
};

Player.setDuration = function(duration)
{
    if (duration.length > 0) 
    {
        var h = GetDigits("h", duration);
        var m = GetDigits("min", duration);
        var s = GetDigits("sek", duration);
        // Log("decoded duration " + h + ":" + m + ":" + s);
        this.sourceDuration = (h*3600 + m*60 + s*1) * 1000;
    }
    else
    {
        this.sourceDuration = 0;
    }
    // Log("Player.sourceDuration: " + this.sourceDuration);

};

GetDigits = function(type, data)
{

    var regexp1 = new RegExp("^(\\d+) " + type + ".*");
    var regexp2 = new RegExp("^.*\\D+(\\d+) " + type + ".*");
    if (data.search(regexp1) != -1)
        return data.replace(regexp1, "$1");
    else if (data.search(regexp2) != -1)
        return data.replace(regexp2, "$1");
    else
        return "0"
};

Player.playVideo = function()
{
    if (videoUrl == null)
    {
        Log("No videos to play");
    }
    else
    {
	pluginAPI.setOffScreenSaver();
        this.state = this.PLAYING;
 
        this.setWindow();
        
        this.plugin.SetInitialBuffer(640*1024);
        this.plugin.SetPendingBuffer(640*1024);
        startup = true;
        if(Audio.plugin.GetUserMute() == 1){
        	$('.muteoverlay').css("display", "block");
        	smute = 1;
        }
        else{
            $('.muteoverlay').css("display", "none");
            smute = 0;
        }
        this.plugin.Play( videoUrl );
        // work-around for samsung bug. Video player start playing with sound independent of the value of GetUserMute() 
        // GetUserMute() will continue to have the value of 1 even though sound is playing
        // so I set SetUserMute(0) to get everything synced up again with what is really happening
        // once video has started to play I set it to the value that it should be.
        Audio.plugin.SetUserMute(0);
        
       // Audio.showMute();
    }
};

Player.pauseVideo = function()
{
	window.clearTimeout(timeout);
	this.showControls();
	$('.bottomoverlaybig').css("display", "block");
	var pp;
	if(Language.getisSwedish()){
		pp='Pausad';
	}else{
		pp='Pause';
	}
	$('.bottomoverlaybig').html(pp);

    this.state = this.PAUSED;
    this.plugin.Pause();
};

Player.stopVideo = function()
{
        widgetAPI.putInnerHTML(document.getElementById("srtSubtitle"), "");
        this.plugin.Stop();
		//pluginAPI.set0nScreenSaver(6000);
        $('.topoverlayresolution').html("");
        if (this.stopCallback)
        {
            this.stopCallback();
        }
    
};

Player.stopVideoNoCallback = function()
{
    if (this.state != this.STOPPED)
    {

        this.plugin.Stop();
        
        
    }
    else
    {
        Log("Ignoring stop request, not in correct state");
    }
};

Player.resumeVideo = function()
{
	//this.plugin.ResumePlay(vurl, time);
    this.state = this.PLAYING;
    this.plugin.Resume();
	this.hideControls();
};

Player.reloadVideo = function()
{
	this.plugin.Stop();
	lastPos = Math.floor(ccTime / 1000.0);
	this.plugin.ResumePlay(videoUrl, lastPos);
	Log("video reloaded. url = " + videoUrl + "pos " + lastPos );
    this.state = this.PLAYING;
	this.hideControls();
};

Player.skipInVideo = function()
{
    window.clearTimeout(timeout);
    Player.skipState = -1;
    var timediff = +skipTime - +ccTime;
    timediff = timediff / 1000;
    if(timediff > 0){
    	Player.plugin.JumpForward(timediff);
    	Log("forward jump: " + timediff);
    }
    else if(timediff < 0){
    	timediff = 0 - timediff;
    	Player.plugin.JumpBackward(timediff);
    }
    timeout = window.setTimeout(this.hideControls, 5000);
};

Player.skipForward = function(time)
{
    widgetAPI.putInnerHTML(document.getElementById("srtSubtitle"), ""); //hide subs while we jump
    var duration = this.GetDuration();
    if(this.skipState == -1)
    {
        if (((+ccTime + time) > +duration) && (+ccTime <= +duration))
        {
            return this.showInfo(true);
        }
        skipTime = ccTime;
    }
    else if (((+skipTime + time) > +duration) && (+ccTime <= +duration))
    {
        return -1
    }
    window.clearTimeout(timeoutS);
    this.showControls();
    skipTime = +skipTime + time;
    this.skipState = this.FORWARD;
    Log("forward skipTime: " + skipTime);
    this.updateSeekBar(skipTime);
    timeoutS = window.setTimeout(this.skipInVideo, 2000);
};

Player.skipForwardVideo = function()
{
    this.skipForward(30000);
};

Player.skipLongForwardVideo = function()
{
    this.skipForward(5*60*1000);
};

Player.skipBackward = function(time)
{
    widgetAPI.putInnerHTML(document.getElementById("srtSubtitle"), ""); //hide subs while we jump
    window.clearTimeout(timeoutS);
    this.showControls();
    if(this.skipState == -1){
	skipTime = ccTime;
    }
    skipTime = +skipTime - time;
    if(+skipTime < 0){
	skipTime = 0;
    }
    this.skipState = this.REWIND;
    this.updateSeekBar(skipTime);
    timeoutS = window.setTimeout(this.skipInVideo, 2000);
};

Player.skipBackwardVideo = function()
{
    this.skipBackward(30000);
};

Player.skipLongBackwardVideo = function()
{
    this.skipBackward(5*60*1000);
};

Player.getState = function()
{
    return this.state;
};

// Global functions called directly by the player 

Player.onBufferingStart = function()
{
    Log("onBufferingStart");
    currentSubtitle = 0;
    subtitlesEnabled = this.getSubtitlesEnabled();
    this.setSubtitleProperties();
    this.showControls();
    $('.bottomoverlaybig').css("display", "block");
	if(Language.getisSwedish()){
	buff='Buffrar';
	}else{
	buff='Buffering';
	}
	$('.bottomoverlaybig').html(buff+': 0%');
};

Player.onBufferingProgress = function(percent)
{
	if(Language.getisSwedish()){
	buff='Buffrar';
	}else{
	buff='Buffering';
	}
  this.showControls();
  $('.bottomoverlaybig').css("display", "block");
  $('.bottomoverlaybig').html(buff+': ' + percent + '%');

};

Player.onBufferingComplete = function()
{
	if(Language.getisSwedish()){
	buff='Buffrar';
	}else{
	buff='Buffering';
	}
	this.hideControls();
	$('.bottomoverlaybig').html(buff+': 100%');
	this.setFullscreen();
//	this.setWindow();
   //$('.loader').css("display", "none");
};

Player.onRenderingComplete = function()
{
	Player.stopVideo();
};

Player.showControls = function(){
  $('.video-wrapper').css("display", "block");				
  $('.video-footer').css("display", "block");
  Log("show controls");

};

Player.hideControls = function(){
	$('.video-wrapper').css("display", "none");				
	$('.video-footer').css("display", "none");
	$('.bottomoverlaybig').css("display", "none");
        Player.infoActive = false;
	Log("hide controls");
};

Player.setCurTime = function(time)
{
	// work-around for samsung bug. Mute sound first after the player started.
	if(startup){
		startup = false;
		Audio.setCurrentMode(smute);
	}
	ccTime = time;
	if(this.skipState == -1){
		this.updateSeekBar(time);
	}
	if (this.state != this.PAUSED) { // because on 2010 device the device triggers this function even if video is paused
		this.onSubTitle(time);
        }
	
};

Player.updateSeekBar = function(time){
	var tsecs = time / 1000;
	var secs  = Math.floor(tsecs % 60);
	var mins  = Math.floor(tsecs / 60);
        var hours = Math.floor(mins / 60);
	var smins;
	var ssecs;

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
	
        var progressFactor = time / Player.GetDuration();
        if (progressFactor > 1)
            progressFactor = 1;
	var progress = Math.floor(960 * progressFactor);
	$('.progressfull').css("width", progress);
	$('.progressempty').css("width", 960 - progress);
   // Display.setTime(time);
   this.setTotalTime();
	
}; 

Player.onStreamInfoReady = function()
{
    this.setTotalTime();
    this.setResolution(this.plugin.GetVideoWidth(), this.plugin.GetVideoHeight());
};

Player.setTotalTime = function()
{
	var tsecs = this.GetDuration() / 1000;
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

Player.showInfo = function(force)
{
    window.clearTimeout(timeout);
    if (!Player.infoActive || force) {
	this.showControls();
	//$('.bottomoverlaybig').css("display", "block");
	timeout = window.setTimeout(this.hideControls, 5000);
        Player.infoActive = true;
    }
    else
    {
        this.hideControls();
    }

};

Player.OnNetworkDisconnected = function()
{
	this.showControls();
	$('.bottomoverlaybig').css("display", "block");
	$('.bottomoverlaybig').html('Network Error!');
	// just to test the network so that we know when to resume
	 $.ajax(
			    {
			        type: 'GET',
			        // url: 'http://188.40.102.5/recommended.ashx',
                                url: 'http://www.svtplay.se/populara?sida=1',
					timeout: 10000,
			        success: function(data)
			        {
			        	
			        	var $entries = $(data).find('video');

			        	if ($entries.length > 0) {
			        		Log('Success:' + this.url);
			        		Player.reloadVideo();
			        	}
			        	else{
			        		Log('Failure');
			        		$.ajax(this);
			        	}
			        },
			        error: function(XMLHttpRequest, textStatus, errorThrown)
			        {
			        		Log('Failure');
			        		$.ajax(this);
         
			        }
			    });
};

Player.GetDuration = function()
{
    var duration = this.plugin.GetDuration()

    if (duration > this.sourceDuration)
        return duration;
    else
        return this.sourceDuration;
};

Player.toggleAspectRatio = function() {

    if (this.getAspectMode() === 0) {
        this.setAspectMode(1);
    }
    else 
    {
        this.setAspectMode(0);
    }
    this.setAspectRatio(this.plugin.GetVideoWidth(), this.plugin.GetVideoHeight());

    // Update OSD
    var resolution_text = $('.topoverlayresolution').text().replace(/\).*/, ")");
    $('.topoverlayresolution').html(resolution_text + this.getAspectModeText());

    if (this.state === this.PAUSED) {
        this.pauseVideo();
    }
};

Player.setResolution = function (videoWidth, videoHeight) {

    if (videoWidth  > 0 && videoHeight > 0) {
        var aspect = videoWidth / videoHeight;
        if (aspect == 16/9) {
            aspect = "16:9";
        } else if (aspect == 4/3) {
            aspect = "4:3";
        }
        else {
            aspect = aspect.toFixed(2) + ":1";
        }
	$('.topoverlayresolution').html(videoWidth + "x" + videoHeight + " (" + aspect + ")" + this.getAspectModeText());
        this.setAspectRatio(videoWidth, videoHeight);
    }
};

Player.setAspectRatio = function(videoWidth, videoHeight) {

    if (videoWidth > 0 && videoHeight > 0) {
        if (Player.getAspectMode() === 1 && videoWidth/videoHeight > 4/3)
        {
            var cropX     = Math.round(videoWidth/960*120);
            var cropWidth = videoWidth-(2*cropX);
            this.plugin.SetCropArea(cropX, 0, cropWidth, videoHeight);
        }
        else
        {
            this.plugin.SetCropArea(0, 0, videoWidth, videoHeight);
        }
    }
};

Player.setAspectMode = function(value)
{
    this.setCookie("aspectMode",value);
};


Player.getAspectMode = function(){
    var savedValue = this.getCookie("aspectMode");
    if (savedValue)
        return savedValue*1;
    else
        return 0;
};

Player.getAspectModeText = function()
{
    if (this.getAspectMode() === 1) {
        return " H-FIT";
    }
    else 
        return "";
};

// Subtitles support

Player.toggleSubtitles = function () {
    if (subtitles.length > 0)
        subtitlesEnabled = !subtitlesEnabled;
    else 
        subtitlesEnabled = true;

    this.setCookie("subEnabled",subtitlesEnabled*1, 100);
    if (!subtitlesEnabled || $("#srtSubtitle").html() == "" || $("#srtSubtitle").html() == "<br />Subtitles Off") {
        clearTimeout(subtitleTimer);
        subtitleTimer = setTimeout(function () {
            widgetAPI.putInnerHTML(document.getElementById("srtSubtitle"), "");
        }, 2500);
        if (subtitlesEnabled && subtitles.length > 0) {
            $("#srtSubtitle").html("<br />Subtitles On");
        } else if (subtitlesEnabled) {
            $("#srtSubtitle").html("<br />Subtitles not available");
        } else {
            $("#srtSubtitle").html("<br />Subtitles Off");
        }
    }
};

Player.getSubtitlesEnabled = function () {
    var savedValue = this.getCookie("subEnabled");
    if (savedValue) {
        // To reduce risk of setting being cleared
        this.setCookie("subEnabled",(savedValue == "1")*1, 100);
        return savedValue == "1";
    } else {
        return false;
    }
};

Player.getCookie = function(cName){
    var i,x,y,ARRcookies=document.cookie.split(";");
    for (i=0;i<ARRcookies.length;i++)
    {
        x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
        y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
        x=x.replace(/^\s+|\s+$/g,"");
        if (x==cName)
        {
            return unescape(y);
        }
    }
    return null;
};

Player.setCookie = function(cName,value,exdays)
{
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
    document.cookie=cName + "=" + c_value;
};


Player.fetchSubtitle = function (srtUrl) {
    var subtitleXhr = new XMLHttpRequest();

    subtitleXhr.onreadystatechange = function () {
        if (subtitleXhr.readyState === 4) {
            if (subtitleXhr.status === 200) {
                Player.parseSubtitle(subtitleXhr);
                subtitleXhr.destroy();
                subtitleXhr = null;
            }
        }
    };
    subtitleXhr.open("GET", srtUrl);
    subtitleXhr.send();
};

Player.parseSubtitle = function (xhr) {
    var srt;
    var srtdata;
    srtdata = xhr.responseText;
    srt = this.strip(srtdata.replace(/\r\n|\r|\n/g, '\n').replace(/<\/*[0-9]+>/g, ""));
    var srtline = srt.split('\n\n');
    if (srtline.length > 0) {
        for (var s = 0; s < srtline.length; s++) {
            var st = srtline[s].split('\n');
            this.parseLine(st);
        }
    }
};

Player.strip = function (s) {
    return s.replace(/^\s+|\s+$/g, "");
};

Player.timeToMS = function (t) {
    var s = 0.0;
    if (t) {
        var p = t.split(':');
        for (var i = 0; i < p.length; i++)
            s = s * 60 + parseFloat(p[i].replace(',', '.'));
    }
    return Math.round(s * 1000);
};

Player.parseLine = function (st) {
    try {
        if (st.length >= 2) {
            var i = this.strip(st[1].split(' --> ')[0]);
            var o = this.strip(st[1].split(' --> ')[1]);
            var t = st[2];

            if (isEmpty(i) || isEmpty(o) || isEmpty(t)) {
                return false;
            }

            if (st.length > 2) {
                for (var j = 3; j < st.length; j++) {
                    t += '<br>' + st[j];
                }
            }

            var start = this.timeToMS(i);
            var end = this.timeToMS(o);

            if (t.length > 0) {
                var newsub = {
                    start: start,
                    end: end,
                    text: t
                };
                subtitles.push(newsub);
            }
        }
    }
    catch (err) {
        Log("parseLine on Subtitles failed: [" + err + "] in line : " + st);
    }
};

Player.onSubTitle = function (time) {
    try {
        if (subtitlesEnabled && this.state != this.STOPPED) {
            var start;
            var stop;
            var now = Number(time);

            if (now === currentSubTime) {
                now += 500;
            }

            currentSubTime = now;

            for (var i = currentSubtitle; i < subtitles.length; i++) {
                if (subtitles[i]) {
                    start = Number(subtitles[i].start);
                    stop = Number(subtitles[i].end);
                    // Log("i:" + i + " start:" + start + " stop:" + stop + " now:" + now);
                    if ((start <= now) && (now < stop)) {
                        if (currentSubtitle != i || currentSubtitle === 0) {
                            this.OnSubtitleTimeHandler(subtitles[i].text, stop-now);
                            currentSubtitle = i;
                        }
                        break;
                    } else {
                        stop = Number(subtitles[currentSubtitle].end);
                        if (subtitles[i + 1] && subtitles[i + 1].start > now) {
                            //do we need to hide the current subtitle?
                            if (now > stop) {
                                // Log("Clearing srt due to next, start:" + subtitles[i + 1].start);
                                widgetAPI.putInnerHTML(document.getElementById("srtSubtitle"), "");
                            }
                            break;
                        } else if (now > stop) {
                            // Log("Clearing srt due to end");
                            widgetAPI.putInnerHTML(document.getElementById("srtSubtitle"), "");
                        }
                    }
                }
            }
        } else {
            widgetAPI.putInnerHTML(document.getElementById("srtSubtitle"), "");
        }
    } catch (err) {
        Log("Error displaying subtitle: " + err);
    }
};

Player.OnSubtitleTimeHandler = function (subline, timeout) {
    try {
        if (subtitlesEnabled === false || isEmpty(subline)) {
            widgetAPI.putInnerHTML(document.getElementById("srtSubtitle"), "");
            return false;
        }

        var t = subline;
        t = t.replace(/\n\r/g, "<br />");
        t = t.replace(/\r\n/g, "<br />");
        t = t.replace(/\n/g, "<br />");
        t = t.replace(/\r/g, "<br />");
        t = t.replace(/<BR>/g, "<br />");
        t = t.replace(/<BR \/>/g, "<br />");
        t = t.replace(/<br>/g, "<br />");
        t = t.replace(/<\/br>/g, "<br />");
        t = t.replace(/<\/BR>/g, "<br />");
        t = t.replace(/<br \/>$/, "");//remove last one

        var lines = (t.match(/<br \/>/g) || []).length;
        var i = 2 - lines;
        var cs = "";
        while (i > 0) {
            cs += "<br />";
            i--;
        }
        $("#srtSubtitle").html(cs + t);
        // Log("Showing sub:" + cs + t);
        clearTimeout(subtitleTimer);
        subtitleTimer = setTimeout(function () {
            // Log("Clearing srt due to timer");
            widgetAPI.putInnerHTML(document.getElementById("srtSubtitle"), "");
        }, timeout+100)

    } catch (e) {
        Log("Player.OnSubtitleTimeHandler error: " + e.message);
    }
};

function isEmpty(obj) {
    if (typeof obj === 'undefined' || obj === null || obj === '') return true;
    if (typeof obj === 'number' && isNaN(obj)) return true;
    if (obj instanceof Date && isNaN(Number(obj))) return true;
    return false;
};

Player.getSubtitleSize = function () {
    var savedValue = this.getCookie("subSize");
    if (savedValue) {
        // To avoid it ever beeing cleared
        this.setCookie("subSize", savedValue, 100);
        return Number(savedValue);
    } else {
        return 30;
    }
};

Player.getSubtitlePos = function () {
    var savedValue = this.getCookie("subPos");
    if (savedValue) {
        // To avoid it ever beeing cleared
        this.setCookie("subPos", savedValue, 100);
        return Number(savedValue);
    } else {
        return 405;
    }
};

Player.getSubtitleLineHeight = function () {
    var savedValue = this.getCookie("subHeight");
    if (savedValue) {
        // To avoid it ever beeing cleared
        this.setCookie("subHeight", savedValue, 100);
        return Number(savedValue);
    } else {
        return 100;
    }
};

Player.saveSubtitleSize = function (value) {
    this.setCookie("subSize", value, 100); 
};

Player.saveSubtitlePos = function (value) {
    this.setCookie("subPos", value, 100);
};

Player.saveSubtitleLineHeight = function (value) {
    this.setCookie("subHeight", value, 100);
};

Player.moveSubtitles = function (moveUp) {
    if (!subtitlesEnabled) return;
    var oldValue = this.getSubtitlePos();
    var newValue = (moveUp) ? oldValue-2 : oldValue+2;
    Log("moveSubtitles new:" + newValue);
    if (newValue > 300 && newValue < 550) {
        $("#srtSubtitle").css("top", newValue); // write value to CSS
        this.saveSubtitlePos(newValue);
        this.showTestSubtitle();
    }
};

Player.sizeSubtitles = function(increase) {
    if (!subtitlesEnabled) return;
    var oldValue = this.getSubtitleSize();
    var newValue = (increase) ? oldValue+1 : oldValue-1;
    Log("sizeSubtitles new:" + newValue);
    if (newValue > 15 && newValue < 51) {
        $("#srtSubtitle").css("font-size", newValue); // write value to CSS
        this.saveSubtitleSize(newValue);
        this.showTestSubtitle();
    }
};

Player.separateSubtitles = function(increase) {
    if (!subtitlesEnabled) return;
    var oldValue = this.getSubtitleLineHeight();
    var newValue = (increase) ? oldValue+1 : oldValue-1;
    Log("separateSubtitles new:" + newValue);
    if (newValue >= 100 && newValue < 200) {
        if (newValue == 100) {
            $("#srtSubtitle").css("line-height", ""); // write value to CSS
        } else {
            $("#srtSubtitle").css("line-height", newValue + "%"); // write value to CSS
        }
        this.saveSubtitleLineHeight(newValue);
        this.showTestSubtitle();
    }
};

Player.showTestSubtitle = function () {
    if ($("#srtSubtitle").html() == "") 
    {
        $("#srtSubtitle").html("<br />Test subtitle<br />Test subtitle");
    }
}

Player.setSubtitleProperties = function() {
    $("#srtSubtitle").css("font-size", this.getSubtitleSize());
    $("#srtSubtitle").css("top", this.getSubtitlePos());

    var lineHeight = this.getSubtitleLineHeight();
    if (lineHeight > 100)
        $("#srtSubtitle").css("line-height", lineHeight + "%");
    else
        $("#srtSubtitle").css("line-height", "");
};

Log = function (msg) 
{
    // var logXhr = new XMLHttpRequest();
    // logXhr.onreadystatechange = function () {
    //     if (logXhr.readyState == 4) {
    //         logXhr.destroy();
    //         logXhr = null;
    //     }
    // };
    // logXhr.open("GET", "http://<LOGSERVER>/log?msg='[PlaySE] " + seqNo++ % 10 + " : " + msg + "'");
    // logXhr.send();
    alert(msg);
};
