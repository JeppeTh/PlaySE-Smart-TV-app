var Header = {
   
};

Header.addPrefix = function(location) {
    if (!location.match(/.+\/$/))
        location = location + '/';
    if (Channel.getHeaderPrefix())
        location = Channel.getHeaderPrefix() + '/' + location;
    return location;
};

Header.urldecode = function(str) {
   return decodeURIComponent((str+'').replace(/\+/g, '%20'));
};

Header.insertTitle = function(path) {
    var title;
    var html = '';
    if (path.length > 100) {
         path = path.replace(/^([^/]+\/[^/]+\/).*(\/[^/]+\/[^/]+\/)$/,'$1...$2');
    }
    while(path.indexOf('/')>0) {
	title = path.substring(0, path.indexOf('/'));
	title = this.urldecode(title);
	if(title.length > 30){
	    title = title.substring(0, 30)+ '...';
	}
	path = path.substring(path.indexOf('/') + 1 , path.length);
	html +='<li class="root-item"><a href="index.html" class="active">' + title + '</a></li>';
    }
    return html;
};


Header.display = function(location) {
    if (location && location.length > 0) {
        location = Header.addPrefix(location);
    }
	
    var html = '<div class="logo">';
    html += '<a href="index.html"><img src="images/weeb2.png" alt="" border="0" /></a>';
    html += 'Version: 0.3.0</div>';
    html += '<div class="socials">';
    html += '<p><a href="#" class="social-fb" id="companyName">Utvecklad av Christofer Persson åt Kantaris Co.Ltd</a></p>';
    html += '</div>';
    html += '<div class="topmenu">';
    html += '<ul class="dropdown">';
    html += Header.insertTitle(location);
    html += '</ul>';
    html += '</div>';
    html += '<div class="clear">';
    html += '</div>';
   
	$('.header').html(html);
    return true;
};
