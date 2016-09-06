/**
 * A SIMPLE RUTER APP
 * started as a hobby project 
 * 
 * Features:
 * - fetches stops by GeoLocation
 * - shows walk time to stop
 * - shows transport with est. arrival
 * - est. arrival with time and minutes to go
 *
 * Author: Tommy Vitikka 
 * 
 * TODOs:
 * - english and norwegian based on phone/pebble locale
 * - refresh/fetch new stops and arrivals and times
 * - settings screen where user can instead of geolocation choose to show just the user predefined stops
 * - settings screen to choose how many stops to fetch
 * - fetch even more stops by user interaction of some kind (e.g. last stop being a special load more btn?)
 * - remove the stopID from screen and instead find a hidden field to store that in
 * - make long names show by "slide left" after delay(2000ms)
 * 
 * Unofficial, but awesome. Find closest stop – Find earliest transport
 */

// Set a configurable with the open callback
var Settings = require('settings');
var LANG = 'no';
if (!Settings.option('language') )
	Settings.option('language', LANG);
try {
	LANG = (Settings.option('language') && Settings.option('language').length ? Settings.option('language') : 'no'); // if not set, set to default: no	
} catch(err) {
	console.log('couldnt get language');
}
Settings.config(
	{ url: 'http://vitikka.no/xhr/ruter-to-go-config.php?' + encodeURIComponent(JSON.stringify( '#language='+LANG )) },
  function(e) {
    // console.log('opening configurable');
  },
  function(e) {}
);

var TEXTS = {
	mintogo: {
		en: 'minutes walk',
		no: 'min å gå'
	},
	loadingText: {
		en: [
			'Let\'s try..',
			'Predicting transport..',
			'Things Take Time..',
			'Using Map and compass..',
			'Patience is a virtue..'
		],
		no: [
			'Da prøve vi..',
			'Vi spår framtida..',
			'Ting Tar Tid..',
			'Bruker kart og kompass..',
			'Tålmodighet er en dyd..'
		]
	},
	nothingInSight:{
		en: 'No departures',
		no: 'Ingen avganger'
	},
	tryAgain:{
		en: 'Go back and try again',
		no: 'Gå tilbake og prøv igjen'
	},
	errorNoStops:{
		en: 'Couldn\t get any stops. Check your phone signal and that you\re allowing location services.',
		no: 'Kunne ikke hente holdeplasser. Sikker på at du har dekning og tillater lokasjonstjenester?'
	},
	errorSomething:{
		en: 'Something went wrong. Check your internet connection.',
		no: 'Noe gikk galt. Sjekk at du har dekning.'
	},
	errorSomething2:{
		en: 'Something went wrong. Check your internet connection.',
		no: 'Noe gikk galt. Sjekk at du har dekning og sånt.'
	},
	splashText:{
		en: 'Finding closest stops..',
		no: 'Finner nærmeste holdeplass..'
	}

};

var UI = require('ui');

var splashScreen = new UI.Card({
	title: TEXTS.splashText[LANG]
});
splashScreen.show();


navigator.geolocation.getCurrentPosition(function(pos) {
	
	var latlngObject = new LatLng(pos.coords.latitude, pos.coords.longitude);
	var utmObject = latlngObject.toUTMRef();
	var easting = parseInt(utmObject.easting);
	var northing = parseInt(utmObject.northing);

	var ajax = require('ajax');
	ajax({ 
		//url: 'http://reisapi.ruter.no/Place/GetClosestStops?coordinates=(x='+easting+',y='+nothing+')&proposals=10&maxdistance=20&json=true'
		url: 'http://reis.ruter.no/ReisRestNational/Stop/GetClosestStopsByCoordinates/?coordinates=(x='+easting+',y='+northing+')&proposals=20', 
		type: 'json' 
	},function(data) {
		if(data.length > 0){
			var dataitems = [];
			for(var i = 0; i < data.length; i++) {
				dataitems.push({
					title: data[i].Name,
					subtitle: data[i].WalkingDistance+' ' + TEXTS.mintogo[LANG] // data[i].ID
				});
			}

			var menu = new UI.Menu({
				sections: [{ items: dataitems	}]
			});
			splashScreen.hide();
			menu.show();


			menu.on('select', function(e) {
				var id = data[e.itemIndex].ID;

				menuitemLoading(menu, e);
				
				ajax({ 
					url: 'https://reisapi.ruter.no/StopVisit/GetDepartures/'+id+'?transporttypes=bus,Train,Boat,Metro,Tram', 
					type: 'json' 
				},function(data) {

					menuitemLoading(menu, e);

					if(data.length > 0){

						var dataitems = [];
						var limitResults = data.length;
						if(limitResults > 50) {
							limitResults = 50; // no more than 50 results to prevent app crash
						}

						for(var i = 0; i < limitResults; i++) {

							// expectedArrivalRaw - make it iso 8601
							var exp = data[i].MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime;
							exp = exp.split('+');
							exp = exp[0] + '' + '+' + exp[1]; //exp = exp[0] + '.000' + '+' + exp[1];

							// create a date obj and create the printstr var
							var expDate = new Date(exp);
							var expectedArrivalMin  = parseInt( ( expDate.getTime() - new Date().getTime() )/60000 ); // in minutes
							var expectedArrivalTime = pad(expDate.getHours()) + ':' + pad(expDate.getMinutes()) + ':' + pad(expDate.getSeconds());


							dataitems.push({
								title: data[i].MonitoredVehicleJourney.PublishedLineName + ' ' + data[i].MonitoredVehicleJourney.DestinationName,
								subtitle: expectedArrivalMin + ' min' + ' ('+expectedArrivalTime + ')'
							});
						}
						var menu2 = new UI.Menu({
							sections: [{ items: dataitems	}]
						});
						menu2.show();
						
					}else{
						//console.log('Did not get any ');
						var failMenu = new UI.Menu({
							sections: [{ 
								items: {
									title: TEXTS.nothingInSight[LANG],
									subtitle: TEXTS.tryAgain[LANG]
								}
							}]
						});
						failMenu.show();
					}
				});
			}); // menu selection

		}else {
			errorCard(TEXTS.errorNoStops[LANG]);
		}
	},
	function(error) {
		errorCard(TEXTS.errorSomething[LANG]);
	});

}); // navigator fetch geo


// run this on errors
function errorCard(errmsg){
	var card = new UI.Card({
		title: 'Æsj',
		body: (errmsg ? errmsg : TEXTS.errorSomething2[LANG])
	});
	card.show();
}

/**
 * FUNCTIONS
 */

// making a "loading..." on a menu select
// resets when called every second time
var menuloadingFlag = 1;
var menuloadingInitialItem;
var timers = [];
function menuitemLoading(menu, e){

	if(menuloadingFlag === 1){
		menuloadingFlag = 0;
		menuloadingInitialItem = [e.sectionIndex, e.itemIndex, { title: e.item.title, subtitle: e.item.subtitle }];
		menu.item(e.sectionIndex, e.itemIndex, { subtitle: TEXTS.loadingText[LANG][0] });	
		timers[0] = setTimeout(function(){
			menu.item(e.sectionIndex, e.itemIndex , { subtitle: TEXTS.loadingText[LANG][1] });	
			timers[1] = setTimeout(function(){
				menu.item(e.sectionIndex, e.itemIndex , { subtitle: TEXTS.loadingText[LANG][2] });	
				timers[2] = setTimeout(function(){
					menu.item(e.sectionIndex, e.itemIndex , { subtitle: TEXTS.loadingText[LANG][3] });
					timers[3] = setTimeout(function(){
						menu.item(e.sectionIndex, e.itemIndex , { subtitle: TEXTS.loadingText[LANG][4] });	
					},1000);
				},1000);
			},1000);
		},1000);
	}else{
		clearTimeout(timers[0]);
		clearTimeout(timers[1]);
		clearTimeout(timers[2]);
		clearTimeout(timers[3]);
		menuloadingFlag = 1;
		menu.item(menuloadingInitialItem[0],menuloadingInitialItem[1],menuloadingInitialItem[2], menuloadingInitialItem[3]);
	}
}

// prototype a str of time
Date.prototype.timeNow = function () {
     return ((this.getHours() < 10)?"0":"") + this.getHours() +":"+ ((this.getMinutes() < 10)?"0":"") + this.getMinutes() +":"+ ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
};

// short function to always get two digit numbers
function pad(n) { return ("0" + n).slice(-2); }

// coordinates
function LatLng(t,a){this.lat=t,this.lng=a,this.distance=LatLngDistance,this.toOSRef=LatLngToOSRef,this.toUTMRef=LatLngToUTMRef,this.WGS84ToOSGB36=WGS84ToOSGB36,this.OSGB36ToWGS84=OSGB36ToWGS84,this.toString=LatLngToString}function LatLngToString(){return"("+this.lat+", "+this.lng+")"}function OSRef(t,a){this.easting=t,this.northing=a,this.toLatLng=OSRefToLatLng,this.toString=OSRefToString,this.toSixFigureString=OSRefToSixFigureString}function OSRefToString(){return"("+this.easting+", "+this.northing+")"}function OSRefToSixFigureString(){var t=Math.floor(this.easting/1e5),a=Math.floor(this.northing/1e5),n="";n=5>a?5>t?"S":"T":10>a?5>t?"N":"O":"H";var e="",h=65+5*(4-a%5)+t%5;h>=73&&h++,e=chr(h);var r=Math.floor((this.easting-1e5*t)/100),i=Math.floor((this.northing-1e5*a)/100),s=r;100>r&&(s="0"+s),10>r&&(s="0"+s);var o=i;return 100>i&&(o="0"+o),10>i&&(o="0"+o),n+e+s+o}function UTMRef(t,a,n,e){this.easting=t,this.northing=a,this.latZone=n,this.lngZone=e,this.toLatLng=UTMRefToLatLng,this.toString=UTMRefToString}function UTMRefToString(){return this.lngZone+this.latZone+" "+this.easting+" "+this.northing}function RefEll(t,a){this.maj=t,this.min=a,this.ecc=(t*t-a*a)/(t*t)}function sinSquared(t){return Math.sin(t)*Math.sin(t)}function cosSquared(t){return Math.cos(t)*Math.cos(t)}function tanSquared(t){return Math.tan(t)*Math.tan(t)}function sec(t){return 1/Math.cos(t)}function deg2rad(t){return t*(Math.PI/180)}function rad2deg(t){return t*(180/Math.PI)}function chr(t){var a=t.toString(16);return 1==a.length&&(a="0"+a),a="%"+a,unescape(a)}function ord(t){var a,n=t.charAt(0);for(a=0;256>a;++a){var e=a.toString(16);if(1==e.length&&(e="0"+e),e="%"+e,e=unescape(e),e==n)break}return a}function LatLngDistance(t){var a=6366.707,n=deg2rad(this.lat),e=deg2rad(t.lat),h=deg2rad(this.lng),r=deg2rad(t.lng),i=a*Math.cos(h)*Math.sin(n),s=a*Math.sin(h)*Math.sin(n),o=a*Math.cos(n),M=a*Math.cos(r)*Math.sin(e),g=a*Math.sin(r)*Math.sin(e),d=a*Math.cos(e),u=Math.sqrt((i-M)*(i-M)+(s-g)*(s-g)+(o-d)*(o-d));return u}function OSGB36ToWGS84(){var t=new RefEll(6377563.396,6356256.909),a=t.maj,n=t.min,e=t.ecc,h=deg2rad(this.lat),r=deg2rad(this.lng),i=a/Math.sqrt(1-e*sinSquared(h)),s=0,o=(i+s)*Math.cos(h)*Math.cos(r),M=(i+s)*Math.cos(h)*Math.sin(r),g=((1-e)*i+s)*Math.sin(h),d=446.448,u=-124.157,c=542.06,S=-204894e-10,f=deg2rad(4172222e-11),l=deg2rad(6861111e-11),w=deg2rad(.00023391666),p=d+o*(1+S)+-f*M+l*g,q=u+w*o+M*(1+S)+-f*g,L=c+-l*o+f*M+g*(1+S),T=new RefEll(6378137,6356752.3141);a=T.maj,n=T.min,e=T.ecc;for(var R=rad2deg(Math.atan(q/p)),v=Math.sqrt(p*p+q*q),m=Math.atan(L/(v*(1-e))),O=1;10>O;O++)i=a/Math.sqrt(1-e*sinSquared(m)),phiN1=Math.atan((L+e*i*Math.sin(m))/v),m=phiN1;var G=rad2deg(m);this.lat=G,this.lng=R}function WGS84ToOSGB36(){var t=new RefEll(6378137,6356752.3141),a=t.maj,n=t.min,e=t.ecc,h=deg2rad(this.lat),r=deg2rad(this.lng),i=a/Math.sqrt(1-e*sinSquared(h)),s=0,o=(i+s)*Math.cos(h)*Math.cos(r),M=(i+s)*Math.cos(h)*Math.sin(r),g=((1-e)*i+s)*Math.sin(h),d=-446.448,u=124.157,c=-542.06,S=204894e-10,f=deg2rad(-4172222e-11),l=deg2rad(-6861111e-11),w=deg2rad(-.00023391666),p=d+o*(1+S)+-f*M+l*g,q=u+w*o+M*(1+S)+-f*g,L=c+-l*o+f*M+g*(1+S),T=new RefEll(6377563.396,6356256.909);a=T.maj,n=T.min,e=T.ecc;for(var R=rad2deg(Math.atan(q/p)),v=Math.sqrt(p*p+q*q),m=Math.atan(L/(v*(1-e))),O=1;10>O;O++)i=a/Math.sqrt(1-e*sinSquared(m)),phiN1=Math.atan((L+e*i*Math.sin(m))/v),m=phiN1;var G=rad2deg(m);this.lat=G,this.lng=R}function OSRefToLatLng(){var t=new RefEll(6377563.396,6356256.909),a=.9996012717,n=-1e5,e=4e5,h=deg2rad(49),r=deg2rad(-2),i=t.maj,s=t.min,o=t.ecc,M=0,g=0,d=this.easting,u=this.northing,c=(i-s)/(i+s),S=0,f=(u-n)/(i*a)+h;do S=s*a*((1+c+5/4*c*c+5/4*c*c*c)*(f-h)-(3*c+3*c*c+21/8*c*c*c)*Math.sin(f-h)*Math.cos(f+h)+(15/8*c*c+15/8*c*c*c)*Math.sin(2*(f-h))*Math.cos(2*(f+h))-35/24*c*c*c*Math.sin(3*(f-h))*Math.cos(3*(f+h))),f+=(u-n-S)/(i*a);while(u-n-S>=.001);var l=i*a*Math.pow(1-o*sinSquared(f),-.5),w=i*a*(1-o)*Math.pow(1-o*sinSquared(f),-1.5),p=l/w-1,q=Math.tan(f)/(2*w*l),L=Math.tan(f)/(24*w*Math.pow(l,3))*(5+3*tanSquared(f)+p-9*tanSquared(f)*p),T=Math.tan(f)/(720*w*Math.pow(l,5))*(61+90*tanSquared(f)+45*tanSquared(f)*tanSquared(f)),R=sec(f)/l,v=sec(f)/(6*l*l*l)*(l/w+2*tanSquared(f)),m=sec(f)/(120*Math.pow(l,5))*(5+28*tanSquared(f)+24*tanSquared(f)*tanSquared(f)),O=sec(f)/(5040*Math.pow(l,7))*(61+662*tanSquared(f)+1320*tanSquared(f)*tanSquared(f)+720*tanSquared(f)*tanSquared(f)*tanSquared(f));return M=f-q*Math.pow(d-e,2)+L*Math.pow(d-e,4)-T*Math.pow(d-e,6),g=r+R*(d-e)-v*Math.pow(d-e,3)+m*Math.pow(d-e,5)-O*Math.pow(d-e,7),new LatLng(rad2deg(M),rad2deg(g))}function LatLngToOSRef(){var t=new RefEll(6377563.396,6356256.909),a=.9996012717,n=-1e5,e=4e5,h=deg2rad(49),r=deg2rad(-2),i=t.maj,s=t.min,o=t.ecc,M=deg2rad(this.lat),g=deg2rad(this.lng),d=0,u=0,c=(i-s)/(i+s),S=i*a*Math.pow(1-o*sinSquared(M),-.5),f=i*a*(1-o)*Math.pow(1-o*sinSquared(M),-1.5),l=S/f-1,w=s*a*((1+c+5/4*c*c+5/4*c*c*c)*(M-h)-(3*c+3*c*c+21/8*c*c*c)*Math.sin(M-h)*Math.cos(M+h)+(15/8*c*c+15/8*c*c*c)*Math.sin(2*(M-h))*Math.cos(2*(M+h))-35/24*c*c*c*Math.sin(3*(M-h))*Math.cos(3*(M+h))),p=w+n,q=S/2*Math.sin(M)*Math.cos(M),L=S/24*Math.sin(M)*Math.pow(Math.cos(M),3)*(5-tanSquared(M)+9*l),T=S/720*Math.sin(M)*Math.pow(Math.cos(M),5)*(61-58*tanSquared(M)+Math.pow(Math.tan(M),4)),R=S*Math.cos(M),v=S/6*Math.pow(Math.cos(M),3)*(S/f-tanSquared(M)),m=S/120*Math.pow(Math.cos(M),5)*(5-18*tanSquared(M)+Math.pow(Math.tan(M),4)+14*l-58*tanSquared(M)*l);return u=p+q*Math.pow(g-r,2)+L*Math.pow(g-r,4)+T*Math.pow(g-r,6),d=e+R*(g-r)+v*Math.pow(g-r,3)+m*Math.pow(g-r,5),new OSRef(d,u)}function UTMRefToLatLng(){var t=new RefEll(6378137,6356752.314),a=.9996,n=t.maj,e=t.ecc,h=e/(1-e),r=(1-Math.sqrt(1-e))/(1+Math.sqrt(1-e)),i=this.easting-5e5,s=this.northing,o=this.lngZone,M=this.latZone,g=6*(o-1)-180+3;ord(M)-ord("N")<0&&(s-=1e7);var d=s/a,u=d/(n*(1-e/4-3*e*e/64-5*Math.pow(e,3)/256)),c=u+(3*r/2-27*Math.pow(r,3)/32)*Math.sin(2*u)+(21*r*r/16-55*Math.pow(r,4)/32)*Math.sin(4*u)+151*Math.pow(r,3)/96*Math.sin(6*u),S=n/Math.sqrt(1-e*Math.sin(c)*Math.sin(c)),f=Math.tan(c)*Math.tan(c),l=h*Math.cos(c)*Math.cos(c),w=n*(1-e)/Math.pow(1-e*Math.sin(c)*Math.sin(c),1.5),p=i/(S*a),q=(c-S*Math.tan(c)/w*(p*p/2-(5+3*f+10*l-4*l*l-9*h)*Math.pow(p,4)/24+(61+90*f+298*l+45*f*f-252*h-3*l*l)*Math.pow(p,6)/720))*(180/Math.PI),L=g+(p-(1+2*f+l)*Math.pow(p,3)/6+(5-2*l+28*f-3*l*l+8*h+24*f*f)*Math.pow(p,5)/120)/Math.cos(c)*(180/Math.PI);return new LatLng(q,L)}function LatLngToUTMRef(){var t=new RefEll(6378137,6356752.314),a=.9996,n=t.maj,e=t.ecc,h=this.lng,r=this.lat,i=r*(Math.PI/180),s=h*(Math.PI/180),o=Math.floor((h+180)/6)+1;r>=56&&64>r&&h>=3&&12>h&&(o=32),r>=72&&84>r&&(h>=0&&9>h?o=31:h>=9&&21>h?o=33:h>=21&&33>h?o=35:h>=33&&42>h&&(o=37));var M=6*(o-1)-180+3,g=M*(Math.PI/180),d=getUTMLatitudeZoneLetter(r);ePrimeSquared=e/(1-e);var u=n/Math.sqrt(1-e*Math.sin(i)*Math.sin(i)),c=Math.tan(i)*Math.tan(i),S=ePrimeSquared*Math.cos(i)*Math.cos(i),f=Math.cos(i)*(s-g),l=n*((1-e/4-3*e*e/64-5*e*e*e/256)*i-(3*e/8+3*e*e/32+45*e*e*e/1024)*Math.sin(2*i)+(15*e*e/256+45*e*e*e/1024)*Math.sin(4*i)-35*e*e*e/3072*Math.sin(6*i)),w=a*u*(f+(1-c+S)*Math.pow(f,3)/6+(5-18*c+c*c+72*S-58*ePrimeSquared)*Math.pow(f,5)/120)+5e5,p=a*(l+u*Math.tan(i)*(f*f/2+(5-c+9*S+4*S*S)*Math.pow(f,4)/24+(61-58*c+c*c+600*S-330*ePrimeSquared)*Math.pow(f,6)/720));return 0>r&&(p+=1e7),new UTMRef(w,p,d,o)}function getOSRefFromSixFigureReference(t){var a=t.substring(0,1),n=t.substring(1,2),e=100*parseInt(t.substring(2,5),10),h=100*parseInt(t.substring(5,8),10);"H"==a?h+=1e6:"N"==a?h+=5e5:"O"==a?(h+=5e5,e+=5e5):"T"==a&&(e+=5e5);var r=ord(n);r>73&&r--;var i=(r-65)%5*1e5,s=1e5*(4-Math.floor((r-65)/5));return new OSRef(e+i,h+s)}function getUTMLatitudeZoneLetter(t){return 84>=t&&t>=72?"X":72>t&&t>=64?"W":64>t&&t>=56?"V":56>t&&t>=48?"U":48>t&&t>=40?"T":40>t&&t>=32?"S":32>t&&t>=24?"R":24>t&&t>=16?"Q":16>t&&t>=8?"P":8>t&&t>=0?"N":0>t&&t>=-8?"M":-8>t&&t>=-16?"L":-16>t&&t>=-24?"K":-24>t&&t>=-32?"J":-32>t&&t>=-40?"H":-40>t&&t>=-48?"G":-48>t&&t>=-56?"F":-56>t&&t>=-64?"E":-64>t&&t>=-72?"D":-72>t&&t>=-80?"C":"Z"}