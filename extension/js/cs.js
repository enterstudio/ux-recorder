'use strict';
/* global chrome, MediaRecorder */

navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia ||
                          navigator.webkitGetUserMedia);
window.MediaStream = (window.MediaStream ||
                      window.webkitMediaStream ||
                      navigator.mozMediaStream ||
                      navigator.msMediaStream);
class SessionPreview {

  constructor() {
    // Scale of the user image
    this._userScale = 0.7;
    Object.defineProperty(this, 'userScale', {
      get: function() {
        return this._userScale;
      },
      set: function(scale) {
        this._userScale = scale;
        this.$$('#sizeSlider').setAttribute('value', scale);
      },
      enumerable: true,
      configurable: false
    });
    // Alpha channel of the user image
    this._userAlpha = 0.54;
    Object.defineProperty(this, 'userAlpha', {
      get: function() {
        return this._userAlpha;
      },
      set: function(alpha) {
        this._userAlpha = alpha;
        this.$$('#opacitySlider').setAttribute('value', alpha);
      },
      enumerable: true,
      configurable: false
    });
    // If set, removed user controls to control the user image.
    this.hideUserControls = false;
    // Canvas height
    this.ch = undefined;
    // Canvas width
    this.cw = undefined;
    // User video height
    this.uh = undefined;
    // User video width
    this.uw = undefined;
    // Screen video height
    this.sh = undefined;
    // Screen video width
    this.sw = undefined;

    this._userSrc = undefined;
    this._screenSrc = undefined;
    Object.defineProperty(this, 'userSrc', {
      get: function() {
        return this._userSrc;
      },
      set: function(src) {
        this._userSrc = src;
        if (src) {
          this.$$('#user').src = src;
        } else {
          this.$$('#user').removeAttribute('src');
        }
      },
      enumerable: true,
      configurable: false
    });
    Object.defineProperty(this, 'screenSrc', {
      get: function() {
        return this._screenSrc;
      },
      set: function(src) {
        this._screenSrc = src;
        if (src) {
          this.$$('#screen').src = src;
        } else {
          this.$$('#screen').removeAttribute('src');
        }
      },
      enumerable: true,
      configurable: false
    });

    this.userPlaying = false;
    this.screenPlaying = false;
    this.context = undefined;
    this.drawing = false;
    this._draw = this.draw.bind(this);
    this._sizeSliderHandler = this._onSizeSlider.bind(this);
    this._opacitySliderHandler = this._onOpacitySlider.bind(this);
    this._resizeHandler = this._resize.bind(this);
    this._loadedmetadataHandler = this._metaLoaded.bind(this);
  }

  get template() {
    return `<div id="SessionPreview">
    <h3>Preview</h3>
    <div id="videoContent">
      <canvas id="canvas"></canvas>
    </div>
    <div id="controls">
      <label>User image opacity</label>
      <paper-slider id="opacitySlider" max="1" min="0" step="0.01"></paper-slider>
      <label>User image size</label>
      <paper-slider id="sizeSlider" max="2" min="0.2" step="0.01"></paper-slider>
    </div>
    <div id="buttons">
      <paper-button raised id="begin">Begin recording</paper-button>
      <paper-button id="cancel">Cancel</paper-button>
    </div>
    <video hidden id="user" muted></video>
    <video hidden id="screen" muted></video>
    </div>`;
  }

  get container() {
    var el = document.createElement('div');
    el.innerHTML = this.template;
    return el;
  }

  $$(selector) {
    return document.querySelector('#SessionPreview ' + selector);
  }

  init() {
    this.reset();
    this.$$('#opacitySlider')
      .addEventListener('value-changed', this._opacitySliderHandler);
    this.$$('#sizeSlider')
      .addEventListener('value-changed', this._sizeSliderHandler);
    this.context = this.$$('#canvas')
      .getContext('2d');
    window.addEventListener('resize', this._resizeHandler);
    this.$$('#user').addEventListener('loadedmetadata', this._loadedmetadataHandler);
    this.$$('#screen').addEventListener('loadedmetadata', this._loadedmetadataHandler);
  }

  remove() {
    this.$$('#opacitySlider')
      .removeEventListener('value-changed', this._opacitySliderHandler);
    this.$$('#sizeSlider')
      .removeEventListener('value-changed', this._sizeSliderHandler);
    window.removeEventListener('resize', this._resizeHandler);
    this.$$('#user').removeEventListener('loadedmetadata', this._loadedmetadataHandler);
    this.$$('#screen').removeEventListener('loadedmetadata', this._loadedmetadataHandler);
    this.context = undefined;
    if (this._beginHandler) {
      this.$$('#begin').removeEventListener('tap', this._beginHandler);
    }
    if (this._cancelHandler) {
      this.$$('#cancel').removeEventListener('tap', this._cancelHandler);
    }
  }

  reset() {
    this.userPlaying = false;
    this.screenPlaying = false;
    this.context = undefined;
    this.drawing = false;
    this.hideUserControls = false;
    // Canvas height
    this.ch = undefined;
    // Canvas width
    this.cw = undefined;
    // User video height
    this.uh = undefined;
    // User video width
    this.uw = undefined;
    // Screen video height
    this.sh = undefined;
    // Screen video width
    this.sw = undefined;

    this.userSrc = undefined;
    this.screenSrc = undefined;
    this.userScale = 0.7;
    this.userAlpha = 0.54;
  }

  hide() {
    this.$$('').setAttribute('hidden', true);
  }

  show() {
    this.$$('').removeAttribute('hidden');
  }

  _onSizeSlider(e) {
    this._userScale = Number(e.target.getAttribute('value'));
  }

  _onOpacitySlider(e) {
    this._userAlpha = Number(e.target.getAttribute('value'));
  }

  draw() {
    var c = this.context;
    if (!c) {
      return;
    }
    var _user = this.$$('#user');
    var _screen = this.$$('#screen');
    c.globalAlpha = 1;
    if (this.screenPlaying) {
      c.drawImage(_screen, 0, 0, this.cw, this.ch);
    } else {
      c.fillStyle = 'black';
      c.fillRect(0, 0, this.cw, this.ch);
    }

    var ar = this.uw / this.uh;
    var uw = 0.3 * this.cw;
    var uh = uw / ar;
    var a = this.userAlpha;
    var us = this.userScale;
    c.globalAlpha = a;
    uw = uw * us;
    uh = uh * us;
    var x = this.cw - uw - 8;
    var y = this.ch - uh - 8;
    if (this.userPlaying) {
      c.drawImage(_user, x, y, uw, uh);
    } else {
      c.fillStyle = 'green';
      c.fillRect(x, y, uw, uh);
    }
    window.requestAnimationFrame(this._draw);
  }

  _resize() {
    var canvas = this.$$('#canvas');
    this.cw = canvas.clientWidth;
    this.ch = canvas.clientHeight;
    if (this.cw) {
      canvas.width = this.cw;
    }
    if (this.ch) {
      canvas.height = this.ch;
    }
  }

  _metaLoaded(e) {
    var t = e.target;
    t.play();
    var _user = this.$$('#user');
    if (t === _user) {
      this.userPlaying = true;
      this.uw = _user.videoWidth;
      this.uh = _user.videoHeight;
    } else {
      var _screen = this.$$('#screen');
      this.screenPlaying = true;
      this.sw = _screen.videoWidth;
      this.sh = _screen.videoHeight;
    }
    if (!this.drawing) {
      this.drawing = true;
      this._resize();
      window.requestAnimationFrame(this._draw);
    }
  }

  captureStream() {
    return this.$$('#canvas').captureStream();
  }

  listenCancel(listener) {
    if (this._cancelHandler) {
      this.$$('#cancel').removeEventListener('tap', this._cancelHandler);
    }
    this._cancelHandler = listener;
    this.$$('#cancel').addEventListener('tap', this._cancelHandler);
  }

  listenBegin(listener) {
    if (this._beginHandler) {
      this.$$('#begin').removeEventListener('tap', this._beginHandler);
    }
    this._beginHandler = listener;
    this.$$('#begin').addEventListener('tap', this._beginHandler);
  }
}

class UxContent {

  constructor() {
    this.hasUi = false;
    this.screenChunks = [];
    this.camChunks = [];
    this.recording = false;
    this.sessionPreview = new SessionPreview();
  }

  get initialUi() {
    return `<div class="ux-recording panel" id="UxInitPanel">
    <paper-button id="UxRecordingStart">START RECORDING</paper-button>
    </div>`;
  }

  $$(selector) {
    var txt = '#UXContainer';
    if (selector) {
      txt += ' ' + selector;
    }
    return document.querySelector(txt);
  }

  buildUi() {
    if (this.hasUi) {
      return;
    }
    var txt = '<link rel="import" href="';
    txt += chrome.extension.getURL('bower_components/webcomponentsjs/webcomponents.js');
    txt += '">';
    txt += '<link rel="import" href="';
    txt += chrome.extension.getURL('polybuild.html');
    txt += '">';
    document.head.insertAdjacentHTML('beforeend', txt);
    var html = this.initialUi;
    var container = document.createElement('div');
    container.id = 'UXContainer';
    container.innerHTML = html;
    document.body.appendChild(container);
    setTimeout(() => {
      container.classList.add('opened');
    }, 100);
    this._addInitialHandlers();
  }

  _addInitialHandlers() {
    var elm = document.body.querySelector('#UXContainer #UxRecordingStart');
    if (!elm) {
      console.warn('UI not ready');
      return;
    }
    elm.addEventListener('tap', () => this.startRecording());
  }

  _onMessage(message/*, sender, sendResponse*/) {
    if(!message || !message.payload) {
      return;
    }
    // Uncoment and insert extension ID when published.
    // if (sender.id !== '') {
    //   return;
    // }
    switch (message.payload) {
      case 'initialize':
        this.port = chrome.runtime.connect();
        this.port.onMessage.addListener(this._onMessage.bind(this));
        this.buildUi();
      break;
      case 'stream-selection':
        this._onStreamSelection(message);
      break;
      case 'stop-recording':
        this.stopRecording();
      break;
      default:
        console.warn('Unknown payload', message.payload, message);
    }
  }

  startRecording() {
    document.body.querySelector('#UXContainer #UxRecordingStart').disabled = true;
    this.port.postMessage({
      'payload': 'init-recording'
    });
  }

  _onStreamSelection(message) {
    if (message.canceled) {
      document.body.querySelector('#UXContainer #UxRecordingStart').disabled = false;
      return;
    }
    this.initCamRecording()
    .then(() => this.initScreenRecording(message.streamId))
    .then(() => this.displaySessionStartControls())
    .catch((err) => {
      console.warn('TODO:');
      console.error(err);
      if (this.screenRecorder) {
        this.screenRecorder.stop();
      }
    });
  }

  initScreenRecording(id) {
    var constraints = {
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: id,
          maxWidth: 1920,
          maxHeight: 1200
        }
      }
    };
    return navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => this.initScreenStream(stream));
  }

  initScreenStream(stream) {
    this.screenStream = stream;
  }

  initCamRecording() {
    var constraints = {
      audio: true,
      video: {
        maxWidth: 640,
        maxHeigth: 480
      }
    };
    if (navigator.mediaDevices.getSupportedConstraints().facingMode) {
      constraints.video.facingMode = {
        exact: 'user'
      };
    }
    return navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => this.initVideoStream(stream));
  }

  initVideoStream(stream) {
    this.userStream = stream;
  }

  displaySessionStartControls() {
    document.body.querySelector('#UXContainer')
      .appendChild(this.sessionPreview.container);
    this.sessionPreview.init();
    this.$$('.ux-recording').setAttribute('hidden', true);
    this.sessionPreview.userSrc =  window.URL.createObjectURL(this.userStream);
    this.sessionPreview.screenSrc = window.URL.createObjectURL(this.screenStream);
    this._listenPreview();
  }

  _listenPreview() {
    this.sessionPreview.listenCancel(this.cancelPreview.bind(this));
    this.sessionPreview.listenBegin(this.beginRecording.bind(this));
  }

  cancelPreview() {
    this.sessionPreview.reset();
    this.sessionPreview.remove();
    var cont = document.body.querySelector('#UXContainer #SessionPreview');
    cont.parentNode.removeChild(cont);
    document.body.querySelector('#UXContainer .ux-recording').removeAttribute('hidden');
    this.userStream = undefined;
    this.screenStream = undefined;
  }

  beginRecording() {
    var options = {
      audioBitsPerSecond : 128000,
      videoBitsPerSecond : 2500000,
      mimeType : 'video/webm'
    };
    // this.sessionPreview.hide();
    var st = new window.MediaStream();
    var audioTrack = this.userStream.getAudioTracks()[0];
    var videoTrack = this.sessionPreview.captureStream().getVideoTracks()[0];
    st.addTrack(audioTrack);
    st.addTrack(videoTrack);

    var mediaRecorder = new MediaRecorder(st, options);
    mediaRecorder.ondataavailable = (e) => {
      this.camChunks.push(e.data);
    };

    // mediaRecorder.onstop = () => {
    //   var blob = new Blob(this.camChunks, {
    //     'type' : 'video/mp4'
    //   });
    //   var objectUrl = window.URL.createObjectURL(blob);
    //   console.log(objectUrl);
    // };

    mediaRecorder.start();
    this.mediaRecorder = mediaRecorder;
    this.$$().classList.add('recording');
  }

  stopRecording() {
    this.mediaRecorder.stop();
    var blob = new Blob(this.camChunks, {
      'type' : 'video/mp4'
    });
    var objectUrl = window.URL.createObjectURL(blob);
    console.log(objectUrl, this.camChunks);
    this.camChunks = [];
    this.cancelPreview();
    this.displaySummary();
  }

  displaySummary() {
    console.log('TODO!');
  }
}

const script = new UxContent();
chrome.runtime.onMessage.addListener(script._onMessage.bind(script));
