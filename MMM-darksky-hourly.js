Module.register("MMM-darksky-hourly", {

  defaults: {
    apiKey: "",
    apiBase: "https://api.darksky.net/forecast",
    units: config.units,
    language: config.language,
    twentyFourHourTime: true,
	showCurrentWeather: true,
	showTextSummary: true,
    showPrecipitationPossibilityInRow: true,
    showDayInRow: true,
    showIconInRow: true,
	fadeForecast: true,
    updateInterval: 10 * 60 * 1000, // every 5 minutes
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,
    tempDecimalPlaces: 0, // round temperatures to this many decimal places
    geoLocationOptions: {
      enableHighAccuracy: true,
      timeout: 5000
    },
    latitude:  null,
    longitude: null,
    maxHoursForecast: 8,   // maximum number of days to show in forecast
	skipHours: 0,
    unitTable: {
      'default':  'auto',
      'metric':   'si',
      'imperial': 'us'
    },
    iconTable: {
      'clear-day':           'wi-day-sunny',
      'clear-night':         'wi-night-clear',
      'rain':                'wi-rain',
      'snow':                'wi-snow',
      'sleet':               'wi-sleet',
      'wind':                'wi-cloudy-gusts',
      'fog':                 'wi-fog',
      'cloudy':              'wi-cloudy',
      'partly-cloudy-day':   'wi-day-cloudy',
      'partly-cloudy-night': 'wi-night-alt-cloudy',
      'hail':                'wi-hail',
      'thunderstorm':        'wi-thunderstorm',
      'tornado':             'wi-tornado'
    },

    debug: false
  },

  getTranslations: function () {
    return false;
  },

  getScripts: function () {
    return [
      'jsonp.js',
      'moment.js'
    ];
  },

  getStyles: function () {
    return ["weather-icons.css", "MMM-darksky-hourly.css"];
  },

  shouldLookupGeolocation: function () {
    return this.config.latitude == null &&
           this.config.longitude == null;
  },

  start: function () {
    Log.info("Starting module: " + this.name);

    if (this.shouldLookupGeolocation()) {
      this.getLocation();
    }
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  updateWeather: function () {
    if (this.geoLocationLookupFailed) {
      return;
    }
    if (this.shouldLookupGeolocation() && !this.geoLocationLookupSuccess) {
      this.scheduleUpdate(1000); // try again in one second
      return;
    }

    var units = this.config.unitTable[this.config.units] || 'auto';

    var url = this.config.apiBase+'/'+this.config.apiKey+'/'+this.config.latitude+','+this.config.longitude+'?units='+units+'&lang='+this.config.language;
    if (this.config.data) {
      // for debugging
      this.processWeather(this.config.data);
    } else {
      getJSONP(url, this.processWeather.bind(this), this.processWeatherError.bind(this));
    }
  },

  processWeather: function (data) {
    if (this.config.debug) {
      console.log('weather data', data);
    }
    this.loaded = true;
    this.weatherData = data;
    this.temp = this.roundTemp(this.weatherData.currently.temperature);
    this.updateDom(this.config.animationSpeed);
    this.scheduleUpdate();
  },

  processWeatherError: function (error) {
    if (this.config.debug) {
      console.log('process weather error', error);
    }
    // try later
    this.scheduleUpdate();
  },

  notificationReceived: function(notification, payload, sender) {
    switch(notification) {
      case "DOM_OBJECTS_CREATED":
        break;
    }
  },

  getDom: function() {
    var wrapper = document.createElement("div");

    if (this.config.apiKey === "") {
      wrapper.innerHTML = "Please set the correct forcast.io <i>apiKey</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.geoLocationLookupFailed) {
      wrapper.innerHTML = "Geolocaiton lookup failed, please set <i>latitude</i> and <i>longitude</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = this.translate('LOADING');
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    var currentWeather = this.weatherData.currently;
    var hourly         = this.weatherData.hourly;

	if(this.config.showCurrentWeather) {
		var large = document.createElement("div");
		large.className = "large light";

		var icon = currentWeather ? currentWeather.icon : hourly.icon;
		var iconClass = this.config.iconTable[icon];
		var icon = document.createElement("span");
		icon.className = 'big-icon wi ' + iconClass;
		large.appendChild(icon);

		var temperature = document.createElement("span");
		temperature.className = "bright";
		temperature.innerHTML = " " + this.temp + "&deg;";
		large.appendChild(temperature);

		wrapper.appendChild(large);
	}

	if (this.config.showTextSummary) {
		var summaryText = hourly.summary;
		var summary = document.createElement("div");
		summary.className = "small dimmed summary";
		summary.innerHTML = summaryText;

		wrapper.appendChild(summary);
	}

    wrapper.appendChild(this.renderWeatherForecast());

    return wrapper;
  },

  // Get current day from time
  getDayFromTime: function (time) {
    var dt = new Date(time * 1000);
    return moment.weekdaysShort(dt.getDay());
  },

  // Get current hour from time
  // Depending on config returns either
  //  - 23:00 - 24 hour format
  //  - 11pm  - 12 hour format
  getHourFromTime: function (time) {
    var dt = new Date(time * 1000);
    var hour = dt.getHours();
    if (this.config.twentyFourHourTime) {
      return hour + ":00";
    }
    else {
      var twentyFourHourFormat = "am";
      if (hour > 11) {
        twentyFourHourFormat = "pm";
      }
      hour = hour % 12;
      hour = (hour == 0) ? 12 : hour;
      return hour + twentyFourHourFormat;
    }
  },

  // A bunch of these make up the meat
  // In each row we can should display
  //  - time, icon, precip, temp
  renderForecastRow: function (data, addClass) {
    // Start off with our row
    var row = document.createElement("tr");
    row.className = "forecast-row" + (addClass ? " " + addClass : "");

    // time - hours
    var hourTextSpan = document.createElement("span");
    hourTextSpan.className = "forecast-hour"
    hourTextSpan.innerHTML = this.getHourFromTime(data.time)

    // icon
    var iconClass = this.config.iconTable[data.icon];
    var icon = document.createElement("span");
    icon.className = 'wi weathericon ' + iconClass;

    // precipitation
    // extra check here is due to darksky precip being optional
    var precipPossibility = document.createElement("span");
    precipPossibility.innerHTML = "N/A"
    if (data.precipProbability != null) {
      precipPossibility.innerHTML = Math.round(data.precipProbability * 100) + "%";
    }
    precipPossibility.className = "precipitation"

    // temperature
    var temp = data.temperature;
    temp = Math.round(temp);
    var temperature = document.createElement("span");
    temperature.innerHTML = temp + "&deg;";
    temperature.className = "temp";

    // Add what's necessary and return it
    row.appendChild(hourTextSpan)
    if (this.config.showIconInRow) { row.appendChild(icon); }
    if (this.config.showPrecipitationPossibilityInRow) { row.appendChild(precipPossibility) }
    row.appendChild(temperature)

    return row;
  },

  renderWeatherForecast: function () {
    // Placeholders
    var numHours =  this.config.maxHoursForecast;
	var skip = this.config.skipHours + 1;

    // Truncate for the data we need
    var filteredHours =
      this.weatherData.hourly.data.filter( function(d, i) { return ((i <= (numHours * skip)) && (i % skip == 0)); });

    // Setup what we'll be displaying
    var display = document.createElement("table");
    display.className = "forecast";

    var days = [];

    // Cycle through and populate our table
    for (let i = 1; i < filteredHours.length; i++) {
      // insert day here if necessary
      var hourData = filteredHours[i];
	  var addClass = "";
	  if(this.config.fadeForecast) {
		  if(i+2 == filteredHours.length) {
			  addClass = "dark";
		  }
		  if(i+1 == filteredHours.length) {
			  addClass = "darker";
		  }
	  }
      var row = this.renderForecastRow(hourData, addClass);

      let day = this.getDayFromTime(hourData.time);
      let daySpan = document.createElement("span");

      if (days.indexOf(day) == -1) {
        daySpan.innerHTML = day;
        days.push(day);
      }

      if (this.config.showDayInRow) { row.prepend(daySpan); }

      display.appendChild(row);
    }

    return display;
  },

  getLocation: function () {
    var self = this;
    navigator.geolocation.getCurrentPosition(
      function (location) {
        if (self.config.debug) {
          console.log("geolocation success", location);
        }
        self.config.latitude  = location.coords.latitude;
        self.config.longitude = location.coords.longitude;
        self.geoLocationLookupSuccess = true;
      },
      function (error) {
        if (self.config.debug) {
          console.log("geolocation error", error);
        }
        self.geoLocationLookupFailed = true;
        self.updateDom(self.config.animationSpeed);
      },
      this.config.geoLocationOptions);
  },

// Round the temperature based on tempDecimalPlaces
  roundTemp: function (temp) {
    var scalar = 1 << this.config.tempDecimalPlaces;

    temp *= scalar;
    temp  = Math.round( temp );
    temp /= scalar;

    return temp;
  },

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setTimeout(function() {
      self.updateWeather();
    }, nextLoad);
  }

});
